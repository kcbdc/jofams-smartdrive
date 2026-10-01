package com.komsco.jofams.smartdrive

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.GnssStatus
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Granularity
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.*

/**
 * 조팸스 내비 네이티브 주행 엔진.
 *
 * 핵심 목표:
 * 1) Fused + GPS_PROVIDER 동시 수신 후 품질 점수로 최선의 fix 선택
 * 2) GNSS 위성수/CN0 + speedAccuracy를 이용해 노이즈성 0속도 제거
 * 3) Rotation Vector + Gyroscope를 보조 heading으로 사용
 * 4) GPS 단절 시 저장된 경로 선형을 따라 최대 90초 native dead-reckoning
 * 5) GPS 재획득 시 3.5초에 걸쳐 표시 위치를 부드럽게 수렴
 *
 * 주의: 안드로이드 앱 코드로 GPS RF 감도 자체를 증폭할 수는 없다.
 * 대신 단말이 제공하는 고정밀 GNSS/Fused/Sensor 데이터를 최대 빈도와 품질판정으로 활용한다.
 */
class NativeNavigationEngine(
    private val context: Context,
    private val listener: Listener
) : SensorEventListener {

    interface Listener {
        fun onNavigationFix(fix: NavigationFix)
        fun onGnssState(state: GnssQuality)
        fun onRouteDeviation(event: RouteDeviation) {}
        /** 위성 신호가 지속적으로 약해져 터널/실내 진입이 의심될 때(및 회복 시) 호출된다. */
        fun onTunnelLikely(active: Boolean) {}
    }

    data class RouteDeviation(
        val rawLat: Double,
        val rawLng: Double,
        val bearing: Float?,
        val speedMps: Float,
        val accuracyM: Float,
        val routeDistanceErrorM: Double,
        val headingDiffDeg: Double,
        val reason: String
    )

    data class NavigationFix(
        val latitude: Double,
        val longitude: Double,
        val rawLatitude: Double,
        val rawLongitude: Double,
        val accuracy: Float,
        val speedMps: Float,
        val bearing: Float?,
        val speedAccuracyMps: Float?,
        val bearingAccuracyDeg: Float?,
        val altitude: Double?,
        val timestamp: Long,
        val provider: String,
        val satelliteCount: Int,
        val satellitesUsed: Int,
        val meanCn0DbHz: Float,
        val estimated: Boolean,
        val routeIndex: Int?,
        val routeDistanceM: Double?,
        val confidence: Float
    ) {
        fun toJson(): JSONObject = JSONObject().apply {
            put("lat", latitude)
            put("lng", longitude)
            put("latitude", latitude)
            put("longitude", longitude)
            put("rawLat", rawLatitude)
            put("rawLng", rawLongitude)
            put("accuracy", accuracy)
            put("speed", speedMps)
            put("speedMps", speedMps)
            put("bearing", bearing ?: JSONObject.NULL)
            put("headingDeg", bearing ?: JSONObject.NULL)
            put("speedAccuracy", speedAccuracyMps ?: JSONObject.NULL)
            put("bearingAccuracy", bearingAccuracyDeg ?: JSONObject.NULL)
            put("altitude", altitude ?: JSONObject.NULL)
            put("timestamp", timestamp)
            put("provider", provider)
            put("satelliteCount", satelliteCount)
            put("satellitesUsed", satellitesUsed)
            put("meanCn0DbHz", meanCn0DbHz)
            put("estimated", estimated)
            put("routeIndex", routeIndex ?: JSONObject.NULL)
            put("routeDistance", routeDistanceM ?: JSONObject.NULL)
            put("confidence", confidence)
        }
    }

    data class GnssQuality(
        val satelliteCount: Int = 0,
        val satellitesUsed: Int = 0,
        val meanCn0DbHz: Float = 0f,
        val strongSatellites: Int = 0,
        val updatedAt: Long = 0L
    )

    private data class RoutePoint(val lng: Double, val lat: Double)
    private data class Projection(
        val lat: Double,
        val lng: Double,
        val index: Int,
        val t: Double,
        val distanceM: Double,
        val bearing: Double,
        val routeDistanceM: Double,
        val score: Double
    )

    private val fused: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)
    private val locationManager =
        context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val sensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val handler = Handler(Looper.getMainLooper())

    private var running = false
    private var navigationActive = false
    private var lastAcceptedReal: Location? = null
    private var lastAcceptedRealAt = 0L
    private var lastOutputAt = 0L
    private var lastReliableSpeed = 0f
    private var lastReliableBearing: Float? = null
    private var lastReliableSpeedAt = 0L
    private var lastReliableLat: Double? = null
    private var lastReliableLng: Double? = null
    private var lastOutputLat: Double? = null
    private var lastOutputLng: Double? = null

    private var gnss = GnssQuality()

    // 최근 신뢰 가능한 속도 이력(약 3초). 터널 진입 직전 마지막 한 점의 노이즈 대신
    // 평균 속도로 dead-reckoning을 시작해 위치 오차를 줄인다.
    private val recentSpeeds = ArrayDeque<Pair<Long, Float>>()
    private var sensorHeading: Float? = null
    private var sensorHeadingAt = 0L
    private var yawRateDegS = 0f
    private var gyroAtNs = 0L

    // 위성 신호 저하(터널/지하 등) 실시간 감지용. 짧은 순간(교량 밑 등)의 흔들림으로
    // 오탐하지 않도록 일정 시간 지속될 때만 상태를 뒤집는다(디바운스).
    private var gnssWeakSince = 0L
    private var tunnelLikelyActive = false

    // 웹(app.js)이 경로 데이터의 "터널" 구간 이름으로 미리 판단한 known-tunnel 여부를
    // 주기적으로(약 700ms 간격) 전달받아 저장한다. 일정 시간 갱신이 없으면 자동 만료된다.
    private var knownTunnelHintActive = false
    private var knownTunnelHintAt = 0L

    private var route = emptyList<RoutePoint>()
    private var routeCum = DoubleArray(0)
    private var lastRouteIndex = 0
    private var lastRouteDistance = 0.0
    private var lastRouteHash = ""
    private var lastDeviationAt = 0L
    private var wrongDirectionHits = 0
    private var offRouteHits = 0
    private var lastCandidateElapsedNs = 0L
    private var stationaryAnchorLat: Double? = null
    private var stationaryAnchorLng: Double? = null
    private var stationarySince = 0L

    private var drActive = false
    private var drStartedAt = 0L
    private var drLastAt = 0L
    private var drLat = 0.0
    private var drLng = 0.0
    private var drRouteDistance = 0.0
    private var drBearing = 0f

    private var reacquireActive = false
    private var reacquireStartedAt = 0L
    private var reacquireFromLat = 0.0
    private var reacquireFromLng = 0.0

    private val fusedRequest: LocationRequest by lazy {
        LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 200L)
            .setMinUpdateIntervalMillis(100L)
            .setMaxUpdateDelayMillis(250L)
            .setMaxUpdateAgeMillis(1_000L)
            .setMinUpdateDistanceMeters(0f)
            .setWaitForAccurateLocation(false)
            .setGranularity(Granularity.GRANULARITY_FINE)
            .build()
    }

    private val fusedCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.locations.forEach { acceptCandidate(it, "fused") }
        }
    }

    private val gpsListener = LocationListener { location ->
        acceptCandidate(location, "gps")
    }

    private val gnssCallback = object : GnssStatus.Callback() {
        override fun onSatelliteStatusChanged(status: GnssStatus) {
            var used = 0
            var strong = 0
            var cn0Sum = 0f
            var cn0Count = 0
            for (i in 0 until status.satelliteCount) {
                val cn0 = status.getCn0DbHz(i)
                if (cn0 > 0) {
                    cn0Sum += cn0
                    cn0Count++
                }
                if (status.usedInFix(i)) used++
                if (cn0 >= 25f) strong++
            }
            val now = System.currentTimeMillis()
            gnss = GnssQuality(
                satelliteCount = status.satelliteCount,
                satellitesUsed = used,
                meanCn0DbHz = if (cn0Count > 0) cn0Sum / cn0Count else 0f,
                strongSatellites = strong,
                updatedAt = now
            )
            listener.onGnssState(gnss)
            updateTunnelLikely(now, used, strong, cn0Count)
        }
    }

    /* 위성 신호가 지속적으로 약해질 때(터널·지하주차장 등 진입 의심) 웹으로 즉시 알린다.
       "GPS 갱신 자체가 끊김"을 기다리는 것보다 훨씬 빠르고, 짧은 순간의 흔들림(교량 아래
       통과 등)으로 오탐하지 않도록 1.5초 이상 지속될 때만 상태를 전환한다(디바운스). */
    private fun updateTunnelLikely(now: Long, used: Int, strong: Int, cn0Count: Int) {
        val weak = used < 4 || strong < 4 || (cn0Count > 0 && gnss.meanCn0DbHz < 20f)
        if (weak) {
            if (gnssWeakSince == 0L) gnssWeakSince = now
            if (!tunnelLikelyActive && now - gnssWeakSince >= 1500L) {
                tunnelLikelyActive = true
                listener.onTunnelLikely(true)
            }
        } else {
            gnssWeakSince = 0L
            if (tunnelLikelyActive) {
                tunnelLikelyActive = false
                listener.onTunnelLikely(false)
            }
        }
    }

    /** app.js가 경로 데이터 기준으로 판단한 "현재 알려진 터널 구간 안" 여부를 전달받는다.
     *  약 700ms 간격으로 계속 갱신되므로, 갱신이 3초 넘게 끊기면 자동으로 만료 처리된다. */
    fun setKnownTunnelActive(active: Boolean) {
        knownTunnelHintActive = active
        knownTunnelHintAt = System.currentTimeMillis()
    }

    private fun isKnownTunnelHintFresh(now: Long) =
        knownTunnelHintActive && now - knownTunnelHintAt <= 3000L

    fun isNavigationActive(): Boolean = navigationActive

    fun setNavigationActive(active: Boolean) {
        navigationActive = active
        if (active) start() else stopDeadReckoningOnly()
    }

    fun updateRoute(json: String?) {
        if (json.isNullOrBlank()) return
        runCatching {
            val arr = JSONArray(json)
            val points = ArrayList<RoutePoint>(arr.length())
            for (i in 0 until arr.length()) {
                val row = arr.optJSONArray(i) ?: continue
                if (row.length() < 2) continue
                val lng = row.optDouble(0, Double.NaN)
                val lat = row.optDouble(1, Double.NaN)
                if (lat.isFinite() && lng.isFinite()) points += RoutePoint(lng, lat)
            }
            if (points.size < 2) return
            val hash = "${points.size}:${points.first().lat}:${points.first().lng}:${points.last().lat}:${points.last().lng}"
            if (hash == lastRouteHash) return
            route = points
            routeCum = DoubleArray(points.size)
            for (i in 1 until points.size) {
                routeCum[i] = routeCum[i - 1] + haversine(
                    points[i - 1].lat, points[i - 1].lng,
                    points[i].lat, points[i].lng
                )
            }
            lastRouteHash = hash
            lastRouteIndex = 0
            lastRouteDistance = 0.0
        }
    }

    @SuppressLint("MissingPermission")
    fun start() {
        if (running || !hasFineLocation()) return
        running = true

        fused.requestLocationUpdates(fusedRequest, fusedCallback, Looper.getMainLooper())
        runCatching {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                200L,
                0f,
                gpsListener,
                Looper.getMainLooper()
            )
        }
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                locationManager.registerGnssStatusCallback(gnssCallback, handler)
            }
        }

        sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
        sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }

        fused.lastLocation.addOnSuccessListener { loc ->
            if (loc != null && System.currentTimeMillis() - loc.time <= 10_000L) {
                acceptCandidate(loc, "fused-last")
            }
        }
        requestSingleFix()
        handler.removeCallbacks(drTicker)
        handler.post(drTicker)
    }

    fun stop() {
        if (!running) return
        running = false
        runCatching { fused.removeLocationUpdates(fusedCallback) }
        runCatching { locationManager.removeUpdates(gpsListener) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            runCatching { locationManager.unregisterGnssStatusCallback(gnssCallback) }
        }
        sensorManager.unregisterListener(this)
        handler.removeCallbacks(drTicker)
        stopDeadReckoningOnly()
    }

    @SuppressLint("MissingPermission")
    fun requestSingleFix() {
        if (!hasFineLocation()) return
        fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { it?.let { loc -> acceptCandidate(loc, "fused-current") } }
    }

    private fun hasFineLocation(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    private fun locationQuality(location: Location): Double {
        val acc = if (location.hasAccuracy()) location.accuracy.toDouble() else 100.0
        val ageMs = abs(System.currentTimeMillis() - location.time).coerceAtMost(30_000L)
        val speedAcc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasSpeedAccuracy()) {
            location.speedAccuracyMetersPerSecond.toDouble()
        } else 2.5
        val bearingAcc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasBearingAccuracy()) {
            location.bearingAccuracyDegrees.toDouble()
        } else 30.0

        var score = 100.0
        score -= min(70.0, acc * 1.25)
        score -= min(12.0, ageMs / 1000.0 * 2.0)
        score -= min(12.0, speedAcc * 2.0)
        score -= min(8.0, bearingAcc / 12.0)
        if (location.provider == LocationManager.GPS_PROVIDER) score += 5.0
        if (gnss.satellitesUsed >= 6) score += 8.0
        if (gnss.meanCn0DbHz >= 28f) score += 6.0
        return score
    }

    private fun isNoisyZeroSpeed(location: Location, derivedSpeed: Float?): Boolean {
        val sensorSpeed = if (location.hasSpeed()) location.speed else Float.NaN
        if (!sensorSpeed.isFinite() || sensorSpeed > 0.15f || lastReliableSpeed < 1.5f) return false

        val speedAcc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasSpeedAccuracy()) {
            location.speedAccuracyMetersPerSecond
        } else null
        val weakSat = gnss.updatedAt > 0 &&
            (gnss.satellitesUsed in 0..4 || gnss.strongSatellites < 4 || gnss.meanCn0DbHz in 0f..20f)
        val poorSpeed = speedAcc != null && speedAcc > 2.2f
        val poorPosition = location.hasAccuracy() && location.accuracy > 22f
        val derivedMoving = derivedSpeed != null && derivedSpeed >= 1.5f
        return weakSat || poorSpeed || (poorPosition && derivedMoving)
    }

    private fun deriveSpeed(previous: Location?, current: Location): Float? {
        previous ?: return null
        val dt = (current.elapsedRealtimeNanos - previous.elapsedRealtimeNanos) / 1_000_000_000.0
        if (dt !in 0.2..5.0) return null
        val distance = previous.distanceTo(current)
        val jitter = max(1.5f, min(6f, ((previous.accuracy + current.accuracy) * 0.16f)))
        return when {
            distance >= jitter -> (distance / dt).toFloat().coerceIn(0f, 70f)
            distance < 1.2f -> 0f
            else -> null
        }
    }

    private fun isImplausibleJump(previous: Location?, current: Location, derivedSpeed: Float?): Boolean {
        previous ?: return false
        val dt = (current.elapsedRealtimeNanos - previous.elapsedRealtimeNanos) / 1_000_000_000.0
        if (dt <= 0.0 || dt > 8.0) return false
        val distance = previous.distanceTo(current).toDouble()
        val implied = distance / dt
        val sensorSpeed = if (current.hasSpeed()) current.speed.toDouble() else (derivedSpeed?.toDouble() ?: 0.0)
        val allowance = max(18.0, sensorSpeed * dt * 3.0 + max(previous.accuracy, current.accuracy) * 1.8)
        return distance > allowance && implied > 55.0 && current.accuracy > 12f
    }

    private fun updateStationaryAnchor(location: Location, speed: Float, now: Long): Pair<Double,Double>? {
        val goodFix = !location.hasAccuracy() || location.accuracy <= 18f
        if (speed <= 0.45f && goodFix) {
            if (stationarySince == 0L) stationarySince = now
            if (stationaryAnchorLat == null || stationaryAnchorLng == null) {
                stationaryAnchorLat = location.latitude
                stationaryAnchorLng = location.longitude
            } else if (now - stationarySince >= 1800L) {
                val d = haversine(stationaryAnchorLat!!, stationaryAnchorLng!!, location.latitude, location.longitude)
                if (d <= 12.0) return stationaryAnchorLat!! to stationaryAnchorLng!!
            }
        } else if (speed >= 1.0f) {
            stationarySince = 0L
            stationaryAnchorLat = null
            stationaryAnchorLng = null
        }
        return null
    }

    private fun acceptCandidate(location: Location, source: String) {
        if (!running) return
        val now = System.currentTimeMillis()
        val prev = lastAcceptedReal
        val derivedSpeed = deriveSpeed(prev, location)
        val noisyZero = isNoisyZeroSpeed(location, derivedSpeed)

        val candidateQuality = locationQuality(location)
        val previousQuality = prev?.let(::locationQuality) ?: -999.0
        val candidateElapsed = location.elapsedRealtimeNanos
        val isFreshEnough = prev == null ||
            candidateElapsed > lastCandidateElapsedNs + 25_000_000L ||
            now - lastAcceptedRealAt > 1200L

        // Fused/GPS가 같은 시각대에 중복으로 들어오면 품질이 낮은 후보를 제거해 위치 튐을 줄인다.
        if (!isFreshEnough && candidateQuality < previousQuality + 6.0) return
        if (isImplausibleJump(prev, location, derivedSpeed)) return
        // ── 터널/지하/고가 아래 등 신호 약화 구간의 '쓰레기 fix' 차단 ─────────────────────
        // 신호가 약해지는 입구에서는 정확도 50~500m짜리 fix(특히 fused 네트워크 위치)가
        // 계속 들어온다. 기존에는 이를 그대로 채택해 (1) 차량이 튀거나 뒤로 가고
        // (2) lastAcceptedRealAt이 계속 갱신돼 dead-reckoning이 시작되지 못해 캐릭터가
        // 멈추거나 끊겼다. 주행 중 위성이 약하면 정확도 낮은 fix는 버리고 DR에 맡긴다.
        val acc = if (location.hasAccuracy()) location.accuracy else 99f
        val silentMs = now - lastAcceptedRealAt
        val knownTunnelNow = isKnownTunnelHintFresh(now)
        val giveUpMs = if (knownTunnelNow) 1_500_000L else if (tunnelLikelyActive) 600_000L else 90_000L
        val gnssFresh = gnss.updatedAt > 0L && now - gnss.updatedAt <= 3000L
        val weakSky = gnssFresh && (gnss.satellitesUsed < 4 || gnss.strongSatellites < 3)
        val weakEnv = tunnelLikelyActive || knownTunnelNow || weakSky || drActive
        val movingNow = lastReliableSpeed >= 1.5f
        if (navigationActive && prev != null && movingNow && silentMs <= giveUpMs) {
            val limit = when {
                drActive -> 25f
                weakEnv -> 30f
                else -> 65f
            }
            if (acc > limit) return
            // DR 중 복귀 첫 fix는 위성이 충분히(5개 이상) 고정된 뒤에만 신뢰한다.
            if (drActive && gnssFresh && gnss.satellitesUsed < 5) return
        }
        if (acc > 120f && prev != null && silentMs < 30_000L) return

        val sensorSpeed = if (location.hasSpeed()) location.speed.coerceAtLeast(0f) else null
        var speed = when {
            noisyZero -> lastReliableSpeed
            sensorSpeed != null && sensorSpeed >= 0.7f && derivedSpeed != null ->
                sensorSpeed * 0.78f + derivedSpeed * 0.22f
            sensorSpeed != null && sensorSpeed >= 0.7f -> sensorSpeed
            derivedSpeed != null && derivedSpeed >= 0.7f -> derivedSpeed
            sensorSpeed != null -> sensorSpeed
            derivedSpeed != null -> derivedSpeed
            else -> lastReliableSpeed
        }.coerceIn(0f, 70f)

        val speedAcc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasSpeedAccuracy()) {
            location.speedAccuracyMetersPerSecond
        } else null
        val bearingAcc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasBearingAccuracy()) {
            location.bearingAccuracyDegrees
        } else null

        val reliablePosition = (!location.hasAccuracy() || location.accuracy <= 35f) &&
            (gnss.updatedAt == 0L || gnss.satellitesUsed >= 4 || gnss.meanCn0DbHz >= 20f)

        val locationBearing = if (location.hasBearing() && speed >= 1.5f) location.bearing else null
        val sensorBearing = sensorHeading?.takeIf { now - sensorHeadingAt <= 1200L }
        val routeBearing = projectToRoute(location.latitude, location.longitude, locationBearing ?: sensorBearing, speed)?.bearing?.toFloat()

        val bearing = when {
            locationBearing != null && (bearingAcc == null || bearingAcc <= 25f) -> locationBearing
            routeBearing != null && speed >= 2f -> routeBearing
            sensorBearing != null -> sensorBearing
            lastReliableBearing != null -> lastReliableBearing
            else -> null
        }

        if (!noisyZero && reliablePosition && (speedAcc == null || speedAcc <= 3.5f)) {
            lastReliableSpeed = speed
            lastReliableSpeedAt = now
            recentSpeeds.addLast(now to speed)
            while (recentSpeeds.isNotEmpty() && now - recentSpeeds.first().first > 3000L) recentSpeeds.removeFirst()
        }
        if (bearing != null && reliablePosition) lastReliableBearing = bearing
        if (reliablePosition) {
            lastReliableLat = location.latitude
            lastReliableLng = location.longitude
        }

        val projection = projectToRoute(location.latitude, location.longitude, bearing, speed)

        if (navigationActive && projection != null && reliablePosition && now - lastDeviationAt >= 1200L) {
            val headingDiff = if (bearing != null && speed >= 1.7f) angleDiff(bearing.toDouble(), projection.bearing) else 0.0
            val accuracyM = if (location.hasAccuracy()) location.accuracy.toDouble() else 25.0
            val offRouteThreshold = max(14.0, min(38.0, accuracyM * 1.35))
            val offRoute = projection.distanceM > offRouteThreshold
            val strongWrongWay = speed >= 3f && headingDiff >= 150.0 && accuracyM <= 18.0
            val wrongWay = speed >= 2.0f && headingDiff >= 115.0 && accuracyM <= 22.0

            offRouteHits = if (offRoute) offRouteHits + 1 else max(0, offRouteHits - 1)
            wrongDirectionHits = if (wrongWay) wrongDirectionHits + 1 else max(0, wrongDirectionHits - 1)

            if (strongWrongWay || offRouteHits >= 3 || wrongDirectionHits >= 3) {
                lastDeviationAt = now
                wrongDirectionHits = 0
                offRouteHits = 0
                listener.onRouteDeviation(
                    RouteDeviation(
                        rawLat = location.latitude,
                        rawLng = location.longitude,
                        bearing = bearing,
                        speedMps = speed,
                        accuracyM = if (location.hasAccuracy()) location.accuracy else 99f,
                        routeDistanceErrorM = projection.distanceM,
                        headingDiffDeg = headingDiff,
                        reason = when {
                            offRoute -> "OFF_ROUTE_CONFIRMED"
                            strongWrongWay -> "OPPOSITE_DIRECTION"
                            else -> "WRONG_DIRECTION"
                        }
                    )
                )
            }
        }

        if (projection != null && projection.distanceM <= max(18.0, min(45.0, location.accuracy.toDouble() * 1.35))) {
            lastRouteIndex = projection.index
            lastRouteDistance = projection.routeDistanceM
        }

        var outLat = location.latitude
        var outLng = location.longitude

        // 안내 중에는 실제 좌표(raw)는 그대로 유지하되 화면 표시 좌표만 경로에 안정적으로 스냅한다.
        // 평행도로 오매칭을 막기 위해 방향/거리/정확도 조건을 동시에 만족할 때만 적용한다.
        if (navigationActive && projection != null) {
            val headingDiff = if (bearing != null && speed >= 2f) angleDiff(bearing.toDouble(), projection.bearing) else 0.0
            val snapLimit = max(12.0, min(34.0, (if (location.hasAccuracy()) location.accuracy else 20f).toDouble() * 1.15))
            if (projection.distanceM <= snapLimit && (speed < 2f || headingDiff <= 65.0)) {
                val accuracyFactor = ((28.0 - (if (location.hasAccuracy()) location.accuracy else 20f)) / 20.0).coerceIn(0.35, 0.92)
                val speedFactor = (speed / 7f).coerceIn(0.35f, 1f).toDouble()
                val alpha = min(0.94, max(0.45, accuracyFactor * speedFactor + 0.28))
                outLat = location.latitude + (projection.lat - location.latitude) * alpha
                outLng = location.longitude + (projection.lng - location.longitude) * alpha
            }
        }

        updateStationaryAnchor(location, speed, now)?.let { anchor ->
            if (!navigationActive || projection == null || projection.distanceM > 20.0) {
                outLat = anchor.first
                outLng = anchor.second
                speed = 0f
            }
        }

        // DR 후 실제 GNSS 재획득: 표시 좌표만 부드럽게 실측점으로 수렴.
        // raw 좌표는 별도로 유지하여 웹 경로이탈 판정은 실제 좌표를 사용할 수 있게 보존.
        if (drActive) {
            reacquireActive = true
            reacquireStartedAt = now
            reacquireFromLat = drLat
            reacquireFromLng = drLng
            drActive = false
        }
        if (reacquireActive) {
            val alpha = ((now - reacquireStartedAt).toDouble() / 3500.0).coerceIn(0.0, 1.0)
            val eased = 1.0 - (1.0 - alpha).pow(3.0)
            outLat = reacquireFromLat + (location.latitude - reacquireFromLat) * eased
            outLng = reacquireFromLng + (location.longitude - reacquireFromLng) * eased
            if (alpha >= 1.0 || haversine(outLat, outLng, location.latitude, location.longitude) < 2.5) {
                reacquireActive = false
                outLat = location.latitude
                outLng = location.longitude
            }
        }

        lastAcceptedReal = Location(location)
        lastAcceptedRealAt = now
        lastCandidateElapsedNs = max(lastCandidateElapsedNs, location.elapsedRealtimeNanos)
        lastOutputAt = now
        lastOutputLat = outLat
        lastOutputLng = outLng

        val routeConfidence = when {
            projection == null -> 0.0
            projection.distanceM < 8.0 -> 0.30
            projection.distanceM < 18.0 -> 0.22
            projection.distanceM < 30.0 -> 0.12
            else -> 0.0
        }
        val satelliteConfidence = when {
            gnss.satellitesUsed >= 10 && gnss.meanCn0DbHz >= 30f -> 0.20
            gnss.satellitesUsed >= 6 -> 0.15
            gnss.satellitesUsed >= 4 -> 0.08
            else -> 0.0
        }
        val confidence = (
            (candidateQuality.coerceIn(0.0,100.0) / 100.0) * 0.50 + routeConfidence + satelliteConfidence
            ).coerceIn(0.0, 1.0).toFloat()

        listener.onNavigationFix(
            NavigationFix(
                latitude = outLat,
                longitude = outLng,
                rawLatitude = location.latitude,
                rawLongitude = location.longitude,
                accuracy = if (location.hasAccuracy()) location.accuracy else 99f,
                speedMps = speed,
                bearing = bearing,
                speedAccuracyMps = speedAcc,
                bearingAccuracyDeg = bearingAcc,
                altitude = if (location.hasAltitude()) location.altitude else null,
                timestamp = location.time.takeIf { it > 0 } ?: now,
                provider = "native-$source",
                satelliteCount = gnss.satelliteCount,
                satellitesUsed = gnss.satellitesUsed,
                meanCn0DbHz = gnss.meanCn0DbHz,
                estimated = false,
                routeIndex = projection?.index,
                routeDistanceM = projection?.routeDistanceM,
                confidence = confidence
            )
        )
    }

    private val drTicker = object : Runnable {
        override fun run() {
            if (!running) return
            deadReckoningTick()
            handler.postDelayed(this, 200L)
        }
    }

    private fun deadReckoningTick() {
        if (!navigationActive) return
        val now = System.currentTimeMillis()
        // app.js가 경로상의 "터널" 이름 구간을 근거로 알려온 경우, 짧은(90초) 기본 상한 대신
        // 웹 쪽 장거리 터널 허용치(최대 25분)와 동일하게 늘려 긴 터널에서 도중에 멈추지 않게 한다.
        val knownTunnel = isKnownTunnelHintFresh(now)
        val maxGapMs = if (knownTunnel) 1_500_000L else if (tunnelLikelyActive) 600_000L else 90_000L
        val decelTailMs = 4_000L
        val gap = now - lastAcceptedRealAt
        // 실측 GPS가 끊긴 직후, dead-reckoning이 시작되기 전까지는 어떤 위치도 내보내지
        // 않아 캐릭터가 그대로 멈춰 보이는 구간이 있었다(터널 진입 시 특히 체감됨).
        // 이 유예시간을 기존 1500ms에서 500ms로 줄여 화면이 얼어붙는 시간을 최소화한다.
        // (fused 위치요청 주기가 100~250ms이므로 500ms는 평상시 정상적인 간헐적 지연으로는
        // 거의 도달하지 않아, 순간적인 흔들림에 DR이 과민 반응할 위험은 낮다.)
        val drStartGapMs = 500L
        if (lastAcceptedRealAt <= 0L || gap < drStartGapMs || gap > maxGapMs) {
            if (gap > maxGapMs) stopDeadReckoningOnly()
            return
        }
        // DR 시작 시점에 한 번만 최근 3초 평균 속도로 기준 속도를 잡는다(노이즈 완화).
        if (!drActive && recentSpeeds.isNotEmpty()) {
            lastReliableSpeed = recentSpeeds.map { it.second }.average().toFloat().coerceAtLeast(0f)
        }
        val speed = lastReliableSpeed
        if (speed < 0.7f) return

        if (!drActive) {
            val lat = lastOutputLat ?: lastReliableLat ?: return
            val lng = lastOutputLng ?: lastReliableLng ?: return
            drActive = true
            drStartedAt = now
            drLastAt = now
            drLat = lat
            drLng = lng
            drBearing = lastReliableBearing ?: sensorHeading ?: 0f
            drRouteDistance = lastRouteDistance
        }

        val dt = ((now - drLastAt).coerceIn(50L, 500L)) / 1000.0
        drLastAt = now

        val sensorH = sensorHeading?.takeIf { now - sensorHeadingAt <= 1200L }
        val heading = when {
            route.size >= 2 -> bearingAtRouteDistance(drRouteDistance).toFloat()
            sensorH != null -> circularLerp(drBearing, sensorH, 0.18f)
            else -> (drBearing + yawRateDegS * dt.toFloat() + 360f) % 360f
        }
        drBearing = heading

        var routeIdx: Int? = null
        var routeDist: Double? = null

        if (route.size >= 2 && routeCum.isNotEmpty()) {
            drRouteDistance = (drRouteDistance + speed * dt).coerceAtMost(routeCum.last())
            val p = pointAtRouteDistance(drRouteDistance)
            if (p != null) {
                drLat = p.lat
                drLng = p.lng
                drBearing = p.bearing.toFloat()
                routeIdx = p.index
                routeDist = p.routeDistanceM
                lastRouteIndex = p.index
                lastRouteDistance = p.routeDistanceM
            }
        } else {
            val p = projectForward(drLat, drLng, drBearing.toDouble(), speed.toDouble() * dt)
            drLat = p.first
            drLng = p.second
        }

        // 상한(maxGapMs) 끝부분에서 서서히 감속시키며 갑작스런 정지 방지.
        val life = now - drStartedAt
        val decelStartMs = maxGapMs - decelTailMs
        val outputSpeed = if (life > decelStartMs) {
            speed * ((maxGapMs - life).coerceAtLeast(0L) / decelTailMs.toFloat())
        } else speed

        lastOutputAt = now
        lastOutputLat = drLat
        lastOutputLng = drLng

        listener.onNavigationFix(
            NavigationFix(
                latitude = drLat,
                longitude = drLng,
                rawLatitude = lastReliableLat ?: drLat,
                rawLongitude = lastReliableLng ?: drLng,
                accuracy = 35f + min(80f, gap / 1000f),
                speedMps = outputSpeed.coerceAtLeast(0f),
                bearing = drBearing,
                speedAccuracyMps = null,
                bearingAccuracyDeg = null,
                altitude = null,
                timestamp = now,
                provider = "native-dead-reckoning",
                satelliteCount = gnss.satelliteCount,
                satellitesUsed = gnss.satellitesUsed,
                meanCn0DbHz = gnss.meanCn0DbHz,
                estimated = true,
                routeIndex = routeIdx,
                routeDistanceM = routeDist,
                confidence = (0.75f - gap / 120_000f).coerceIn(0.15f, 0.75f)
            )
        )
    }

    private fun stopDeadReckoningOnly() {
        drActive = false
        reacquireActive = false
    }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR -> {
                val rotation = FloatArray(9)
                val orientation = FloatArray(3)
                SensorManager.getRotationMatrixFromVector(rotation, event.values)
                SensorManager.getOrientation(rotation, orientation)
                var azimuth = Math.toDegrees(orientation[0].toDouble()).toFloat()
                if (azimuth < 0) azimuth += 360f
                sensorHeading = if (sensorHeading == null) azimuth else circularLerp(sensorHeading!!, azimuth, 0.16f)
                sensorHeadingAt = System.currentTimeMillis()
            }
            Sensor.TYPE_GYROSCOPE -> {
                if (gyroAtNs > 0L) {
                    val dt = (event.timestamp - gyroAtNs) / 1_000_000_000f
                    if (dt in 0f..1f) {
                        // z축 회전(rad/s)을 deg/s로 저역통과
                        val zDegS = Math.toDegrees(event.values[2].toDouble()).toFloat()
                        yawRateDegS = yawRateDegS * 0.72f + zDegS * 0.28f
                    }
                }
                gyroAtNs = event.timestamp
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun projectToRoute(lat: Double, lng: Double, heading: Float?, speed: Float): Projection? {
        if (route.size < 2 || routeCum.isEmpty()) return null
        val centers = intArrayOf(lastRouteIndex.coerceIn(1, route.lastIndex), coarseNearestIndex(lat, lng).coerceAtLeast(1))
        var best: Projection? = null
        for (center in centers) {
            val lo = max(1, center - 120)
            val hi = min(route.lastIndex, center + 180)
            for (i in lo..hi) {
                val p0 = route[i - 1]
                val p1 = route[i]
                val proj = projectToSegment(lat, lng, p0, p1)
                val d = haversine(lat, lng, proj.first, proj.second)
                if (d > 90.0) continue
                val segBearing = bearing(p0.lat, p0.lng, p1.lat, p1.lng)
                val headingDiff = if (heading != null && speed > 2f) angleDiff(heading.toDouble(), segBearing) else 0.0
                val directionPenalty = when {
                    speed <= 2f -> 0.0
                    headingDiff >= 145 -> 110.0
                    headingDiff >= 110 -> 55.0
                    headingDiff >= 75 -> 18.0
                    else -> headingDiff / 15.0
                }
                val routeDist = routeCum[i - 1] + (routeCum[i] - routeCum[i - 1]) * proj.third
                val backwardsPenalty = if (navigationActive && routeDist < lastRouteDistance - 20.0) 45.0 else 0.0
                val score = d + directionPenalty + backwardsPenalty
                if (best == null || score < best!!.score) {
                    best = Projection(
                        lat = proj.first,
                        lng = proj.second,
                        index = i,
                        t = proj.third,
                        distanceM = d,
                        bearing = segBearing,
                        routeDistanceM = routeDist,
                        score = score
                    )
                }
            }
        }
        return best
    }

    private fun coarseNearestIndex(lat: Double, lng: Double): Int {
        if (route.isEmpty()) return 0
        val stride = max(1, route.size / 1000)
        var best = 0
        var bestD = Double.MAX_VALUE
        var i = 0
        while (i < route.size) {
            val p = route[i]
            val dx = (p.lng - lng) * cos(Math.toRadians(lat))
            val dy = p.lat - lat
            val d = dx * dx + dy * dy
            if (d < bestD) {
                bestD = d
                best = i
            }
            i += stride
        }
        return best
    }

    private fun pointAtRouteDistance(distance: Double): Projection? {
        if (route.size < 2 || routeCum.isEmpty()) return null
        val target = distance.coerceIn(0.0, routeCum.last())
        var lo = 1
        var hi = route.lastIndex
        while (lo < hi) {
            val mid = (lo + hi) ushr 1
            if (routeCum[mid] < target) lo = mid + 1 else hi = mid
        }
        val i = lo.coerceIn(1, route.lastIndex)
        val a = routeCum[i - 1]
        val b = routeCum[i]
        val t = if (b > a) (target - a) / (b - a) else 0.0
        val p0 = route[i - 1]
        val p1 = route[i]
        return Projection(
            lat = p0.lat + (p1.lat - p0.lat) * t,
            lng = p0.lng + (p1.lng - p0.lng) * t,
            index = i,
            t = t,
            distanceM = 0.0,
            bearing = bearing(p0.lat, p0.lng, p1.lat, p1.lng),
            routeDistanceM = target,
            score = 0.0
        )
    }

    private fun bearingAtRouteDistance(distance: Double): Double =
        pointAtRouteDistance(distance)?.bearing ?: (lastReliableBearing?.toDouble() ?: 0.0)

    private fun projectToSegment(
        lat: Double,
        lng: Double,
        p0: RoutePoint,
        p1: RoutePoint
    ): Triple<Double, Double, Double> {
        val kx = max(0.2, cos(Math.toRadians(lat)))
        val x0 = p0.lng * kx
        val y0 = p0.lat
        val x1 = p1.lng * kx
        val y1 = p1.lat
        val x = lng * kx
        val y = lat
        val dx = x1 - x0
        val dy = y1 - y0
        val len2 = dx * dx + dy * dy
        val t = if (len2 > 0) (((x - x0) * dx + (y - y0) * dy) / len2).coerceIn(0.0, 1.0) else 0.0
        return Triple(y0 + dy * t, (x0 + dx * t) / kx, t)
    }

    private fun projectForward(lat: Double, lng: Double, heading: Double, distanceM: Double): Pair<Double, Double> {
        val r = 6_371_000.0
        val rad = Math.toRadians(heading)
        val dLat = Math.toDegrees(distanceM * cos(rad) / r)
        val dLng = Math.toDegrees(distanceM * sin(rad) / (r * cos(Math.toRadians(lat)).coerceAtLeast(0.2)))
        return Pair(lat + dLat, lng + dLng)
    }

    private fun circularLerp(a: Float, b: Float, t: Float): Float {
        val diff = ((b - a + 540f) % 360f) - 180f
        return (a + diff * t.coerceIn(0f, 1f) + 360f) % 360f
    }

    private fun angleDiff(a: Double, b: Double): Double =
        abs(((a - b + 540.0) % 360.0) - 180.0)

    private fun bearing(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val p1 = Math.toRadians(lat1)
        val p2 = Math.toRadians(lat2)
        val dl = Math.toRadians(lon2 - lon1)
        val y = sin(dl) * cos(p2)
        val x = cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dl)
        return (Math.toDegrees(atan2(y, x)) + 360.0) % 360.0
    }

    private fun haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6_371_000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
        return 2 * r * asin(sqrt(a))
    }
}
