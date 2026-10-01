# 7.5.8.5 Google Play App Signing 로그인 수정

## 변경 사항
- 앱 내부의 단일 `EXPECTED_SIGNING_SHA1` 강제 비교/로그인 차단을 완전히 제거했습니다.
- 개발/업로드 서명과 Google Play App Signing 서명을 `KNOWN_SIGNING_SHA1S`에 진단용으로만 보관합니다.
- SHA-1이 목록과 달라도 앱에서 로그인 요청을 막지 않습니다.
- 실제 인증 허용 여부는 Google/Firebase OAuth가 `applicationId + SHA 인증서`로 판단합니다.
- Android 버전을 `versionCode 101`, `versionName 7.5.8.5`로 올렸습니다.

## 현재 확인된 SHA-1
- 개발/업로드 계열: `E0:35:0D:67:D9:0A:F4:CE:28:2F:5A:20:0E:2A:65:6D:E2:AF:D5:FD`
- 현재 Google Play 설치 앱: `0B:D8:16:EF:CF:46:87:BC:BD:7F:5A:D3:A2:6D:1C:1E:00:35:15:3D`

## Firebase Console에서 반드시 해야 할 작업
Firebase Console > 프로젝트 설정 > 내 앱 > Android 앱
`com.komsco.jofams.smartdrive`에 위 두 SHA-1을 모두 등록하세요.

특히 Google Play 배포본은 Play Console > 설정 > 앱 무결성의
**앱 서명 키 인증서 SHA-1**이 Firebase에 등록되어 있어야 합니다.

SHA-1을 Firebase에 추가한 뒤 최신 `google-services.json`을 다시 내려받아
`android-app/app/google-services.json`에 교체하는 것을 권장합니다.

주의: 이 소스는 앱 내부에서 잘못된 SHA-1을 강제로 차단하지 않도록 수정한 것입니다.
Firebase/Google Cloud 서버에 Play SHA-1이 실제로 등록되지 않은 상태라면
Google Sign-In의 `DEVELOPER_ERROR(10)` 자체는 서버측 설정 때문에 계속 발생할 수 있습니다.
