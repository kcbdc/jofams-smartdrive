# v7.6.25.3 주행 가맹점 SVG 복구

## 확인된 원인
MapLibre 생성 DOM(.maplibregl-marker)은 #driveView 밖에 위치하므로 종전 `#driveView .drive-route-food-marker` 선택자가 적용되지 않았습니다.

## 수정
실제 MapLibre 마커 DOM `.maplibregl-marker.dangollo-drive-merchant-marker` 기반으로 핀, 내부 SVG 크기/색상/회전, 가시성을 직접 지정. 기존 홈 마커 SVG 함수 `voucherShopSvg()`와 `onnuriShopSvg()` 및 마커 클릭 동작 유지.

## 제한
정적 문법/참조 검사는 통과. 실제 운영 브라우저 렌더링은 검증하지 못함.
