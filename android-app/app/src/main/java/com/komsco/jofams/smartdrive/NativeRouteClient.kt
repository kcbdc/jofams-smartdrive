package com.komsco.jofams.smartdrive

import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Pure Native 주행 중 경로 이탈 시 WebView를 거치지 않고 /api/route를 직접 호출한다.
 */
class NativeRouteClient(
    private val baseUrl: String,
    private val listener: Listener
) {
    interface Listener {
        fun onRerouteStarted()
        fun onRerouteSuccess(route: JSONObject)
        fun onRerouteFailed(message: String)
    }

    data class RouteRequest(
        val originLat: Double,
        val originLng: Double,
        val heading: Float?,
        val destinationLat: Double,
        val destinationLng: Double,
        val priority: String = "RECOMMEND",
        val avoid: String? = null,
        val waypoints: List<Pair<Double,Double>> = emptyList()
    )

    private val executor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var running = false
    @Volatile private var lastRequestedAt = 0L

    fun reroute(req: RouteRequest) {
        val now = System.currentTimeMillis()
        if (running || now - lastRequestedAt < 1200L) return
        running = true
        lastRequestedAt = now
        main.post { listener.onRerouteStarted() }

        executor.execute {
            try {
                val url = URL(baseUrl.trimEnd('/') + "/api/route")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 5000
                    readTimeout = 9000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                    useCaches = false
                }

                val body = JSONObject().apply {
                    put("origin", JSONObject().apply {
                        put("lat", req.originLat)
                        put("lng", req.originLng)
                        if (req.heading != null) put("heading", req.heading)
                    })
                    put("destination", JSONObject().apply {
                        put("lat", req.destinationLat)
                        put("lng", req.destinationLng)
                    })
                    put("priority", req.priority)
                    put("alternatives", false)
                    put("mode", "car")
                    if (!req.avoid.isNullOrBlank()) put("avoid", req.avoid)
                    put("waypoints", JSONArray().apply {
                        req.waypoints.forEach { (lat,lng) ->
                            put(JSONObject().apply { put("lat",lat); put("lng",lng) })
                        }
                    })
                }

                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val text = BufferedReader(stream.reader(Charsets.UTF_8)).use { it.readText() }
                conn.disconnect()

                if (code !in 200..299) throw IllegalStateException("경로 재탐색 실패 ($code)")
                val route = JSONObject(text)
                val geometry = route.optJSONArray("geometry")
                if (geometry == null || geometry.length() < 2) throw IllegalStateException("새 경로가 없습니다.")

                main.post {
                    running = false
                    listener.onRerouteSuccess(route)
                }
            } catch (e: Exception) {
                main.post {
                    running = false
                    listener.onRerouteFailed(e.message ?: "경로 재탐색 실패")
                }
            }
        }
    }
}
