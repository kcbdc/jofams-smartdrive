# 8.2.0 — Pure Native 즉시 재탐색

## 추가된 핵심
- NativeNavigationEngine이 실제 raw GPS 기준 경로 이탈을 직접 판정.
- 경로선에서 10m 초과 시 Kotlin에서 즉시 RouteDeviation 발생.
- 속도 6km/h 이상에서 경로 진행방향과 110도 이상 불일치가 2회 연속 확인되면 반대차선/역방향으로 판단.
- 145도 이상 + 양호한 GPS에서는 1회만으로 재탐색.
- NativeRouteClient가 WebView를 거치지 않고 SMARTDRIVE `/api/route`를 직접 POST 호출.
- 새 route는 NativeNavigationEngine/NativeGuidanceEngine에 즉시 적용.
- Pure Native 주행화면에 '경로 이탈 · 새 경로 계산 중' / '새 경로 적용' 상태 표시.
- 새 route 적용 뒤 숨겨진 WebView에는 route만 동기화해 기존 공식 CCTV/구간단속/ITS 데이터 로더가 새 경로 기준으로 다시 수집하도록 연결.

## 의미
실제 운전 중 경로 이탈 판정 → 재탐색 요청 → 새 경로 적용의 핵심 루프가 더 이상 웹 JavaScript 타이밍에 의존하지 않습니다.
