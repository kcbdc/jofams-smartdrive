package com.komsco.jofams.smartdrive

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: JofamsWebBridge
    private val allowedHost: String? by lazy { Uri.parse(BuildConfig.SMARTDRIVE_URL).host }

    private val permissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* WebView will re-request browser-level permissions when needed. */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        permissions.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.CAMERA))
        buildWebView()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildWebView() {
        webView = WebView(this)
        setContentView(webView)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            geolocationEnabled = true
            mediaPlaybackRequiresUserGesture = true
            allowFileAccess = false
            allowContentAccess = false
        }

        bridge = JofamsWebBridge(webView, nativeARAvailable = false, commandHandler = ::handleBridgeCommand)
        webView.addJavascriptInterface(bridge, "JofamsNavigationBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == allowedHost) return false
                startActivity(Intent(Intent.ACTION_VIEW, uri))
                return true
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                val sameHost = runCatching { Uri.parse(origin).host == allowedHost }.getOrDefault(false)
                val granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                callback.invoke(origin, sameHost && granted, false)
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val cameraGranted = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                    val video = request.resources.filter { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }.toTypedArray()
                    if (cameraGranted && video.isNotEmpty()) request.grant(video) else request.deny()
                }
            }
        }
        webView.loadUrl(BuildConfig.SMARTDRIVE_URL)
    }

    private fun handleBridgeCommand(type: String, payload: JSONObject) {
        when (type) {
            "navigationState" -> onNavigationState(payload.optBoolean("active"), payload)
            "requestLane" -> requestLaneFromKakaoSdk()
            "requestSafety" -> requestSafetyFromKakaoSdk()
            "requestImageDirection" -> requestImageDirectionFromKakaoSdk()
            "requestRoadEvents" -> requestRoadEventsFromKakaoSdk()
            "requestAlternatives" -> requestAlternativeFromKakaoSdk()
            "acceptAlternative" -> acceptAlternativeInKakaoSdk(payload)
            "startAR" -> startNativeAR(payload)
            "stopAR" -> stopNativeAR()
        }
    }

    // ---- Kakao Navi SDK / ARCore integration hooks ----
    // Keep this host runnable without proprietary SDK configuration. In an operating app,
    // connect the Kakao Navi SDK callbacks here and use bridge.emitLane/emitSafety/
    // emitImageDirection/emitRoadEvents/emitAlternativeRoute/emitLocation.
    private fun onNavigationState(active: Boolean, payload: JSONObject) = Unit
    private fun requestLaneFromKakaoSdk() = Unit
    private fun requestSafetyFromKakaoSdk() = Unit
    private fun requestImageDirectionFromKakaoSdk() = Unit
    private fun requestRoadEventsFromKakaoSdk() = Unit
    private fun requestAlternativeFromKakaoSdk() = Unit
    private fun acceptAlternativeInKakaoSdk(payload: JSONObject) = Unit
    private fun startNativeAR(payload: JSONObject) = Unit
    private fun stopNativeAR() = Unit

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("JofamsNavigationBridge")
            webView.destroy()
        }
        super.onDestroy()
    }
}
