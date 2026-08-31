# Android API 36 WebView Host — 4차 MVP

Cloudflare Pages에 배포된 `jofams-smartdrive-v4`를 Android 앱으로 감싸는 최소 host입니다.

1. `gradle.properties`의 `SMARTDRIVE_URL`을 실제 Pages HTTPS 주소로 변경합니다.
2. Android Studio에서 `android-app` 폴더를 엽니다.
3. API 36 SDK/JDK 17을 설치하고 실행합니다.
4. 위치와 카메라 권한을 허용합니다.
5. Kakao Navi SDK의 정밀 차로/교차로 이미지/안전운행/대안경로가 필요하면 `docs/KakaoNaviSdkIntegration.md`의 hook을 연결합니다.

보안상 WebView는 `SMARTDRIVE_URL`과 같은 HTTPS host만 내부에서 열고 나머지는 외부 브라우저로 보냅니다. JavaScript interface도 해당 웹 앱에서만 사용하도록 구성했습니다.
