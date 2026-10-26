# v7.6.26.6 CSS 맵 마커 충돌/구코드 정리

- 기준: v7.6.26.5 ZIP 전체 소스
- 지도 가맹점 마커 구 스타일(#driveView 후손 선택자, MapLibre 요소 아래 중첩 button 가정, 과거 v7.6.25.0~25.4 덮어쓰기) 삭제.
- 실제 `drivePoiMarkerHtml()`이 생성하는 `button.drive-route-food-marker.dangollo-drive-merchant-marker`가 MapLibre 마커 루트임을 확인하고 단일 스타일로 교체.
- 지도 좌표를 소유한 MapLibre inline `transform`을 CSS로 덮어쓰지 않음.
- 주행 아닐 때 해당 마커 숨김. 기존 카메라/캐릭터 z-index 분리 유지.
- AI/주행 오버레이·반응형/기존 디자인의 상호 의존성을 고려해 다른 중복 선택자는 무작정 삭제하지 않음.
- 잔여 기술부채: 동일 선택자 중복 176종, `!important` 다수는 별도 장치별 회귀 검증 후 단계적 리팩터링 권고.
- 자동 정적 검사: CSS 파싱, JS 문법, ZIP 무결성. 실기기 시각/주행 검증 미실시.
