package com.komsco.jofams.smartdrive

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * High-accuracy navigation sensor source for the WebView navigation engine.
 * FusedLocationProvider supplies GNSS/network fused fixes while gyro, linear acceleration,
 * and rotation-vector data support heading continuity and tunnel dead reckoning.
 */
class NavigationSensorProvider(
    private val context: Context,
    private val bridge: JofamsWebBridge
) : SensorEventListener {
    private val fused: FusedLocationProviderClient = LocationServices.getFusedLocationProviderClient(context)
    private val sensors = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val gyro = sensors.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    private val linear = sensors.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
    private val rotation = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

    private var running = false
    private var lastMotionEmitAt = 0L
    private var yawRateDegS = 0.0
    private var accelMagnitude = 0.0
    private var headingDeg: Double? = null

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.locations.forEach(::emitLocation)
        }
    }

    fun start() {
        if (running) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) return
        running = true
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 200L)
            .setMinUpdateIntervalMillis(100L)
            .setMaxUpdateDelayMillis(250L)
            .setMaxUpdateAgeMillis(1_000L)
            .setMinUpdateDistanceMeters(0f)
            .setWaitForAccurateLocation(false)
            .build()
        fused.requestLocationUpdates(req, locationCallback, context.mainLooper)
        gyro?.let { sensors.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        linear?.let { sensors.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        rotation?.let { sensors.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    fun stop() {
        if (!running) return
        running = false
        fused.removeLocationUpdates(locationCallback)
        sensors.unregisterListener(this)
    }

    private fun emitLocation(location: Location) {
        val payload = JSONObject()
            .put("lat", location.latitude)
            .put("lng", location.longitude)
            .put("accuracy", location.accuracy.toDouble())
            .put("speedMps", if (location.hasSpeed()) location.speed.toDouble() else JSONObject.NULL)
            .put("headingDeg", if (location.hasBearing()) location.bearing.toDouble() else headingDeg ?: JSONObject.NULL)
            .put("speedAccuracy", if (android.os.Build.VERSION.SDK_INT >= 26 && location.hasSpeedAccuracy()) location.speedAccuracyMetersPerSecond.toDouble() else JSONObject.NULL)
            .put("bearingAccuracy", if (android.os.Build.VERSION.SDK_INT >= 26 && location.hasBearingAccuracy()) location.bearingAccuracyDegrees.toDouble() else JSONObject.NULL)
            .put("timestamp", location.time)
            .put("elapsedRealtimeMs", location.elapsedRealtimeNanos / 1_000_000.0)
            .put("provider", "fused")
        bridge.emitLocation(payload)
    }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_GYROSCOPE -> yawRateDegS = event.values.getOrNull(2)?.toDouble()?.times(180.0 / PI) ?: 0.0
            Sensor.TYPE_LINEAR_ACCELERATION -> {
                val x = event.values.getOrNull(0)?.toDouble() ?: 0.0
                val y = event.values.getOrNull(1)?.toDouble() ?: 0.0
                val z = event.values.getOrNull(2)?.toDouble() ?: 0.0
                accelMagnitude = sqrt(x * x + y * y + z * z)
            }
            Sensor.TYPE_ROTATION_VECTOR -> {
                val r = FloatArray(9)
                val orientation = FloatArray(3)
                SensorManager.getRotationMatrixFromVector(r, event.values)
                SensorManager.getOrientation(r, orientation)
                headingDeg = ((orientation[0] * 180.0 / PI) + 360.0) % 360.0
            }
        }
        val now = SystemClock.elapsedRealtime()
        if (running && now - lastMotionEmitAt >= 100L) {
            lastMotionEmitAt = now
            val payload = JSONObject()
                .put("yawRateDegS", yawRateDegS)
                .put("accelMagnitude", accelMagnitude)
                .put("headingDeg", headingDeg ?: JSONObject.NULL)
                .put("timestampElapsedMs", now)
            bridge.emitMotion(payload)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
