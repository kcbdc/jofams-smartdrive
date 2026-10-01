package com.komsco.jofams.smartdrive

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.os.Build
import java.security.MessageDigest
import android.content.res.Configuration
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.location.Location
import android.provider.Settings
import android.view.OrientationEventListener
import android.view.WindowManager
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Granularity
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.util.Locale

class MainActivity : AppCompatActivity() {

    companion object {
        // 네이티브 주행화면 전환 후 이 시간 안에 경로 데이터가 도착하지 않으면 웹 안내로 자동 복귀한다.
        private const val NATIVE_DRIVE_ROUTE_TIMEOUT_MS = 3500L
    }
    private lateinit var webView: WebView
    private lateinit var jofamsWebBridge: JofamsWebBridge
    private lateinit var rootContainer: FrameLayout
    private lateinit var nativeDriveView: NativeDriveView
    private lateinit var nativeGuidanceEngine: NativeGuidanceEngine
    private lateinit var nativeRouteClient: NativeRouteClient
    private lateinit var nativeSafetyRepository: NativeSafetyRepository
    private var nativeDriveActive = false
    // 길안내 중 화면 회전(가로모드) 제어용. 시스템의 '자동 회전' 설정이 꺼져 있어도
    // 기기를 실제로 가로로 돌리면 가로 화면이 되도록 직접 센서 각도를 감시한다.
    private var navRotationListener: OrientationEventListener? = null
    private var navRotationEnabled = false
    private var nativeDriveShowToken = 0
    private var pendingNativeDriveRequest = false
    private var nativeGuideCharacter = "daim"
    private var nativeDestinationLat: Double? = null
    private var nativeDestinationLng: Double? = null
    private var nativeDestinationName: String = "목적지"
    private var nativeArrivalCandidateCount = 0
    private var nativeArrivalHandled = false
    private var lastVoucherWarmAt = 0L
    private var nativeRoutePriority: String = "RECOMMEND"
    private var nativeRouteAvoid: String? = null
    private var nativeWaypoints: List<Pair<Double,Double>> = emptyList()

    private val allowedHost: String? by lazy { Uri.parse(BuildConfig.SMARTDRIVE_URL).host }

    private var tts: TextToSpeech? = null
    @Volatile private var ttsReady = false
    private var audioFocusRequest: AudioFocusRequest? = null

    private var pendingMediaPermissionRequest: PermissionRequest? = null
    private var mainFrameReloadCount = 0
    private var pendingGooglePayload: String? = null
    private var nativeGoogleLoginInProgress = false

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var nativeNavigationEngine: NativeNavigationEngine
    private var nativeLocationRunning = false
    private lateinit var nativeLoadingOverlay: ImageView
    private var nativeLoadingOverlayDismissed = false

