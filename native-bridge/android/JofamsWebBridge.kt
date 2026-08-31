package com.komsco.jofams.navigation

import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * Jofams SmartDrive v4 WebView bridge.
 * The host app wires Kakao Navi SDK delegates to the emit* functions below.
 * This class itself has no dependency on the Kakao SDK, so the WebView host remains buildable.
 */
class JofamsWebBridge(
    private val webView: WebView,
    private val nativeARAvailable: Boolean = false,
    private val commandHandler: ((type: String, payload: JSONObject) -> Unit)? = null
) {
    @JavascriptInterface fun hasAR(): Boolean = nativeARAvailable

    @JavascriptInterface fun postMessage(message: String) {
        runCatching {
            val root = JSONObject(message)
            commandHandler?.invoke(root.optString("type"), root.optJSONObject("payload") ?: JSONObject())
        }
    }

    fun emitLane(json: JSONObject) = call("onLaneUpdate", json)
    fun emitSafety(json: JSONObject) = call("onSafetyUpdate", json)
    fun emitImageDirection(json: JSONObject) = call("onImageDirection", json)
    fun emitRoadEvents(json: JSONObject) = call("onRoadEvents", json)
    fun emitAlternativeRoute(json: JSONObject) = call("onAlternativeRoute", json)
    fun emitLocation(json: JSONObject) = call("onLocationUpdate", json)
    fun emitTunnelState(json: JSONObject) = call("onTunnelState", json)
    fun emitARStatus(json: JSONObject) = call("onARStatus", json)

    private fun call(name: String, payload: JSONObject) {
        val encoded = JSONObject.quote(payload.toString())
        webView.post { webView.evaluateJavascript("window.JofamsNative.$name($encoded)", null) }
    }
}
