package com.komsco.jofams.smartdrive

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.*

/**
 * 주행 중 화면/안전/음성 안내를 웹 JavaScript가 아닌 Kotlin에서 계산하는 엔진.
 *
 * 입력: route geometry, guides, roadSegments, safetyEvents, destination
 * 출력: NativeDriveSnapshot
 */
class NativeGuidanceEngine(
    private val listener: Listener
) {
    interface Listener {
        fun onSnapshot(snapshot: NativeDriveSnapshot)
        fun onVoice(text: String)
    }

    data class Point(val lng: Double, val lat: Double)

    data class Guide(
        val routeIndex: Int,
        val type: Int,
        val guidance: String,
        val name: String,
        val roadName: String
    )

    data class RoadSegment(
        val startIndex: Int,
        val endIndex: Int,
        val name: String,
        val speedLimit: Int,
        val trafficSpeed: Int
    )

    data class SafetyEvent(
        val id: String,
        val type: String,
        val routeIndex: Int,
        val endRouteIndex: Int?,
        val name: String,
        val roadName: String,
        val maxSpeed: Int,
        val lat: Double?,
        val lng: Double?,
        val sectionPosition: String? = null,
        val sectionLengthMeters: Double? = null,
        // 경로 정점(routeIndex) 사이 보간된 정밀 누적거리(m). 카메라를 경로에 스냅할 때
        // 계산 가능하면 채워지며, 있으면 정수 정점 단위보다 더 정밀한 거리 안내에 쓰인다.
        val routeDistanceM: Double? = null
    )

    data class NativeDriveSnapshot(
        val speedKmh: Int = 0,
        val speedLimitKmh: Int = 0,
        val roadName: String = "",
        val remainingDistanceM: Double = 0.0,
        val remainingSeconds: Double = 0.0,
        val etaText: String = "",
        val nextManeuverDistanceM: Double? = null,
        val nextManeuverType: Int? = null,
        val nextManeuverText: String = "",
        val safetyType: String? = null,
        val safetyDistanceM: Double? = null,
        val safetyText: String = "",
        val sectionAverageKmh: Int? = null,
        val sectionLimitKmh: Int? = null,
        val sectionRemainingM: Double? = null,
        val route: List<Point> = emptyList(),
        val routeDistanceM: Double = 0.0,
        val currentRouteIndex: Int = 0,
        val heading: Float = 0f,
        val latitude: Double = 0.0,
        val longitude: Double = 0.0,
        val estimated: Boolean = false,
        val gpsAccuracyM: Float = 0f,
        val satelliteCount: Int = 0,
        val satellitesUsed: Int = 0
    )

    private var geometry = emptyList<Point>()
    private var cumulative = DoubleArray(0)
    private var guides = emptyList<Guide>()
    private var roads = emptyList<RoadSegment>()
    private var safety = emptyList<SafetyEvent>()
    private var routeDurationSec = 0.0
    private var routeDistanceMeters = 0.0
    private var destinationName = "목적지"

    private var lastVoiceKey = ""
    private var lastVoiceAt = 0L
    private var sectionId: String? = null
    private var sectionEnteredAt = 0L
    private var sectionEnteredDistance = 0.0
    private var lastSectionVoiceAt = 0L
    private var lastSectionEndVoiceKey = ""
    private var lastSpeedLimit = 0
    private var lastSpeedLimitSourceIndex = -1
    private var variableSpeedLimit: Int? = null
    private var variableSpeedRoadName: String? = null

    // 주기적인 안전정보 갱신(약 20초/500m 마다) 사이에 서버 응답이 일시적으로 현재
    // 진입해 있는 구간단속 항목을 포함하지 않게 되더라도, 실제로는 여전히 그 구간
    // 안을 달리고 있는 경우가 흔하다(반경 컷오프, 타이밍 등). 이 때문에 화면에서
    // 구간단속 표시가 중간에 사라지는 문제를 막기 위해 마지막으로 확인된 활성
    // 구간을 별도로 "래치"해서 유지한다.
    private var lockedSection: SafetyEvent? = null

    fun clear() {
        geometry = emptyList()
        cumulative = DoubleArray(0)
        guides = emptyList()
        roads = emptyList()
        safety = emptyList()
        routeDurationSec = 0.0
        routeDistanceMeters = 0.0
        sectionId = null
        lastSectionEndVoiceKey = ""
        lockedSection = null
    }

    fun updateNavigationState(json: String?) {
        if (json.isNullOrBlank()) return
        runCatching {
            val root = JSONObject(json)
            val route = root.optJSONObject("route") ?: root

            val g = parseGeometry(route.optJSONArray("geometry"))
            if (g.size >= 2) {
                geometry = g
                cumulative = buildCumulative(g)
                routeDistanceMeters = route.optDouble("distance", cumulative.lastOrNull() ?: 0.0)
                if (routeDistanceMeters <= 0.0 && cumulative.isNotEmpty()) routeDistanceMeters = cumulative.last()
                routeDurationSec = route.optDouble("duration", 0.0)
                // 새 경로(최초 진입 또는 재탐색)가 적용되면 이전 경로의 정점 인덱스를 참조하던
                // 래치된 구간단속 정보는 더 이상 유효하지 않으므로 초기화한다.
                lockedSection = null
            }

            guides = parseGuides(route.optJSONArray("guides"))
            roads = parseRoadSegments(route.optJSONArray("roadSegments"))
            safety = parseSafety(root.optJSONArray("safetyEvents") ?: route.optJSONArray("safetyEvents"))
            destinationName = root.optJSONObject("destination")?.optString("name").orEmpty().ifBlank { "목적지" }
        }
    }

    fun setSafetyEvents(events: List<SafetyEvent>) {
        safety = events.sortedBy { it.routeIndex }
    }

    fun setVariableSpeedLimit(limit: Int?, roadName: String?) {
        variableSpeedLimit = limit?.takeIf { it in 10..130 }
        variableSpeedRoadName = roadName
    }

    fun routePoints(): List<Point> = geometry

    fun onFix(fix: NativeNavigationEngine.NavigationFix) {
        if (geometry.size < 2 || cumulative.isEmpty()) return
        val routeDistance = fix.routeDistanceM ?: nearestRouteDistance(fix.latitude, fix.longitude, fix.bearing, fix.speedMps)
        val idx = fix.routeIndex ?: indexAtRouteDistance(routeDistance)
        latestIdx = idx
        // 정수 경로 정점(idx)이 아니라, 정점 사이를 보간한 연속 누적거리(routeDistance)를
        // "현재 위치" 기준으로 저장해 안내/카메라까지 남은 거리 계산의 정밀도를 높인다.
        latestRouteDistanceM = routeDistance
        val total = cumulative.lastOrNull() ?: routeDistanceMeters
        val remaining = max(0.0, total - routeDistance)
        val ratio = if (total > 1.0) (remaining / total).coerceIn(0.0, 1.0) else 0.0
        val remainSec = routeDurationSec * ratio

        val road = roads.firstOrNull { idx in it.startIndex..it.endIndex }
        val speedLimit = resolveSpeedLimit(idx, road)
        val nextGuide = guides.firstOrNull { it.routeIndex > idx && distanceFromCurrent(it.routeIndex) >= 10.0 }
        val nextDistance = nextGuide?.let { distanceFromCurrent(it.routeIndex) }

        val safetyCandidate = nextSafety(idx)
        val section = activeSection(idx)
        val sectionAverage = updateSectionAverage(section, routeDistance, fix.speedMps)

        maybeSpeakGuide(nextGuide, nextDistance, fix.speedMps)
        maybeSpeakSafety(safetyCandidate)
        maybeSpeakSection(section, sectionAverage)

        val now = System.currentTimeMillis()
        val etaMillis = now + (remainSec * 1000).toLong()
        val eta = java.text.SimpleDateFormat("HH:mm", java.util.Locale.KOREA)
            .format(java.util.Date(etaMillis))

        listener.onSnapshot(
            NativeDriveSnapshot(
                speedKmh = (fix.speedMps * 3.6f).roundToInt().coerceAtLeast(0),
                speedLimitKmh = speedLimit,
                roadName = road?.name.orEmpty().ifBlank { "현재 도로" },
                remainingDistanceM = remaining,
                remainingSeconds = remainSec,
                etaText = eta,
                nextManeuverDistanceM = nextDistance,
                nextManeuverType = nextGuide?.type,
                nextManeuverText = nextGuide?.let(::guideText).orEmpty(),
                safetyType = safetyCandidate?.type,
                safetyDistanceM = safetyCandidate?.let { distanceFromCurrent(it) },
                safetyText = safetyCandidate?.let(::safetyText).orEmpty(),
                sectionAverageKmh = sectionAverage?.first,
                sectionLimitKmh = sectionAverage?.second,
                sectionRemainingM = section?.endRouteIndex?.let { max(0.0, distanceFromCurrent(it)) },
                route = geometry,
                routeDistanceM = routeDistance,
                currentRouteIndex = idx,
                heading = fix.bearing ?: 0f,
                latitude = fix.latitude,
                longitude = fix.longitude,
                estimated = fix.estimated,
                gpsAccuracyM = fix.accuracy,
                satelliteCount = fix.satelliteCount,
                satellitesUsed = fix.satellitesUsed
            )
        )
    }

    private fun resolveSpeedLimit(idx: Int, road: RoadSegment?): Int {
        val direct = road?.speedLimit?.takeIf { it in 10..130 }
        if (direct != null) {
            lastSpeedLimit = direct
            lastSpeedLimitSourceIndex = idx
            return direct
        }

        val vsl = variableSpeedLimit
        val vslRoad = variableSpeedRoadName.orEmpty().replace(" ","").lowercase()
        val roadName = road?.name.orEmpty().replace(" ","").lowercase()
        val vslMatches = vslRoad.isBlank() || roadName.isBlank() || vslRoad==roadName || vslRoad.contains(roadName) || roadName.contains(vslRoad)
        if (vsl != null && vslMatches) {
            lastSpeedLimit = vsl
            lastSpeedLimitSourceIndex = idx
            return vsl
        }

        val camera = safety
            .asSequence()
            .filter { it.maxSpeed in 10..130 }
            .filter { it.type in setOf("speed_limit", "speed_camera", "signal_speed_camera", "section_speed_camera") }
            .map { it to abs(it.routeIndex - idx) }
            .filter { (_, d) -> d <= 10 }
            .minByOrNull { (_, d) -> d }
            ?.first

        if (camera != null) {
            lastSpeedLimit = camera.maxSpeed
            lastSpeedLimitSourceIndex = idx
            return camera.maxSpeed
        }

        // 이전 도로의 제한속도를 너무 오래 끌고 가지 않도록 30 route-index 이상 이동 시 해제
        return if (lastSpeedLimit > 0 && abs(idx - lastSpeedLimitSourceIndex) <= 30) lastSpeedLimit else 0
    }

    private fun nextSafety(idx: Int): SafetyEvent? {
        return safety.asSequence()
            // 정점 인덱스 기준 사전 필터는 넉넉하게(-1) 잡는다: 보간된 연속 위치가 정점
            // 경계 바로 앞일 때 실제로는 아직 전방인 이벤트가 제외되지 않도록 하기 위함.
            .filter { it.routeIndex >= idx - 1 }
            .map { it to distanceFromCurrent(it) }
            .filter { (_, d) -> d in 0.0..1200.0 }
            .minByOrNull { (_, d) -> d }
            ?.first
    }

    private fun activeSection(idx: Int): SafetyEvent? {
        val fresh = safety.firstOrNull {
            it.type == "section_speed_camera" &&
                it.endRouteIndex != null &&
                idx in it.routeIndex..it.endRouteIndex
        }
        if (fresh != null) {
            lockedSection = fresh
            return fresh
        }
        // 최신 목록에 없더라도, 차량이 여전히 마지막으로 확인된 구간의 시작~종료 범위
        // 안에 있다면 그 구간을 계속 활성 상태로 유지한다(갱신 주기 사이 순간적 누락 방지).
        val locked = lockedSection
        if (locked?.endRouteIndex != null && idx in locked.routeIndex..locked.endRouteIndex) {
            return locked
        }
        lockedSection = null
        return null
    }

    private fun updateSectionAverage(
        section: SafetyEvent?,
        routeDistance: Double,
        speedMps: Float
    ): Pair<Int, Int>? {
        if (section == null) {
            sectionId = null
            return null
        }

        val now = System.currentTimeMillis()
        if (sectionId != section.id) {
            sectionId = section.id
            sectionEnteredAt = now
            sectionEnteredDistance = routeDistance
            lastSectionVoiceAt = 0L
        }

        val elapsed = max(1.0, (now - sectionEnteredAt) / 1000.0)
        val travelled = max(0.0, routeDistance - sectionEnteredDistance)
        val avg = (travelled / elapsed * 3.6).roundToInt().coerceIn(0, 250)
        return avg to section.maxSpeed.coerceAtLeast(0)
    }

    private fun maybeSpeakGuide(g: Guide?, d: Double?, speedMps: Float) {
        if (g == null || d == null || d < 6.0) return
        val speedKmh = speedMps * 3.6
        val complex = g.type in setOf(7,8,9,10,11,12,42,43,44,45,46,47,48,49)
        val farTrigger = when {
            complex && speedKmh >= 80 -> 650.0
            complex && speedKmh >= 55 -> 500.0
            complex -> 380.0
            speedKmh >= 80 -> 400.0
            speedKmh >= 55 -> 300.0
            else -> 220.0
        }
        if (d > farTrigger) return

        // 주행속도와 남은 거리에 따라 2~3단계 음성안내를 하되, 같은 단계는 한 번만 안내한다.
        val nearTrigger = max(70.0, speedMps * 5.0)
        val immediateTrigger = max(28.0, speedMps * 2.2)
        val phase = when {
            d <= immediateTrigger -> "now"
            d <= nearTrigger -> "near"
            else -> "far"
        }
        val key = "guide:${g.routeIndex}:${g.type}:$phase"
        val rounded = when {
            d < 60 -> (d / 5).roundToInt() * 5
            d < 150 -> (d / 10).roundToInt() * 10
            else -> (d / 50).roundToInt() * 50
        }
        val meters = max(10, rounded)
        val target = g.name.ifBlank { g.roadName }.trim()
        val text = if (phase == "now") {
            when (g.type) {
                9,12,44,47,49 -> "곧 오른쪽으로 빠져 이동하세요.${if(target.isNotBlank()) " $target" else ""}"
                8,11,43,46,48 -> "곧 왼쪽으로 빠져 이동하세요.${if(target.isNotBlank()) " $target" else ""}"
                1 -> "곧 좌회전입니다."
                2 -> "곧 우회전입니다."
                3 -> "곧 유턴입니다."
                else -> "곧 ${guideText(g)}"
            }
        } else {
            when (g.type) {
                9,12,44,47,49 -> "${meters}미터 앞 오른쪽으로 빠져 이동하세요.${if(target.isNotBlank()) " $target" else ""}"
                8,11,43,46,48 -> "${meters}미터 앞 왼쪽으로 빠져 이동하세요.${if(target.isNotBlank()) " $target" else ""}"
                1 -> "${meters}미터 앞 좌회전입니다."
                2 -> "${meters}미터 앞 우회전입니다."
                3 -> "${meters}미터 앞 유턴입니다."
                else -> "${meters}미터 앞 ${guideText(g)}"
            }
        }
        speakOnce(key, text, if (phase == "now") 2200L else 4000L)
    }

    private fun maybeSpeakSafety(e: SafetyEvent?) {
        e ?: return
        val d = distanceFromCurrent(e)
        if (d !in 20.0..650.0) return
        val trigger = when {
            d <= 120 -> "near"
            d <= 300 -> "mid"
            else -> "far"
        }
        val key = "safety:${e.id}:$trigger"
        val meters = if (d < 100) (d / 10).roundToInt() * 10 else (d / 50).roundToInt() * 50
        val text = when (e.type) {
            "section_speed_camera" -> "${max(10,meters)}미터 앞 구간단속 시작입니다.${if(e.maxSpeed>0) " 제한속도 ${e.maxSpeed}킬로미터입니다." else ""}"
            "signal_camera","signal_speed_camera" -> "${max(10,meters)}미터 앞 신호·과속 단속카메라입니다."
            "bus_lane_camera" -> "${max(10,meters)}미터 앞 버스전용차로 단속입니다."
            else -> "${max(10,meters)}미터 앞 단속카메라입니다.${if(e.maxSpeed>0) " 제한속도 ${e.maxSpeed}킬로미터입니다." else ""}"
        }
        speakOnce(key, text, 8000L)
    }

    private fun maybeSpeakSection(section: SafetyEvent?, avgPair: Pair<Int, Int>?) {
        if (section == null || avgPair == null) return
        val endIdx = section.endRouteIndex
        if (endIdx != null) {
            val remain = max(0.0, distanceFromCurrent(endIdx))
            if (remain <= 130.0) {
                val key = "section-end:${section.id}"
                if (lastSectionEndVoiceKey != key) {
                    lastSectionEndVoiceKey = key
                    listener.onVoice("곧 구간단속이 종료됩니다.")
                    return
                }
            }
        }
        val now = System.currentTimeMillis()
        if (now - sectionEnteredAt < 30_000L) return
        if (lastSectionVoiceAt > 0L && now - lastSectionVoiceAt < 60_000L) return
        lastSectionVoiceAt = now
        val avg = avgPair.first
        val limit = avgPair.second
        val over = limit > 0 && avg > limit
        listener.onVoice(
            "현재 구간 평균속도는 ${avg}킬로미터입니다." +
                if (over) " 제한속도를 초과했습니다. 감속하세요." else ""
        )
    }

    private var latestIdx = 0
    private var latestRouteDistanceM = 0.0

    private fun speakOnce(key: String, text: String, minGap: Long) {
        val now = System.currentTimeMillis()
        if (key == lastVoiceKey && now - lastVoiceAt < 30_000L) return
        if (now - lastVoiceAt < minGap) return
        lastVoiceKey = key
        lastVoiceAt = now
        listener.onVoice(text)
    }

    private fun guideText(g: Guide): String {
        val raw = g.guidance.ifBlank { g.name }.ifBlank { g.roadName }
        if (raw.isNotBlank()) return raw
        return when (g.type) {
            1 -> "좌회전"
            2 -> "우회전"
            3 -> "유턴"
            8,11,43,46,48 -> "왼쪽 진출입"
            9,12,44,47,49 -> "오른쪽 진출입"
            7,10,42,45 -> "진출입"
            84,85,300 -> "톨게이트"
            else -> "경로 안내"
        }
    }

    private fun safetyText(e: SafetyEvent): String = when (e.type) {
        "section_speed_camera" -> "구간단속${if (e.maxSpeed > 0) " ${e.maxSpeed}" else ""}"
        "signal_camera","signal_speed_camera" -> "신호·과속"
        "bus_lane_camera" -> "버스전용"
        "mobile_camera" -> "이동식 단속"
        "school_zone" -> "어린이보호구역"
        "speed_limit" -> "제한속도 ${e.maxSpeed}"
        else -> "단속카메라${if (e.maxSpeed > 0) " ${e.maxSpeed}" else ""}"
    }

    private fun parseGeometry(arr: JSONArray?): List<Point> {
        if (arr == null) return emptyList()
        val out = ArrayList<Point>(arr.length())
        for (i in 0 until arr.length()) {
            val p = arr.optJSONArray(i) ?: continue
            val lng = p.optDouble(0, Double.NaN)
            val lat = p.optDouble(1, Double.NaN)
            if (lng.isFinite() && lat.isFinite()) out += Point(lng, lat)
        }
        return out
    }

    private fun parseGuides(arr: JSONArray?): List<Guide> {
        if (arr == null) return emptyList()
        val out = ArrayList<Guide>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val ri = o.optInt("routeIndex", -1)
            if (ri < 0) continue
            out += Guide(
                routeIndex = ri,
                type = o.optInt("type", 0),
                guidance = o.optString("guidance"),
                name = o.optString("name"),
                roadName = o.optString("roadName")
            )
        }
        return out.sortedBy { it.routeIndex }
    }

    private fun parseRoadSegments(arr: JSONArray?): List<RoadSegment> {
        if (arr == null) return emptyList()
        val out = ArrayList<RoadSegment>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val s = o.optInt("startIndex", -1)
            val e = o.optInt("endIndex", -1)
            if (s < 0 || e < s) continue
            out += RoadSegment(
                startIndex = s,
                endIndex = e,
                name = o.optString("name"),
                speedLimit = o.optInt("speedLimit", 0),
                trafficSpeed = o.optInt("trafficSpeed", 0)
            )
        }
        return out
    }

    private fun parseSafety(arr: JSONArray?): List<SafetyEvent> {
        if (arr == null) return emptyList()
        val out = ArrayList<SafetyEvent>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val ri = o.optInt("routeIndex", -1)
            if (ri < 0) continue
            val end = if (o.has("endRouteIndex") && !o.isNull("endRouteIndex")) o.optInt("endRouteIndex") else null
            out += SafetyEvent(
                id = o.optString("id", "safety-$i"),
                type = o.optString("type"),
                routeIndex = ri,
                endRouteIndex = end,
                name = o.optString("name"),
                roadName = o.optString("roadName"),
                maxSpeed = o.optInt("maxspeed", o.optInt("speedLimit", 0)),
                lat = o.optDouble("lat", Double.NaN).takeIf { it.isFinite() },
                lng = o.optDouble("lng", Double.NaN).takeIf { it.isFinite() },
                sectionPosition = o.optString("sectionPosition").takeIf { it.isNotBlank() },
                sectionLengthMeters = o.optDouble("sectionLengthMeters", Double.NaN).takeIf { it.isFinite() && it > 0 }
            )
        }
        return out
    }

    private fun buildCumulative(g: List<Point>): DoubleArray {
        val out = DoubleArray(g.size)
        for (i in 1 until g.size) {
            out[i] = out[i-1] + haversine(g[i-1].lat,g[i-1].lng,g[i].lat,g[i].lng)
        }
        return out
    }

    /**
     * 현재 차량의 "정수 경로 정점"이 아니라 정점 사이를 보간한 연속 누적거리
     * (latestRouteDistanceM)를 기준으로 목표 지점까지 남은 거리를 계산한다.
     * 기존 distanceAlong(idx,...)는 현재 위치를 가장 가까운 경로 정점으로 반올림/절삭해
     * 정점 간격만큼(도로 형태에 따라 수십 m) 거리 오차가 생길 수 있었다.
     */
    private fun distanceFromCurrent(toIndex: Int): Double {
        if (cumulative.isEmpty()) return 0.0
        val bi = toIndex.coerceIn(0, cumulative.lastIndex)
        return max(0.0, cumulative[bi] - latestRouteDistanceM)
    }

    /**
     * 안전정보 이벤트 쪽도 가능하면(routeDistanceM이 채워져 있으면) 보간된 정밀 위치를
     * 사용한다. 없으면 기존처럼 정점 인덱스 기반 거리로 안전하게 폴백한다.
     */
    private fun distanceFromCurrent(event: SafetyEvent): Double {
        val to = event.routeDistanceM
            ?: (if (cumulative.isEmpty()) 0.0 else cumulative[event.routeIndex.coerceIn(0, cumulative.lastIndex)])
        return max(0.0, to - latestRouteDistanceM)
    }

    private fun nearestRouteDistance(lat: Double, lng: Double, heading: Float?, speed: Float): Double {
        if (geometry.size < 2) return 0.0
        val coarse = geometry.indices.minByOrNull {
            val p = geometry[it]
            val dx = (p.lng-lng)*cos(Math.toRadians(lat))
            val dy = p.lat-lat
            dx*dx+dy*dy
        } ?: 0
        var bestScore = Double.MAX_VALUE
        var bestDistance = cumulative[coarse]
        var bestIndex = coarse
        for (i in max(1,coarse-80)..min(geometry.lastIndex,coarse+120)) {
            val a=geometry[i-1]; val b=geometry[i]
            val proj=project(lat,lng,a,b)
            val d=haversine(lat,lng,proj.first,proj.second)
            val br=bearing(a.lat,a.lng,b.lat,b.lng)
            val hd=if(heading!=null&&speed>2f) angleDiff(heading.toDouble(),br) else 0.0
            val penalty=when {
                hd>=145 -> 120.0
                hd>=110 -> 60.0
                hd>=75 -> 20.0
                else -> hd/15.0
            }
            val score=d+penalty
            if(score<bestScore){
                bestScore=score
                bestIndex=i
                val seg=cumulative[i]-cumulative[i-1]
                bestDistance=cumulative[i-1]+seg*proj.third
            }
        }
        latestIdx=bestIndex
        return bestDistance
    }

    private fun indexAtRouteDistance(distance: Double): Int {
        if(cumulative.isEmpty()) return 0
        var lo=0; var hi=cumulative.lastIndex
        while(lo<hi){
            val mid=(lo+hi) ushr 1
            if(cumulative[mid]<distance) lo=mid+1 else hi=mid
        }
        latestIdx=lo
        return lo
    }

    private fun project(lat:Double,lng:Double,a:Point,b:Point):Triple<Double,Double,Double>{
        val kx=max(.2,cos(Math.toRadians(lat)))
        val x0=a.lng*kx; val y0=a.lat; val x1=b.lng*kx; val y1=b.lat
        val x=lng*kx; val y=lat; val dx=x1-x0; val dy=y1-y0
        val len2=dx*dx+dy*dy
        val t: Double = if (len2 > 0.0) {
            (((x - x0) * dx + (y - y0) * dy) / len2).coerceIn(0.0, 1.0)
        } else {
            0.0
        }
        return Triple(y0+dy*t,(x0+dx*t)/kx,t)
    }

    private fun bearing(a:Double,b:Double,c:Double,d:Double):Double{
        val p=Math.PI/180.0
        val y=sin((d-b)*p)*cos(c*p)
        val x=cos(a*p)*sin(c*p)-sin(a*p)*cos(c*p)*cos((d-b)*p)
        return (atan2(y,x)/p+360.0)%360.0
    }

    private fun angleDiff(a:Double,b:Double)=abs(((a-b+540.0)%360.0)-180.0)

    private fun haversine(a:Double,b:Double,c:Double,d:Double):Double{
        val r=6371000.0; val p=Math.PI/180.0
        val x=sin((c-a)*p/2).pow(2)+cos(a*p)*cos(c*p)*sin((d-b)*p/2).pow(2)
        return 2*r*asin(sqrt(x))
    }
}
