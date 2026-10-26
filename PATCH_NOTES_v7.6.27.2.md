# 단골로 v7.6.27.2 — 지도 4층 순서 및 카메라 10% 확대

- 1층: 도로 및 주행 경로선(교통색 포함)
- 2층: 경로 위 진행방향 화살표(`route-direction-arrows`)
- 3층: 경로 좌표에 고정된 단속카메라 GeoJSON 심볼(`dangollo-route-camera-fixed-symbol`)
- 4층: MapLibre DOM 차량 캐릭터 마커(`character-car-marker`)
- 카메라 심볼 `icon-size` 0.72 → 0.792 (정확히 10% 확대).
- `ensureRouteCameraStackOrder()`에서 방향 화살표와 카메라 순서를 순차 강제하여 경로 갱신·지도 스타일 전환 때도 반영.
- 출발·도착 심볼은 기존 위치/표시 방식 유지. CSS로 카메라 위치를 옮기지 않음.
- 정적 문법 검사 및 ZIP 무결성 검사 수행; 실제 모바일 환경 시각 회귀 테스트는 수행하지 못함.
