# JOFAMS NAVI 7.5.7.8

- Gradle 8.11.1 `transforms/.../metadata.bin` 손상 복구 스크립트 재작성 (실제 CRLF 배치파일)
- 전역 Gradle cache를 우회하는 `build-with-clean-gradle-home.bat` 추가
- package/applicationId `com.komsco.jofams.smartdrive` 고정 확인
- Firebase 등록 SHA-1 `E0:35:0D:67:D9:0A:F4:CE:28:2F:5A:20:0E:2A:65:6D:E2:AF:D5:FD` 진단값 반영
- Android OAuth Client와 Web OAuth Client를 분리 저장
- `requestIdToken()`은 Web OAuth Client(client_type 3)만 사용하도록 보호 로직 추가
- Android OAuth Client를 실수로 Web Client로 지정하면 로그인 전에 명확한 오류 표시
- versionCode 99 / versionName 7.5.7.8
