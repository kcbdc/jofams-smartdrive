# Kakao Navi SDK 연결 지점

`app` 모듈은 API 36 WebView host 자체가 빌드 가능한 구조이며 Kakao SDK는 키/라이선스 없이도 소스 검토가 가능하도록 기본 dependency에서 분리했습니다.

운영 앱에서는 Kakao Mobility 공식 Android SDK 설치 문서의 repository/dependency와 앱 키 초기화를 추가한 뒤 `MainActivity.kt`의 아래 hook을 실제 SDK delegate와 연결합니다.

- `requestLaneFromKakaoSdk()` → 현재 `KNGuide_Route.lane` → `bridge.emitLane(...)`
- `requestImageDirectionFromKakaoSdk()` → `KNGuide_Route.imgDirection` → PNG/JPEG data URL → `bridge.emitImageDirection(...)`
- `requestSafetyFromKakaoSdk()` → safety camera/section speed limit → `bridge.emitSafety(...)`
- `requestRoadEventsFromKakaoSdk()` → `KNGuide_Route.roadEvents` → `bridge.emitRoadEvents(...)`
- `requestAlternativeFromKakaoSdk()` → `KNGuide_Route.multiRouteInfo` → `bridge.emitAlternativeRoute(...)`
- `acceptAlternativeInKakaoSdk()` → 설치 SDK 버전의 대안 경로 전환 API 호출
- 터널/지하차도 → SDK map-matched 위치를 `bridge.emitLocation(...)`, 상태를 `bridge.emitTunnelState(true/false)`로 전달

Web packet 형식은 루트 `native-bridge/README.md`를 참고하세요.
