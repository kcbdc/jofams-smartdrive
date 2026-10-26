# 단골로 v7.6.27.1 — 지도 레이어 순서 보정

- 요청한 순서: 도로/경로선 → 단속카메라 GeoJSON symbol → 차량 캐릭터 MapLibre DOM 마커.
- `ensureRouteCameraStackOrder()` 신설: 카메라 심볼을 기존 경로 종점 심볼 바로 아래에 배치하고, 종점이 없으면 WebGL 레이어 최상단에 배치.
- 경로 재그리기, 단속카메라 소스 렌더링, 위성/일반 지도 스타일 복구 시 순서 재확인.
- CSS z-index로 WebGL 심볼을 제어하려는 시도 없음. GPS, AI, 오피넷 API 변경 없음.
- 정적 문법/ZIP 검사 수행. 실제 Android WebView 실주행 화면 미검증.
