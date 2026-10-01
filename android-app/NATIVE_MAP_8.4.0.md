# 8.4.0 — Pure Native Map / Junction / Lane / Safety Overlay

## 신규
- NativeNavigationMapView.kt
- 주행지도 자체를 Android Canvas Native renderer로 분리
- heading-up 경로선
- 진행한 경로/앞으로 갈 경로 분리
- 현재 도로명 표시
- 분기 확대뷰
- 고속도로/도시고속도로 오른쪽/왼쪽 진출 확대 안내
- 3차로 형태의 차로 유도 레이어
- CCTV 아이콘
- 구간단속 시작/종료 아이콘
- 제한속도/현재속도/안전정보 HUD
- GPS 정확도/위성 사용수/터널 추정주행 상태

## 주의
이 버전의 지도는 외부 Native Map SDK를 쓰지 않는 route-centric native renderer입니다.
즉 도로 배경지도 전체를 내려받는 SDK 방식은 아니며, 주행에 필요한 경로/안전/분기 정보를 네이티브로 직접 그립니다.
차선 단위 실제 lane topology는 현재 route API에 lane 데이터가 없으므로 maneuver type을 기반으로 3차로 유도 형태를 생성합니다.
실제 차선 단위 정확도를 구현하려면 lane/HD map 정보가 있는 상용 Navigation SDK 또는 별도 차선 데이터가 필요합니다.