    private val highAccuracyLocationRequest: LocationRequest by lazy {
        LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 250L)
            .setMinUpdateIntervalMillis(100L)
            .setMaxUpdateDelayMillis(300L)
            .setMaxUpdateAgeMillis(1_000L)
            .setMinUpdateDistanceMeters(0f)
            .setWaitForAccurateLocation(false)
            .setGranularity(Granularity.GRANULARITY_FINE)
            .build()
    }

    private val startupPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val fine = result[Manifest.permission.ACCESS_FINE_LOCATION] == true || hasFineLocationPermission()
        if (fine) ensureHighAccuracyLocationSettings()
        else notifyWebToast("정확한 GPS 안내를 위해 위치 권한에서 '정확한 위치'를 허용해 주세요.")
    }

    private val locationSettingsLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) {
        if (hasFineLocationPermission()) startNativeLocationUpdates()
    }

    private val mediaPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        val pending = pendingMediaPermissionRequest ?: return@registerForActivityResult
        pendingMediaPermissionRequest = null
        grantSupportedWebPermissions(pending)
    }

    private val voiceRecognitionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val text = if (result.resultCode == Activity.RESULT_OK) {
            result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.trim().orEmpty()
        } else ""
        if (text.isNotBlank()) {
            val quoted = JSONObject.quote(text)
            webView.post {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('jofams-native-voice-result',{detail:{text:$quoted}}));",
                    null
                )
            }
        } else {
            notifyWebToast("음성 인식이 취소되었거나 인식된 내용이 없습니다.")
        }
    }

    private val googleLoginLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        nativeGoogleLoginInProgress = false
        if (result.resultCode == Activity.RESULT_CANCELED && result.data == null) {
            notifyWebLoginError("Google 로그인이 취소되었습니다.")
            return@registerForActivityResult
        }

        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val idToken = account.idToken
            if (idToken.isNullOrBlank()) {
                notifyWebLoginError("Google ID Token을 가져오지 못했습니다. Firebase OAuth 설정을 확인해 주세요.")
                return@registerForActivityResult
            }

            val payload = JSONObject().apply {
                put("idToken", idToken)
                put("email", account.email ?: "")
                put("displayName", account.displayName ?: "")
                put("photoUrl", account.photoUrl?.toString() ?: "")
            }

            pendingGooglePayload = payload.toString()
            deliverPendingGooglePayload()
        } catch (e: ApiException) {
            val message = if (e.statusCode == 10) {
                val sha1 = currentAppSigningSha1().ifBlank { "확인 불가" }
                val known = BuildConfig.KNOWN_SIGNING_SHA1S
                    .split(",")
                    .map { it.trim().uppercase() }
                    .filter { it.isNotBlank() }
                val environment = when {
                    sha1.uppercase() == "0B:D8:16:EF:CF:46:87:BC:BD:7F:5A:D3:A2:6D:1C:1E:00:35:15:3D" -> "Google Play 앱 서명"
                    sha1.uppercase() == "E0:35:0D:67:D9:0A:F4:CE:28:2F:5A:20:0E:2A:65:6D:E2:AF:D5:FD" -> "개발/업로드 서명"
                    known.contains(sha1.uppercase()) -> "등록된 진단용 서명"
                    else -> "기타 서명"
                }
                "Google OAuth 설정 오류(10)입니다.\n" +
                        "앱 내부 SHA-1 강제차단은 사용하지 않습니다.\n" +
                        "패키지: $packageName\n" +
                        "현재 앱 SHA-1: $sha1 ($environment)\n" +
                        "Firebase Console의 Android 앱에 이 SHA-1이 등록되어 있는지 확인해 주세요. " +
                        "Google Play 배포본은 Play Console의 '앱 서명 키 인증서' SHA-1을 등록해야 합니다."
            } else {
                "Google 로그인에 실패했습니다. (${e.statusCode})"
            }
            notifyWebLoginError(message)
        } catch (_: Exception) {
            notifyWebLoginError("Google 로그인 처리 중 오류가 발생했습니다.")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 앱 최초 진입 시에는 항상 세로모드로 고정한다.
        // (길안내 지도 화면 진입 시에만 가로 회전을 허용하며, 그 외 화면은 세로로 유지한다.)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        nativeGuidanceEngine = NativeGuidanceEngine(object : NativeGuidanceEngine.Listener {
            override fun onSnapshot(snapshot: NativeGuidanceEngine.NativeDriveSnapshot) {
                if (::nativeDriveView.isInitialized) {
                    nativeDriveView.post { nativeDriveView.update(snapshot) }
                }
                evaluateNativeArrival(snapshot)
            }
            override fun onVoice(text: String) {
                speakNativeGuidance(text)
            }
        })
        nativeSafetyRepository = NativeSafetyRepository(BuildConfig.SMARTDRIVE_URL, object : NativeSafetyRepository.Listener {
            override fun onSafetyUpdated(events: List<NativeGuidanceEngine.SafetyEvent>) {
                nativeGuidanceEngine.setSafetyEvents(events)
                if (::nativeDriveView.isInitialized) {
                    nativeDriveView.setSafetyEvents(events)
                    nativeDriveView.setStatusMessage("안전정보 갱신")
                    nativeDriveView.postDelayed({ nativeDriveView.setStatusMessage(null) }, 800L)
                }
            }
            override fun onVariableSpeedLimit(limit: Int?, roadName: String?) {
                nativeGuidanceEngine.setVariableSpeedLimit(limit, roadName)
            }
            override fun onSafetyError(message: String) {
                // 주행은 계속하고 마지막 정상 안전정보를 유지한다.
            }
        })
        nativeRouteClient = NativeRouteClient(BuildConfig.SMARTDRIVE_URL, object : NativeRouteClient.Listener {
            override fun onRerouteStarted() {
                if (::nativeDriveView.isInitialized) nativeDriveView.setStatusMessage("경로 이탈 · 새 경로 계산 중")
            }
            override fun onRerouteSuccess(route: JSONObject) {
                applyNativeReroute(route)
            }
            override fun onRerouteFailed(message: String) {
                if (::nativeDriveView.isInitialized) {
                    nativeDriveView.setStatusMessage("재탐색 지연 · 현재 위치 계속 추적")
                    nativeDriveView.postDelayed({ nativeDriveView.setStatusMessage(null) }, 2200L)
                }
            }
        })
        nativeNavigationEngine = NativeNavigationEngine(this, object : NativeNavigationEngine.Listener {
            override fun onNavigationFix(fix: NativeNavigationEngine.NavigationFix) {
                nativeGuidanceEngine.onFix(fix)
                nativeSafetyRepository.refresh(
                    fix.rawLatitude,
                    fix.rawLongitude,
                    nativeGuidanceEngine.routePoints(),
                    false
                )
                deliverNativeNavigationFix(fix)
            }
            override fun onGnssState(state: NativeNavigationEngine.GnssQuality) {
                deliverNativeGnssState(state)
            }
            override fun onRouteDeviation(event: NativeNavigationEngine.RouteDeviation) {
                requestNativeReroute(event)
            }
            override fun onTunnelLikely(active: Boolean) {
                // 위성 신호 저하가 일정 시간 지속되면(디바운스 완료) 웹의 GPS 폴백(추정 주행)
                // 로직이 "실제 GPS 끊김"을 뒤늦게 기다리지 않고 즉시 반응하도록 알려준다.
                if (::jofamsWebBridge.isInitialized) jofamsWebBridge.emitTunnelState(active)
            }
        })
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        initNativeTts()
        buildWebView()
        setupBackNavigation()
        updateImmersiveMode()

        // 최초 진입에서 미허용된 위치/카메라 권한만 요청합니다.
        // 이미 허용된 권한은 앱을 다시 실행해도 재요청하지 않습니다.
        // 마이크는 음성입력 기능을 실제 사용할 때만 요청합니다.
        val missingStartupPermissions = mutableListOf<String>()
        if (!hasFineLocationPermission()) {
            missingStartupPermissions += Manifest.permission.ACCESS_FINE_LOCATION
            missingStartupPermissions += Manifest.permission.ACCESS_COARSE_LOCATION
        }
        if (!hasCameraPermission()) {
            missingStartupPermissions += Manifest.permission.CAMERA
        }
        if (missingStartupPermissions.isNotEmpty()) {
            startupPermissionLauncher.launch(missingStartupPermissions.distinct().toTypedArray())
        } else {
            ensureHighAccuracyLocationSettings()
        }
    }

    private fun dismissNativeLoadingOverlay() {
        if (nativeLoadingOverlayDismissed || !::nativeLoadingOverlay.isInitialized) return
        nativeLoadingOverlayDismissed = true
        nativeLoadingOverlay.animate()
            .alpha(0f)
            .setDuration(260L)
            .withEndAction {
                runCatching { (nativeLoadingOverlay.parent as? ViewGroup)?.removeView(nativeLoadingOverlay) }
            }
            .start()
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (nativeDriveActive) {
                    stopNativeDriveFromUi()
                } else if (::webView.isInitialized && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    private fun updateImmersiveMode() {
        val landscape = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                if (landscape) {
                    controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                    controller.systemBarsBehavior =
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                } else {
                    controller.show(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                }
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = if (landscape) {
                android.view.View.SYSTEM_UI_FLAG_FULLSCREEN or
                        android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                        android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            } else {
                android.view.View.SYSTEM_UI_FLAG_VISIBLE
            }
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        updateImmersiveMode()
        if (::webView.isInitialized) {
            webView.postDelayed({
                webView.evaluateJavascript("window.dispatchEvent(new Event('resize'));", null)
            }, 120)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildWebView() {
        webView = WebView(this)
        // 네이티브 → 웹(window.JofamsNative.*) 단방향 알림 채널. 터널 의심(위성 신호 저하)
        // 등, 웹 쪽 GPS 폴백 로직을 더 빠르게 트리거하기 위한 용도로 사용한다.
        jofamsWebBridge = JofamsWebBridge(webView)

        if (!::rootContainer.isInitialized) {
            rootContainer = FrameLayout(this)
            nativeDriveView = NativeDriveView(this).apply {
                visibility = View.GONE
                onStopNavigation = { stopNativeDriveFromUi() }
            }
            rootContainer.addView(
                webView,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )
            rootContainer.addView(
                nativeDriveView,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )
            // 웹뷰가 실제 페이지를 그리기 전까지 흰/검정 화면 대신 브랜드 로딩 이미지를 보여준다.
            nativeLoadingOverlay = ImageView(this).apply {
                // Bootstrap loading: 화면 비율/회전에 맞춰 원본 비율을 유지한 채 자동 확대·축소한다.
                // CENTER_CROP처럼 이미지 가장자리를 잘라내지 않고 전체 이미지를 항상 표시한다.
                scaleType = ImageView.ScaleType.FIT_CENTER
                adjustViewBounds = false
                setImageResource(R.drawable.native_loading_screen)
                setBackgroundColor(Color.parseColor("#06111E"))
            }
            rootContainer.addView(
                nativeLoadingOverlay,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )
            // 페이지 로딩이 비정상적으로 지연되어도 화면이 계속 가려지지 않도록 안전 타임아웃을 둔다.
            nativeLoadingOverlay.postDelayed({ dismissNativeLoadingOverlay() }, 6000L)
            setContentView(rootContainer)
        } else {
            rootContainer.addView(
                webView,
                0,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        // 지도/주행 애니메이션 프레임 드롭을 줄이기 위해 WebView 합성을 GPU에 고정한다.
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // 구글 로그인 등 window.open()/팝업 기반 흐름을 네이티브에서 가로채려면 다중 창을 허용해야 합니다.
            // (사용자 제스처 없이 자동으로 열리는 팝업은 계속 차단합니다.)
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = false
            builtInZoomControls = false
            displayZoomControls = false
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = false
            setSupportZoom(false)
            offscreenPreRaster = true
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString JofamsNavi/8.5.1 NativeMap"
        }

        webView.addJavascriptInterface(AuthBridge(), "JofamsAuthBridge")
        webView.addJavascriptInterface(ShareBridge(), "JofamsShareBridge")
        webView.addJavascriptInterface(TtsBridge(), "JofamsTtsBridge")
        webView.addJavascriptInterface(LocationBridge(), "JofamsLocationBridge")
        webView.addJavascriptInterface(NavigationBridge(), "JofamsNavigationBridge")
        webView.addJavascriptInterface(PermissionBridge(), "JofamsPermissionBridge")
        webView.addJavascriptInterface(VoiceBridge(), "JofamsVoiceBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return handleExternalUri(request.url)
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                mainFrameReloadCount = 0
                injectNativeCompatibilityShim(view)
                view.evaluateJavascript(
                    "window.dispatchEvent(new Event('jofams-native-auth-ready'));" +
                            "window.dispatchEvent(new Event('jofams-native-tts-ready'));",
                    null
                )
                deliverPendingGooglePayload()
                // 홈화면 상품권 레이어를 페이지 로드 직후 선행 로딩한다.
                warmHomeVoucherLayers(force = true)
                view.postDelayed({ warmHomeVoucherLayers(force = false) }, 700L)
                view.postDelayed({ warmHomeVoucherLayers(force = false) }, 1600L)
                dismissNativeLoadingOverlay()
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (!request.isForMainFrame || mainFrameReloadCount >= 2) return
                mainFrameReloadCount++
                view.postDelayed({
                    if (!isFinishing && !isDestroyed) view.reload()
                }, 1500L * mainFrameReloadCount)
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // WebView renderer crash/OOM 발생 시 흰 화면에 머무르지 않고 WebView를 재생성합니다.
                (view.parent as? ViewGroup)?.removeView(view)
                runCatching { view.destroy() }
                if (!isFinishing && !isDestroyed) {
                    runOnUiThread {
                        buildWebView()
                        if (nativeDriveActive) showNativeDrive()
                    }
                }
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                val sameHost = runCatching { Uri.parse(origin).host == allowedHost }.getOrDefault(false)
                val granted = ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
                callback.invoke(origin, sameHost && granted, false)
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val needed = mutableListOf<String>()
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in request.resources &&
                        ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.RECORD_AUDIO
                        ) != PackageManager.PERMISSION_GRANTED
                    ) {
                        needed += Manifest.permission.RECORD_AUDIO
                    }
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in request.resources &&
                        ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.CAMERA
                        ) != PackageManager.PERMISSION_GRANTED
                    ) {
                        needed += Manifest.permission.CAMERA
                    }

                    if (needed.isEmpty()) {
                        grantSupportedWebPermissions(request)
                    } else {
                        pendingMediaPermissionRequest?.deny()
                        pendingMediaPermissionRequest = request
                        mediaPermissionLauncher.launch(needed.distinct().toTypedArray())
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingMediaPermissionRequest === request) pendingMediaPermissionRequest = null
                super.onPermissionRequestCanceled(request)
            }

            // 웹앱이 Google 로그인 등을 window.open()/target=_blank 팝업으로 여는 경우
            // setSupportMultipleWindows(false) 상태에서는 아무 반응 없이 조용히 무시되어
            // "구글 로그인이 안 됨"으로 보입니다. 임시 WebView로 목적지 URL만 가로채
            // handleExternalUri()(구글 로그인이면 네이티브 로그인, 그 외에는 외부 인텐트)로 넘깁니다.
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message
            ): Boolean {
                val transientWebView = WebView(this@MainActivity)
                transientWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        popupView: WebView,
                        request: WebResourceRequest
                    ): Boolean {
                        handleExternalUri(request.url)
                        runCatching { (transientWebView.parent as? ViewGroup)?.removeView(transientWebView) }
                        transientWebView.destroy()
                        return true
                    }
                }
                val transport = resultMsg.obj as? WebView.WebViewTransport
                transport?.webView = transientWebView
                resultMsg.sendToTarget()
                return true
            }
        }

        webView.loadUrl(BuildConfig.SMARTDRIVE_URL)
    }

    private fun grantSupportedWebPermissions(request: PermissionRequest) {
        val granted = request.resources.filter {
            when (it) {
                PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                    ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
                            PackageManager.PERMISSION_GRANTED
                PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                    ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
                            PackageManager.PERMISSION_GRANTED
                else -> false
            }
        }.toTypedArray()

        if (granted.isNotEmpty()) request.grant(granted) else request.deny()
    }

    private fun handleExternalUri(uri: Uri): Boolean {
        if (uri.scheme == "https" && uri.host == allowedHost) return false

        if (uri.host?.contains("accounts.google.com", ignoreCase = true) == true) {
            startNativeGoogleLogin()
            return true
        }

        return try {
            val intent = when (uri.scheme?.lowercase(Locale.ROOT)) {
                "intent" -> Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                else -> Intent(Intent.ACTION_VIEW, uri)
            }
            startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            notifyWebToast("연결할 수 있는 앱이 없습니다.")
            true
        } catch (_: Exception) {
            notifyWebToast("외부 화면을 열 수 없습니다.")
            true
        }
    }

    /**
     * 원격 웹소스가 아직 네이티브 TTS/공유 브리지를 직접 호출하지 않아도 Android 앱에서
     * 정상 작동하도록 WebView 레벨 호환 shim을 주입합니다.
     */
    private fun injectNativeCompatibilityShim(view: WebView) {
        val js = """
            (() => {
              if (window.__JOFAMS_ANDROID_NATIVE_SHIM__) return;
              window.__JOFAMS_ANDROID_NATIVE_SHIM__ = true;

              // Web Speech API 호출을 Android TextToSpeech로 전달합니다.
              try {
                if (window.JofamsTtsBridge && window.speechSynthesis) {
                  const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
                  const originalCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);
                  window.speechSynthesis.speak = function(u) {
                    try {
                      const text = String(u?.text || '');
                      const rate = Number(u?.rate || 1);
                      const pitch = Number(u?.pitch || 1);
                      const volume = Number(u?.volume ?? 1);
                      let character = 'daim';
                      if (pitch <= 0.78) character = 'sunsik';
                      else if (rate >= 1.04 && pitch <= 1.02) character = 'hunmin';
                      window.JofamsTtsBridge.speak(text, character, rate, pitch, volume);
                      return;
                    } catch (e) {
                      console.warn('native tts bridge fallback', e);
                    }
                    return originalSpeak(u);
                  };
                  window.speechSynthesis.cancel = function() {
                    try { window.JofamsTtsBridge.stop(); } catch (_) {}
                    try { return originalCancel(); } catch (_) {}
                  };
                }
              } catch (e) { console.warn('TTS shim failed', e); }

              // Android Fused Location Provider 좌표를 WebView navigator.geolocation에 연결합니다.
              try {
                if (window.JofamsLocationBridge && navigator.geolocation) {
                  const geo = navigator.geolocation;
                  let seq = 1;
                  const watches = new Map();
                  const once = new Map();

                  window.__jofamsNativeLocationReceive = function(payload) {
                    try {
                      const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
                      const position = {
                        coords: {
                          latitude: Number(p.latitude),
                          longitude: Number(p.longitude),
                          accuracy: Number(p.accuracy || 0),
                          altitude: p.altitude == null ? null : Number(p.altitude),
                          altitudeAccuracy: null,
                          heading: p.bearing == null ? (p.headingDeg == null ? null : Number(p.headingDeg)) : Number(p.bearing),
                          speed: p.speed == null ? (p.speedMps == null ? null : Number(p.speedMps)) : Number(p.speed),
                          speedAccuracy: p.speedAccuracy == null ? null : Number(p.speedAccuracy),
                          satelliteCount: p.satelliteCount == null ? null : Number(p.satelliteCount),
                          satellitesUsed: p.satellitesUsed == null ? null : Number(p.satellitesUsed)
                        },
                        timestamp: Number(p.timestamp || Date.now()),
                        native: true,
                        estimated: Boolean(p.estimated),
                        rawLatitude: p.rawLat == null ? Number(p.latitude) : Number(p.rawLat),
                        rawLongitude: p.rawLng == null ? Number(p.longitude) : Number(p.rawLng)
                      };
                      once.forEach((cb, id) => { try { cb(position); } catch (_) {} once.delete(id); });
                      watches.forEach(cb => { try { cb(position); } catch (_) {} });
                      window.dispatchEvent(new CustomEvent('jofams-native-location', {detail: position}));
                    } catch (e) { console.warn('native location receive failed', e); }
                  };

                  const nativeGet = function(success, error, options) {
                    const id = seq++;
                    once.set(id, success);
                    try { window.JofamsLocationBridge.requestSingleFix(); } catch (e) {
                      once.delete(id);
                      if (typeof error === 'function') error({code:2,message:'Native GPS unavailable'});
                    }
                  };
                  const nativeWatch = function(success, error, options) {
                    const id = seq++;
                    watches.set(id, success);
                    try { window.JofamsLocationBridge.startHighAccuracy(); } catch (e) {
                      watches.delete(id);
                      if (typeof error === 'function') error({code:2,message:'Native GPS unavailable'});
                    }
                    return id;
                  };
                  const nativeClear = function(id) {
                    watches.delete(Number(id));
                    if (!watches.size) { try { window.JofamsLocationBridge.stopIfIdle(); } catch (_) {} }
                  };
                  try { geo.getCurrentPosition = nativeGet; geo.watchPosition = nativeWatch; geo.clearWatch = nativeClear; }
                  catch (_) {}
                }
              } catch (e) { console.warn('Location shim failed', e); }

              // 경로선은 네이티브 터널 DR/map-matching에서 사용한다.
              // 경로가 바뀔 때만 geometry를 NativeNavigationEngine에 전달한다.
              try {
                if (window.JofamsNavigationBridge) {
                  let lastNativeRouteKey = '';
                  setInterval(() => {
                    try {
                      if (typeof state === 'undefined') return;
                      const g = state?.route?.geometry;
                      if (!Array.isArray(g) || g.length < 2) return;
                      const first=g[0], last=g[g.length-1];
                      const key=String(g.length)+':'+String(first?.[0])+':'+String(first?.[1])+':'+String(last?.[0])+':'+String(last?.[1]);
                      const routeChanged = key !== lastNativeRouteKey;
                      if (routeChanged) lastNativeRouteKey = key;
                      const payload={
                        route: state.route ? {
                          geometry: state.route.geometry || [],
                          guides: state.route.guides || [],
                          roadSegments: state.route.roadSegments || [],
                          distance: Number(state.route.distance || 0),
                          duration: Number(state.route.duration || 0)
                        } : null,
                        safetyEvents: Array.isArray(state.safetyEvents) ? state.safetyEvents : [],
                        destination: state.destination || null,
                        waypoints: Array.isArray(state.waypoints) ? state.waypoints : [],
                        routePriority: (typeof routePreferenceSpec==='function' ? routePreferenceSpec().priority : 'RECOMMEND'),
                        routeAvoid: (state.routeMode==='car' && typeof routePreferenceSpec==='function' ? routePreferenceSpec().avoid : null),
                        character: state.character || 'daim',
                        // 웹이 경로 데이터(터널 이름 구간)로 이미 판단한 "현재 터널 안" 여부를
                        // 네이티브로도 전달해, 네이티브 dead-reckoning의 장거리 허용시간을
                        // (짧은 90초 기본값 대신) 웹과 동일하게 늘릴 수 있게 한다.
                        tunnelActive: Boolean(state?.tunnelRouteLock?.active)
                      };
                      window.JofamsNavigationBridge.updateNavigationState(JSON.stringify(payload));
                      window.JofamsNavigationBridge.setNavigationActive(Boolean(state.tripStartedAt));
                    } catch (_) {}
                  }, 700);
                }
              } catch (e) { console.warn('Native route sync failed', e); }

              // 길안내 화면 진입 시 라디오를 80%로 초기화하고 즉시 자동재생합니다.
              // WebView는 mediaPlaybackRequiresUserGesture=false이므로 화면 전환 직후 play()가 가능합니다.
              try {
                if (!window.__JOFAMS_NAV_RADIO_AUTOPLAY_80__) {
                  window.__JOFAMS_NAV_RADIO_AUTOPLAY_80__ = true;
                  const driveView = document.getElementById('driveView');
                  let wasVisible = false;

                  const startNavigationRadio = () => {
                    try {
                      const player = document.getElementById('radioPlayer');
                      if (!player) return;
                      const volume = 0.8;
                      player.volume = volume;
                      try { localStorage.setItem('jofams.radioVolume', String(volume)); } catch (_) {}
                      const slider = document.getElementById('radioVolume');
                      if (slider) slider.value = '80';
                      const label = document.getElementById('radioVolumeValue');
                      if (label) label.textContent = '80%';
                      const p = player.play();
                      if (p && typeof p.catch === 'function') {
                        p.catch(err => console.warn('navigation radio autoplay failed', err));
                      }
                    } catch (e) {
                      console.warn('navigation radio init failed', e);
                    }
                  };

                  const syncDriveVisibility = () => {
                    if (!driveView) return;
                    const visible = !driveView.classList.contains('hidden');
                    if (visible && !wasVisible) startNavigationRadio();
                    wasVisible = visible;
                  };

                  if (driveView) {
                    wasVisible = !driveView.classList.contains('hidden');
                    const observer = new MutationObserver(syncDriveVisibility);
                    observer.observe(driveView, { attributes:true, attributeFilter:['class'] });
                    if (wasVisible) startNavigationRadio();
                  }
                }
              } catch (e) { console.warn('Navigation radio autoplay shim failed', e); }

              // navigator.share가 WebView에서 제한되는 경우 Android 공유 시트를 사용합니다.
              try {
                if (window.JofamsShareBridge) {
                  const nativeShare = async (data = {}) => {
                    window.JofamsShareBridge.shareText(
                      String(data.title || '조팸스 내비'),
                      String(data.text || data.url || '')
                    );
                  };
                  try {
                    Object.defineProperty(navigator, 'share', { configurable: true, value: nativeShare });
                  } catch (_) {
                    navigator.share = nativeShare;
                  }
                }
              } catch (e) { console.warn('Share shim failed', e); }
            })();
        """.trimIndent()
        view.evaluateJavascript(js, null)
    }

    private inner class AuthBridge {
        @JavascriptInterface
        fun signInGoogle() {
            runOnUiThread { startNativeGoogleLogin() }
        }

        @JavascriptInterface
        fun signOutGoogle() {
            runOnUiThread {
                GoogleSignIn.getClient(this@MainActivity, googleSignInOptions()).signOut()
            }
        }

        @JavascriptInterface
        fun isNativeAuthAvailable(): Boolean = true
    }

    private inner class ShareBridge {
        @JavascriptInterface
        fun shareText(title: String?, text: String?) {
            val safeText = text?.trim().orEmpty()
            if (safeText.isBlank()) return

            runOnUiThread {
                try {
                    val thumbnailUri = resolveShareThumbnailUri()
                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        if (thumbnailUri != null) {
                            type = "image/jpeg"
                            putExtra(Intent.EXTRA_STREAM, thumbnailUri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        } else {
                            type = "text/plain"
                        }
                        putExtra(
                            Intent.EXTRA_SUBJECT,
                            title?.takeIf { it.isNotBlank() } ?: "조팸스 내비"
                        )
                        putExtra(Intent.EXTRA_TEXT, safeText)
                    }
                    startActivity(Intent.createChooser(sendIntent, "도착 정보 공유"))
                    webView.post {
                        webView.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('jofams-native-share-opened'));",
                            null
                        )
                    }
                } catch (_: Exception) {
                    notifyWebShareError("공유할 수 있는 앱을 열지 못했습니다.")
                }
            }
        }

        @JavascriptInterface
        fun isNativeShareAvailable(): Boolean = true
    }

    /**
     * 카카오톡/문자 등으로 공유할 때 첨부할 썸네일 이미지를 캐시 파일로 준비하고,
     * FileProvider를 통해 다른 앱이 읽을 수 있는 content:// Uri로 변환한다.
     * assets에 미리 넣어둔 원본을 캐시에 한 번만 복사해 재사용한다.
     */
    private fun resolveShareThumbnailUri(): Uri? {
        return try {
            val shareCacheDir = File(cacheDir, "share").apply { mkdirs() }
            val cacheFile = File(shareCacheDir, "jofams_share_thumbnail.jpg")
            if (!cacheFile.exists() || cacheFile.length() == 0L) {
                assets.open("share/jofams_share_thumbnail.jpg").use { input ->
                    FileOutputStream(cacheFile).use { output -> input.copyTo(output) }
                }
            }
            FileProvider.getUriForFile(this, "$packageName.fileprovider", cacheFile)
        } catch (_: Exception) {
            null
        }
    }

    private inner class VoiceBridge {
        @JavascriptInterface
        fun isNativeVoiceAvailable(): Boolean = true

        @JavascriptInterface
        fun startRecognition() {
            runOnUiThread {
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ko-KR")
                    putExtra(RecognizerIntent.EXTRA_PROMPT, "목적지를 말씀해 주세요")
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                }
                try {
                    voiceRecognitionLauncher.launch(intent)
                } catch (_: ActivityNotFoundException) {
                    notifyWebToast("Google 음성 인식 서비스를 사용할 수 없습니다.")
                }
            }
        }
    }

    private inner class PermissionBridge {
        @JavascriptInterface
        fun isNativePermissionBridgeAvailable(): Boolean = true

        @JavascriptInterface
        fun hasLocationPermission(): Boolean = hasFineLocationPermission()

        @JavascriptInterface
        fun hasCameraPermission(): Boolean = this@MainActivity.hasCameraPermission()

        @JavascriptInterface
        fun requestLocationPermission() {
            runOnUiThread {
                if (hasFineLocationPermission()) ensureHighAccuracyLocationSettings()
                else startupPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            }
        }

        @JavascriptInterface
        fun requestCameraPermission() {
            runOnUiThread {
                if (!hasCameraPermission()) startupPermissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
            }
        }
    }

    private inner class LocationBridge {
        @JavascriptInterface
        fun isNativeLocationAvailable(): Boolean = true

        @JavascriptInterface
        fun startHighAccuracy() {
            runOnUiThread { ensureHighAccuracyLocationSettings() }
        }

        @JavascriptInterface
        fun requestSingleFix() {
            runOnUiThread {
                if (!hasFineLocationPermission()) {
                    startupPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                    return@runOnUiThread
                }
                ensureHighAccuracyLocationSettings()
                nativeNavigationEngine.requestSingleFix()
            }
        }

        @JavascriptInterface
        fun stopIfIdle() {
            // 내비게이션 앱 특성상 Activity가 화면에 있는 동안 고정밀 수신을 유지합니다.
            // onPause/onDestroy에서만 실제 수신을 중단합니다.
        }
    }


    /**
     * 최신 웹소스의 nativePost('navigationState', ...)를 받는 네이티브 내비게이션 브리지.
     * WebView는 화면/UI로 남더라도 위치수집·GNSS 품질판정·센서융합·터널 DR은 네이티브 엔진이 담당한다.
     */
    private inner class NavigationBridge {
        @JavascriptInterface
        fun postMessage(message: String?) {
            if (message.isNullOrBlank()) return
            runOnUiThread {
                runCatching {
                    val root = JSONObject(message)
                    when (root.optString("type")) {
                        "navigationState" -> {
                            val payload = root.optJSONObject("payload")
                            val active = payload?.optBoolean("active", false) ?: false
                            nativeNavigationEngine.setNavigationActive(active)
                            if (active) NavigationForegroundService.start(this@MainActivity)
                            else NavigationForegroundService.stop(this@MainActivity)
                            if (active) setNavigationRotation(true)
                            if (active && !nativeDriveActive) {
                                ensureHighAccuracyLocationSettings()
                                requestNativeDriveWhenRouteReady()
                            } else if (!active) {
                                pendingNativeDriveRequest = false
                                if (nativeDriveActive) hideNativeDrive() else setNavigationRotation(false)
                            }
                        }
                        "routeGeometry" -> {
                            val payload = root.optJSONObject("payload")
                            nativeNavigationEngine.updateRoute(payload?.optJSONArray("geometry")?.toString())
                            tryShowNativeDriveIfPending()
                        }
                        "navigationPayload" -> {
                            val payload = root.optJSONObject("payload")
                            nativeGuideCharacter = payload?.optString("character").orEmpty().ifBlank { nativeGuideCharacter }
                            if (payload != null) updateNativeRouteContext(payload)
                            nativeGuidanceEngine.updateNavigationState(payload?.toString())
                            val route = payload?.optJSONObject("route")
                            nativeNavigationEngine.updateRoute(route?.optJSONArray("geometry")?.toString())
                            val lat = nativeDestinationLat
                            val lng = nativeDestinationLng
                            if (lat != null && lng != null) {
                                nativeSafetyRepository.refresh(lat, lng, nativeGuidanceEngine.routePoints(), true)
                            }
                            tryShowNativeDriveIfPending()
                        }
                    }
                }
            }
        }

        @JavascriptInterface
        fun updateRoute(geometryJson: String?) {
            nativeNavigationEngine.updateRoute(geometryJson)
            tryShowNativeDriveIfPending()
        }

        @JavascriptInterface
        fun updateNavigationState(payloadJson: String?) {
            runOnUiThread {
                nativeGuidanceEngine.updateNavigationState(payloadJson)
                runCatching {
                    val root = JSONObject(payloadJson ?: "{}")
                    nativeGuideCharacter = root.optString("character").ifBlank { nativeGuideCharacter }
                    updateNativeRouteContext(root)
                    val route = root.optJSONObject("route")
                    nativeNavigationEngine.updateRoute(route?.optJSONArray("geometry")?.toString())
                    // 웹이 경로 데이터(터널 이름 구간)로 판단한 현재 터널 진입 여부를 네이티브
                    // dead-reckoning의 장거리 허용 상한(90초→최대 25분) 판단에 반영한다.
                    nativeNavigationEngine.setKnownTunnelActive(root.optBoolean("tunnelActive", false))
                }
                tryShowNativeDriveIfPending()
            }
        }

        @JavascriptInterface
        fun setNavigationActive(active: Boolean) {
            runOnUiThread {
                nativeNavigationEngine.setNavigationActive(active)
                if (active) NavigationForegroundService.start(this@MainActivity)
                else NavigationForegroundService.stop(this@MainActivity)
                if (active && !nativeDriveActive) {
                    ensureHighAccuracyLocationSettings()
                    showNativeDrive()
                } else if (!active) {
                    if (nativeDriveActive) hideNativeDrive() else setNavigationRotation(false)
                }
            }
        }

        @JavascriptInterface
        fun isNativeNavigationEngineAvailable(): Boolean = true
    }

    private fun updateNativeRouteContext(root: JSONObject) {
        val destination = root.optJSONObject("destination")
        nativeDestinationLat = destination?.optDouble("lat", Double.NaN)?.takeIf { it.isFinite() }
        nativeDestinationLng = destination?.optDouble("lng", Double.NaN)?.takeIf { it.isFinite() }
        nativeDestinationName = destination?.optString("name").orEmpty().ifBlank { "목적지" }
        nativeArrivalCandidateCount = 0
        nativeArrivalHandled = false
        nativeRoutePriority = root.optString("routePriority", "RECOMMEND").ifBlank { "RECOMMEND" }
        nativeRouteAvoid = root.optString("routeAvoid").takeIf { it.isNotBlank() }

        val wp = root.optJSONArray("waypoints")
        val list = ArrayList<Pair<Double,Double>>()
        if (wp != null) {
            for (i in 0 until wp.length()) {
                val o = wp.optJSONObject(i) ?: continue
                val lat = o.optDouble("lat", Double.NaN)
                val lng = o.optDouble("lng", Double.NaN)
                if (lat.isFinite() && lng.isFinite()) list += lat to lng
            }
        }
        nativeWaypoints = list
    }

    private fun requestNativeReroute(event: NativeNavigationEngine.RouteDeviation) {
        if (!nativeDriveActive) return
        val dLat = nativeDestinationLat ?: return
        val dLng = nativeDestinationLng ?: return
        nativeRouteClient.reroute(
            NativeRouteClient.RouteRequest(
                originLat = event.rawLat,
                originLng = event.rawLng,
                heading = event.bearing,
                destinationLat = dLat,
                destinationLng = dLng,
                priority = nativeRoutePriority,
                avoid = nativeRouteAvoid,
                waypoints = nativeWaypoints
            )
        )
    }

    private fun applyNativeReroute(route: JSONObject) {
        val payload = JSONObject().apply {
            put("route", route)
            put("safetyEvents", org.json.JSONArray())
            nativeDestinationLat?.let { lat ->
                nativeDestinationLng?.let { lng ->
                    put("destination", JSONObject().apply { put("lat",lat); put("lng",lng); put("name","목적지") })
                }
            }
            put("character", nativeGuideCharacter)
        }
        nativeGuidanceEngine.updateNavigationState(payload.toString())
        nativeNavigationEngine.updateRoute(route.optJSONArray("geometry")?.toString())
        tryShowNativeDriveIfPending()
        nativeDestinationLat?.let { lat ->
            nativeDestinationLng?.let { lng ->
                nativeSafetyRepository.refresh(lat, lng, nativeGuidanceEngine.routePoints(), true)
            }
        }
        if (::nativeDriveView.isInitialized) {
            nativeDriveView.setStatusMessage("새 경로 적용")
            nativeDriveView.postDelayed({ nativeDriveView.setStatusMessage(null) }, 1400L)
        }

        // WebView에는 검색/홈 상태 호환을 위해 새 route 객체만 동기화한다.
        // CCTV/구간단속/VSL 조회는 8.3.0부터 NativeSafetyRepository가 직접 담당한다.
        if (::webView.isInitialized) {
            val quoted = JSONObject.quote(route.toString())
            webView.post {
                webView.evaluateJavascript(
                    """
                    (function(){
                      try{
                        const r=JSON.parse($quoted);
                        if(typeof state!=='undefined'){
                          state.route=r;
                          if(typeof buildCumulative==='function')state.routeCumulative=buildCumulative(r);
                        }
                      }catch(e){console.warn('native reroute web sync failed',e)}
                    })();
                    """.trimIndent(),
                    null
                )
            }
        }
    }

    /**
     * 길안내 중에만 가로 회전을 허용한다. 그 외 화면은 세로 고정.
     *
     * 1) FULL_SENSOR로 기본 회전을 허용하고,
     * 2) 단말의 시스템 '자동 회전'이 꺼져 있거나 제조사 정책으로 SENSOR 계열이 무시되는 경우를
     *    대비해 OrientationEventListener로 실제 기기 각도를 감시, 가로로 눕히면 LANDSCAPE /
     *    REVERSE_LANDSCAPE, 세워 들면 PORTRAIT를 직접 요청한다.
     */
    private fun setNavigationRotation(enabled: Boolean) {
        navRotationEnabled = enabled
        if (!enabled) {
            navRotationListener?.disable()
            navRotationListener = null
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            return
        }
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        // 태블릿(자연 방향이 가로인 기기)은 각도 매핑이 달라 시스템 센서 회전에 맡긴다.
        if (resources.configuration.smallestScreenWidthDp >= 600) return
        if (navRotationListener != null) return
        navRotationListener = object : OrientationEventListener(this) {
            override fun onOrientationChanged(degrees: Int) {
                if (!navRotationEnabled || degrees == ORIENTATION_UNKNOWN) return
                val target = when {
                    degrees in 60..120 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                    degrees in 240..300 -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    degrees <= 25 || degrees >= 335 -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    else -> return // 경계 각도에서는 현재 방향 유지(떨림 방지)
                }
                if (requestedOrientation != target) requestedOrientation = target
            }
        }.also { if (it.canDetectOrientation()) it.enable() }
    }

    private fun showNativeDrive() {
        if (!::nativeDriveView.isInitialized) return
        nativeDriveActive = true
        // 길안내 화면에서는 가로 회전을 허용한다(자세한 방식은 setNavigationRotation 참고).
        setNavigationRotation(true)
        nativeDriveView.visibility = View.VISIBLE
        nativeDriveView.bringToFront()
        webView.visibility = View.INVISIBLE
    }

    /**
     * 안내가 시작돼도 경로 좌표가 아직 준비되지 않았다면 네이티브 화면을 바로 띄우지 않는다.
     * (경로 도착 전에 "경로를 준비하고 있습니다" 같은 중간 화면이 사용자 눈에 보이면
     * 오작동/버그로 오인하기 쉬우므로, 완전히 준비된 뒤에만 전환한다.)
     * 그동안은 이미 정상적으로 안내 중인 웹뷰 화면이 계속 보인다.
     */
    private fun requestNativeDriveWhenRouteReady() {
        if (nativeGuidanceEngine.routePoints().size >= 2) {
            showNativeDrive()
            return
        }
        pendingNativeDriveRequest = true
        val requestedAt = ++nativeDriveShowToken
        if (::nativeDriveView.isInitialized) {
            nativeDriveView.postDelayed({
                if (requestedAt == nativeDriveShowToken && pendingNativeDriveRequest) {
                    // 시간 내에 경로가 도착하지 않으면 네이티브 화면 전환을 조용히 포기하고
                    // 계속 웹 안내 화면을 보여준다(사용자에게는 아무 변화도 보이지 않음).
                    pendingNativeDriveRequest = false
                }
            }, NATIVE_DRIVE_ROUTE_TIMEOUT_MS)
        }
    }

    private fun tryShowNativeDriveIfPending() {
        if (!pendingNativeDriveRequest) return
        if (nativeGuidanceEngine.routePoints().size >= 2) {
            pendingNativeDriveRequest = false
            showNativeDrive()
        }
    }

    private fun hideNativeDrive() {
        nativeDriveActive = false
        pendingNativeDriveRequest = false
        // 길안내 화면을 벗어나면 다시 세로모드로 고정한다.
        setNavigationRotation(false)
        if (::nativeDriveView.isInitialized) nativeDriveView.visibility = View.GONE
        if (::webView.isInitialized) webView.visibility = View.VISIBLE
    }

    private fun stopNativeDriveFromUi() {
        nativeNavigationEngine.setNavigationActive(false)
        NavigationForegroundService.stop(this)
        nativeGuidanceEngine.clear()
        hideNativeDrive()
        if (::webView.isInitialized) {
            webView.post {
                webView.evaluateJavascript(
                    "try{if(typeof stopNavigation==='function'){stopNavigation();}}catch(e){console.warn(e)}",
                    null
                )
            }
        }
    }

    private fun speakNativeGuidance(text: String) {
        val message = text.trim()
        if (message.isBlank()) return
        runOnUiThread {
            val engine = tts ?: return@runOnUiThread
            if (!ttsReady) return@runOnUiThread
            val guide = nativeGuideCharacter.ifBlank { "daim" }
            selectBestKoreanVoice(guide)
            engine.setSpeechRate(
                when (guide) {
                    "sunsik" -> 0.84f
                    "hunmin" -> 0.86f
                    else -> 0.96f
                }
            )
            engine.setPitch(
                when (guide) {
                    "sunsik" -> 0.72f
                    "hunmin" -> 0.58f
                    else -> 1.02f
                }
            )
            requestNavigationAudioFocus()
            val params = Bundle().apply {
                putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
            }
            engine.speak(
                message,
                TextToSpeech.QUEUE_FLUSH,
                params,
                "jofams-native-guidance-${System.nanoTime()}"
            )
        }
    }

    private fun hasFineLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED

    private fun hasCameraPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED

    private fun ensureHighAccuracyLocationSettings() {
        if (!hasFineLocationPermission()) return
        val request = LocationSettingsRequest.Builder()
            .addLocationRequest(highAccuracyLocationRequest)
            .setAlwaysShow(true)
            .build()
        LocationServices.getSettingsClient(this)
            .checkLocationSettings(request)
            .addOnSuccessListener { startNativeLocationUpdates() }
            .addOnFailureListener { error ->
                if (error is ResolvableApiException) {
                    runCatching {
                        val req = IntentSenderRequest.Builder(error.resolution).build()
                        locationSettingsLauncher.launch(req)
                    }.onFailure { startNativeLocationUpdates() }
                } else {
                    startNativeLocationUpdates()
                }
            }
    }

    @SuppressLint("MissingPermission")
    private fun startNativeLocationUpdates() {
        if (!hasFineLocationPermission() || nativeLocationRunning) return
        nativeLocationRunning = true
        nativeNavigationEngine.start()
        notifyNativeGpsState(true, "네이티브 GNSS·센서융합 엔진 활성화")
    }

    private fun stopNativeLocationUpdates() {
        if (!nativeLocationRunning) return
        nativeLocationRunning = false
        if (::nativeNavigationEngine.isInitialized) nativeNavigationEngine.stop()
    }


    private fun deliverNativeNavigationFix(fix: NativeNavigationEngine.NavigationFix) {
        if (!::webView.isInitialized) return
        val payload = fix.toJson()
        val json = payload.toString()
        webView.post {
            // 1) 최신 웹소스용 직접 native bridge
            webView.evaluateJavascript(
                "try{if(window.JofamsNative&&typeof window.JofamsNative.onLocationUpdate==='function'){window.JofamsNative.onLocationUpdate($json);}}catch(e){console.warn(e)};" +
                        // 2) 기존 navigator.geolocation shim 호환
                        "try{if(window.__jofamsNativeLocationReceive){window.__jofamsNativeLocationReceive($json);}}catch(e){console.warn(e)};",
                null
            )
        }
        if (!nativeDriveActive && System.currentTimeMillis() - lastVoucherWarmAt >= 2200L) {
            warmHomeVoucherLayers(force = false)
        }
    }

    private fun warmHomeVoucherLayers(force: Boolean) {
        if (!::webView.isInitialized || nativeDriveActive) return
        val now = System.currentTimeMillis()
        if (!force && now - lastVoucherWarmAt < 1800L) return
        lastVoucherWarmAt = now
        webView.post {
            val forceJs = if (force) "true" else "false"
            webView.evaluateJavascript(
                """
                (function(){
                  try{
                    const home=document.getElementById('homeView');
                    if(home && home.classList.contains('hidden')) return;
                    if(typeof scheduleLocalVoucherRefresh==='function') scheduleLocalVoucherRefresh($forceJs);
                    if(typeof scheduleOnnuriRefresh==='function') scheduleOnnuriRefresh($forceJs);
                    if(typeof loadLocalVoucherMap==='function') Promise.resolve(loadLocalVoucherMap({force:$forceJs})).catch(()=>{});
                    if(typeof loadOnnuriMap==='function') Promise.resolve(loadOnnuriMap({force:$forceJs})).catch(()=>{});
                  }catch(e){console.warn('native voucher warm failed',e)}
                })();
                """.trimIndent(),
                null
            )
        }
    }

    private fun evaluateNativeArrival(snapshot: NativeGuidanceEngine.NativeDriveSnapshot) {
        if (!nativeDriveActive || nativeArrivalHandled) return
        val dLat = nativeDestinationLat ?: return
        val dLng = nativeDestinationLng ?: return
        val result = FloatArray(1)
        Location.distanceBetween(snapshot.latitude, snapshot.longitude, dLat, dLng, result)
        val straightM = result[0].toDouble()
        val name = nativeDestinationName.replace(" ", "")
        // 대형 사업장/공공기관은 목적지 POI가 건물 내부에 찍히는 경우가 많아 정문 진입구간에서 종료한다.
        val gateThreshold = when {
            name.contains("한국조폐공사") || name.contains("조폐공사본사") -> 190.0
            name.contains("본사") || name.contains("공사") || name.contains("공단") || name.contains("대학교") || name.contains("병원") -> 120.0
            else -> 75.0
        }
        val routeNear = snapshot.remainingDistanceM <= gateThreshold
        val geoNear = straightM <= maxOf(gateThreshold + 80.0, 150.0)
        val plausibleSpeed = snapshot.speedKmh <= 70
        if (routeNear && geoNear && plausibleSpeed) nativeArrivalCandidateCount++ else nativeArrivalCandidateCount = 0
        if (nativeArrivalCandidateCount < 2) return
        nativeArrivalHandled = true
        speakNativeGuidance("${nativeDestinationName} 정문 부근에 도착했습니다. 길안내를 종료합니다.")
        if (::nativeDriveView.isInitialized) nativeDriveView.setStatusMessage("목적지 도착")
        webView.postDelayed({ stopNativeDriveFromUi() }, 1100L)
    }

    private fun deliverNativeGnssState(state: NativeNavigationEngine.GnssQuality) {
        if (!::webView.isInitialized) return
        val payload = JSONObject().apply {
            put("satelliteCount", state.satelliteCount)
            put("satellitesUsed", state.satellitesUsed)
            put("meanCn0DbHz", state.meanCn0DbHz)
            put("strongSatellites", state.strongSatellites)
            put("updatedAt", state.updatedAt)
        }
        val json = payload.toString()
        webView.post {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('jofams-native-gnss-state',{detail:$json}));",
                null
            )
        }
    }

    private fun notifyNativeGpsState(active: Boolean, message: String) {
        if (!::webView.isInitialized) return
        val safe = JSONObject.quote(message)
        webView.post {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('jofams-native-gps-state',{detail:{active:$active,message:$safe}}));",
                null
            )
        }
    }

    private fun initNativeTts() {
        tts = TextToSpeech(applicationContext) { status ->
            if (status != TextToSpeech.SUCCESS) {
                ttsReady = false
                notifyWebTtsState(false, "Android TTS 초기화에 실패했습니다.")
                return@TextToSpeech
            }

            val engine = tts ?: return@TextToSpeech
            engine.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = Unit
                override fun onDone(utteranceId: String?) = abandonNavigationAudioFocus()
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) = abandonNavigationAudioFocus()
                override fun onError(utteranceId: String?, errorCode: Int) = abandonNavigationAudioFocus()
            })

            val languageResult = engine.setLanguage(Locale.KOREA)
            ttsReady = languageResult != TextToSpeech.LANG_MISSING_DATA &&
                    languageResult != TextToSpeech.LANG_NOT_SUPPORTED
            notifyWebTtsState(
                ttsReady,
                if (ttsReady) "" else "한국어 TTS 음성 데이터가 없습니다."
            )
        }
    }

    private fun selectBestKoreanVoice(character: String) {
        val engine = tts ?: return
        val korean = engine.voices?.filter {
            it.locale?.language.equals("ko", ignoreCase = true)
        }.orEmpty()
        if (korean.isEmpty()) return

        fun score(v: Voice): Int {
            val name = v.name.lowercase(Locale.ROOT)
            var value = if (!v.isNetworkConnectionRequired) 25 else 0
            value += when (character) {
                "sunsik" -> when {
                    listOf("male", "man", "injoon", "jinho", "hyunsu", "deep")
                        .any(name::contains) -> 90
                    listOf("female", "woman", "sunhi", "yuna", "sora")
                        .any(name::contains) -> -60
                    else -> 5
                }
                "hunmin" -> when {
                    listOf("male", "man", "deep", "bass", "baritone", "mature", "low", "injoon", "jinho", "hyunsu")
                        .any(name::contains) -> 95
                    listOf("female", "woman", "sunhi", "yuna", "sora")
                        .any(name::contains) -> -60
                    else -> 5
                }
                else -> when {
                    listOf("female", "woman", "sunhi", "yuna", "sora", "seoyeon")
                        .any(name::contains) -> 75
                    else -> 5
                }
            }
            return value + v.quality
        }

        korean.maxByOrNull(::score)?.let { engine.voice = it }
    }

    private inner class TtsBridge {
        @JavascriptInterface
        fun isReady(): Boolean = ttsReady

        @JavascriptInterface
        fun speak(text: String?, character: String?, rate: Double, pitch: Double, volume: Double) {
            val message = text?.trim().orEmpty()
            if (message.isBlank()) return

            runOnUiThread {
                val engine = tts
                if (!ttsReady || engine == null) {
                    notifyWebTtsState(false, "Android TTS가 준비되지 않았습니다.")
                    return@runOnUiThread
                }

                val guide = character?.takeIf { it.isNotBlank() } ?: "daim"
                selectBestKoreanVoice(guide)

                val tunedRate = when (guide) {
                    "sunsik" -> 0.84f
                    "hunmin" -> 0.86f
                    else -> rate.toFloat().coerceIn(0.65f, 1.35f)
                }
                val tunedPitch = when (guide) {
                    "sunsik" -> 0.72f
                    "hunmin" -> 0.58f
                    else -> pitch.toFloat().coerceIn(0.70f, 1.35f)
                }

                engine.setSpeechRate(tunedRate)
                engine.setPitch(tunedPitch)
                requestNavigationAudioFocus()

                val params = Bundle().apply {
                    putFloat(
                        TextToSpeech.Engine.KEY_PARAM_VOLUME,
                        volume.toFloat().coerceIn(0f, 1f)
                    )
                }
                engine.stop()
                engine.speak(
                    message,
                    TextToSpeech.QUEUE_FLUSH,
                    params,
                    "jofams-nav-${System.nanoTime()}"
                )
            }
        }

        @JavascriptInterface
        fun stop() {
            runOnUiThread {
                tts?.stop()
                abandonNavigationAudioFocus()
            }
        }
    }

    private fun requestNavigationAudioFocus() {
        val manager = getSystemService(AUDIO_SERVICE) as AudioManager
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setOnAudioFocusChangeListener { }
                .setAcceptsDelayedFocusGain(false)
                .build()
            audioFocusRequest = request
            manager.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            manager.requestAudioFocus(
                null,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            )
        }
    }

    private fun abandonNavigationAudioFocus() {
        val manager = getSystemService(AUDIO_SERVICE) as AudioManager
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            audioFocusRequest?.let { runCatching { manager.abandonAudioFocusRequest(it) } }
            audioFocusRequest = null
        } else {
            @Suppress("DEPRECATION")
            runCatching { manager.abandonAudioFocus(null) }
        }
    }

    private fun currentAppSigningSha1(): String {
        return runCatching {
            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
            }

            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val signingInfo = packageInfo.signingInfo
                if (signingInfo?.hasMultipleSigners() == true) {
                    signingInfo.apkContentsSigners
                } else {
                    signingInfo?.signingCertificateHistory
                }
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }

            val digest = MessageDigest.getInstance("SHA-1")
            signatures?.firstOrNull()?.toByteArray()?.let { bytes ->
                digest.digest(bytes).joinToString(":") { "%02X".format(it) }
            }.orEmpty()
        }.getOrDefault("")
    }

    private fun resolveGoogleWebClientId(): String {
        val resourceId = resources.getIdentifier("default_web_client_id", "string", packageName)
        val fromGoogleServices = if (resourceId != 0) getString(resourceId).trim() else ""
        return fromGoogleServices.ifBlank { BuildConfig.GOOGLE_WEB_CLIENT_ID.trim() }
    }

    private fun googleSignInOptions(): GoogleSignInOptions {
        val clientId = resolveGoogleWebClientId()
        return GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestProfile()
            .apply { if (clientId.isNotBlank()) requestIdToken(clientId) }
            .build()
    }

    private fun startNativeGoogleLogin() {
        if (nativeGoogleLoginInProgress) return
        val clientId = resolveGoogleWebClientId()
        if (clientId.isBlank()) {
            notifyWebLoginError(
                "Google Web Client ID가 없습니다. 최신 google-services.json을 적용해 주세요."
            )
            return
        }

        // OAuth misconfiguration guard. requestIdToken() MUST receive the Web OAuth client,
        // not the Android OAuth client. Keeping these separate prevents DEVELOPER_ERROR(10).
        if (clientId == BuildConfig.GOOGLE_ANDROID_CLIENT_ID.trim()) {
            notifyWebLoginError(
                "Google OAuth Client ID 설정이 잘못되었습니다. Android Client ID가 Web Client ID로 지정되어 있습니다."
            )
            return
        }
        if (packageName != "com.komsco.jofams.smartdrive") {
            notifyWebLoginError("앱 패키지명이 Firebase 등록값과 다릅니다: $packageName")
            return
        }
        // 서명 SHA-1은 앱 내부에서 차단하지 않습니다.
        // 개발 APK와 Google Play App Signing의 인증서는 서로 다를 수 있으며,
        // 실제 OAuth 허용 여부는 Firebase/Google OAuth의 패키지명 + SHA 인증서 등록이 판단합니다.
        // KNOWN_SIGNING_SHA1S는 오류 진단용이며 로그인 허용/차단 조건으로 사용하지 않습니다.

        nativeGoogleLoginInProgress = true
        val client = GoogleSignIn.getClient(this, googleSignInOptions())
        googleLoginLauncher.launch(client.signInIntent)
    }

    private fun deliverPendingGooglePayload() {
        val payload = pendingGooglePayload ?: return
        if (!::webView.isInitialized) return
        webView.post {
            webView.evaluateJavascript(
                "(function(){if(window.__JOFAMS_NATIVE_AUTH_HANDLERS__){window.dispatchEvent(new CustomEvent('jofams-native-google-token',{detail:$payload}));return 'delivered'}return 'waiting'})();",
                { result -> if (result?.contains("delivered") == true) pendingGooglePayload = null }
            )
        }
    }

    private fun notifyWebLoginError(message: String) {
        nativeGoogleLoginInProgress = false
        if (!::webView.isInitialized) return
        val safe = JSONObject.quote(message)
        webView.post {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('jofams-native-google-error',{detail:{message:$safe}}));",
                null
            )
        }
    }

    private fun notifyWebTtsState(ready: Boolean, message: String) {
        if (!::webView.isInitialized) return
        val safe = JSONObject.quote(message)
        webView.post {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('jofams-native-tts-state',{detail:{ready:$ready,message:$safe}}));",
                null
            )
        }
    }

    private fun notifyWebShareError(message: String) {
        if (!::webView.isInitialized) return
        val safe = JSONObject.quote(message)
        webView.post {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('jofams-native-share-error',{detail:{message:$safe}}));",
                null
            )
        }
    }

    private fun notifyWebToast(message: String) {
        if (!::webView.isInitialized) return
        val safe = JSONObject.quote(message)
        webView.post {
            webView.evaluateJavascript(
                "if(typeof window.toast==='function'){window.toast($safe)}else{console.warn($safe)};",
                null
            )
        }
    }

    override fun onResume() {
        super.onResume()
        if (navRotationEnabled) {
            navRotationListener?.let { if (it.canDetectOrientation()) it.enable() }
        }
        if (::fusedLocationClient.isInitialized && hasFineLocationPermission()) {
            ensureHighAccuracyLocationSettings()
        }
        if (::webView.isInitialized) {
            webView.onResume()
            webView.resumeTimers()
            webView.postDelayed({
                injectNativeCompatibilityShim(webView)
                webView.evaluateJavascript(
                    "window.dispatchEvent(new Event('jofams-app-resumed'));",
                    null
                )
                deliverPendingGooglePayload()
            }, 100)
        }
    }

    override fun onPause() {
        navRotationListener?.disable()
        // 길안내 중에는 화면 꺼짐/앱 전환에도 위치 수신을 끊지 않는다(포그라운드 서비스가 유지).
        if (!(::nativeNavigationEngine.isInitialized && nativeNavigationEngine.isNavigationActive())) {
            stopNativeLocationUpdates()
        }
        if (::webView.isInitialized) webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        navRotationListener?.disable()
        navRotationListener = null
        NavigationForegroundService.stop(this)
        stopNativeLocationUpdates()
        pendingMediaPermissionRequest?.deny()
        pendingMediaPermissionRequest = null

        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("JofamsAuthBridge")
            webView.removeJavascriptInterface("JofamsShareBridge")
            webView.removeJavascriptInterface("JofamsTtsBridge")
            webView.removeJavascriptInterface("JofamsLocationBridge")
            webView.stopLoading()
            webView.destroy()
        }

        tts?.stop()
        tts?.shutdown()
        tts = null
        ttsReady = false
        abandonNavigationAudioFocus()
        super.onDestroy()
    }
}
