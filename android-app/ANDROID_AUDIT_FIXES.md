# JOFAMS NAVI Android 점검/개선 결과

## 수정한 주요 문제
1. AGP 8.10.1과 Gradle 9.3.0 조합을 공식 호환 기준 Gradle 8.11.1로 수정.
2. Android WebView에서 음성이 누락되는 문제를 네이티브 TextToSpeech 브리지로 보강.
3. 원격 웹소스가 아직 브리지 코드를 호출하지 않아도 speechSynthesis 호출을 Android TTS로 전달하는 호환 shim 추가.
4. 내비 음성용 Audio Focus(ducking) 적용 및 발화 종료 후 focus 반환.
5. 외부 공유 Intent의 FLAG_ACTIVITY_NEW_DOCUMENT 제거. 공유 후 기존 앱 task로 복귀.
6. navigator.share가 제한되는 WebView에서 Android 공유 시트를 사용하는 shim 추가.
7. WebView renderer crash/OOM 시 흰 화면 고착 대신 WebView 재생성.
8. 메인 프레임 일시 네트워크 오류 시 최대 2회 지연 재시도.
9. 앱 복귀 시 WebView resume/timer 복구 및 네이티브 shim 재주입.
10. 마이크 권한을 앱 시작 시 강제 요청하지 않고 실제 음성입력 요청 시 승인하도록 개선.
11. Google 로그인 Web Client ID는 google-services.json의 default_web_client_id를 우선 사용하도록 변경.
12. Google 로그인 status 10은 패키지명/SHA-1/OAuth 설정 오류임을 사용자 화면에 구체적으로 안내.
13. deprecated onBackPressed 대신 OnBackPressedDispatcher 사용.
14. 외부 URL/intent 처리 예외를 방어해 ActivityNotFoundException 앱 종료 방지.
15. Android API 36 유지, versionCode 90 / versionName 7.5.5로 갱신.

## Google 로그인 오류(10) 관련 중요 확인
현재 제공된 google-services.json에는 package_name=com.komsco.jofams.smartdrive와 Web OAuth client(type 3)는 있으나 Android OAuth client(type 1)가 없습니다.
Firebase Console의 Android 앱에 현재 서명 SHA-1을 등록한 후 google-services.json을 다시 다운로드해야 합니다.
현재 첨부 AAB 서명 SHA-1:
E0:35:0D:67:D9:0A:F4:CE:28:2F:5A:20:0E:2A:65:6D:E2:AF:D5:FD
Google Play App Signing을 사용하면 Play Console의 앱 서명 SHA-1도 Firebase에 추가하세요.

## 배포 전
- 새 google-services.json 교체
- Firebase Authentication > Google 활성화
- 앱 삭제 후 재설치 테스트
- release 빌드에서 Google 로그인 / 위치 / 카메라 / AR / TTS / 외부 공유 테스트
