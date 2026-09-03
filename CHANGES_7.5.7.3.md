# JOFAMS NAVI 7.5.7.3 - Google OAuth fix

- 신규 Firebase `google-services.json` 반영.
- Android OAuth client(type 1) 포함 확인.
- 패키지명: `com.komsco.jofams.smartdrive`.
- 등록된 Android 인증서 SHA-1: `E0:35:0D:67:D9:0A:F4:CE:28:2F:5A:20:0E:2A:65:6D:E2:AF:D5:FD`.
- Web OAuth client(type 3)는 기존과 동일한 값으로 확인.
- Google 로그인 status 10 발생 시 설치된 APK/AAB의 실제 SHA-1과 패키지명을 오류 메시지에 함께 표시하도록 진단 강화.
- 앱 버전 7.5.7.3 / versionCode 94.

주의: Android Studio의 debug APK는 debug keystore SHA-1이 별도입니다. debug 빌드를 테스트한다면 해당 SHA-1도 Firebase Android 앱에 추가하고 `google-services.json`을 다시 받아야 합니다.
Google Play App Signing 사용 시 Play Console의 앱 서명 인증서 SHA-1도 Firebase에 추가해야 합니다.
