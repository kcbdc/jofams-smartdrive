# Android WebView MVP5 Pre 반영

## 빌드 주소
`android-app/gradle.properties`의 다음 값을 실제 Cloudflare Pages 주소로 변경하세요.

```properties
SMARTDRIVE_URL=https://jofams-smartdrive.pages.dev/
```

## 포함 사항
- compileSdk / targetSdk 36
- 위치·카메라 권한
- WebView geolocation/camera 권한 전달
- HTTPS 동일 호스트는 WebView 유지, 외부 URL은 시스템 브라우저로 분리
- mixed content 차단
- WebView 멀티윈도우 비활성화
- 메인 프레임 네트워크 오류 시 1.5초 후 자동 재시도
- Native Bridge 유지: 차로, 안전운행, 교차로 이미지, AR, 대안경로

## Firebase Google 로그인 주의
일반 브라우저 Pages에서는 Firebase Google 로그인을 사용합니다. 일부 Android WebView/Google OAuth 정책 조합에서는 임베디드 로그인 흐름이 제한될 수 있습니다. 실제 Android 배포판에서 문제가 확인되면 Firebase Auth를 네이티브 Credential Manager 방식으로 전환하고 ID token을 웹에 전달하는 구조가 권장됩니다. 현재 소스는 Web Firebase 로그인을 유지하며 MY 페이지의 `연동 상태 점검`으로 로그인/Firestore 상태를 확인할 수 있습니다.
