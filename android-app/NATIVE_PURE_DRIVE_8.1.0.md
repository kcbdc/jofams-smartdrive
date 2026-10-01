# 조팸스 내비 8.1.0 — Pure Native Drive + Kotlin Safety/Guidance Engine

## 구조
- 홈/검색/MY/로그인: 기존 WebView 유지
- 길안내 시작 후 주행화면: Android `NativeDriveView`가 전체 화면을 담당
- 위치·GNSS·터널 추측항법: `NativeNavigationEngine`
- 분기/좌우 진출·CCTV·구간단속·제한속도·남은거리/시간: `NativeGuidanceEngine`

## NativeDriveView
Android Canvas 기반 순수 네이티브 화면입니다.
- heading-up 경로 표시
- 현재속도/제한속도
- 다음 회전/분기/고속도로 좌우 진출
- CCTV/구간단속 패널
- 구간평균속도/잔여거리
- GPS 정확도/위성 사용 수/추정주행 상태
- 남은거리/남은시간/ETA
- 안내종료

WebView DOM/HTML Canvas로 주행 UI를 그리지 않습니다.

## Kotlin Safety/Guidance
웹에서 계산된 route/safety 원자료를 Native bridge로 전달한 뒤,
실제 주행 판단과 화면/음성 표시는 Kotlin에서 수행합니다.
- routeIndex 기준 다음 안내 판정
- 10m 미만/0m 안내 제거
- 고속도로/도시고속도로 우측 진출 타입: 명시적 '오른쪽으로 빠져 이동'
- CCTV 최대 1.2km 전방 후보 선택
- 구간단속 시점~종점 활성화
- 구간 평균속도 계산
- roadSegment 제한속도 우선, 근접 camera/section 값을 보조 사용
- 경로 진행방향과 Native map matching을 연동

## 상용 수준 정확도를 위해 아직 필요한 외부 요소
Pure Native 전환으로 위치/주행 판단 지연은 크게 줄일 수 있지만,
차선 단위 상용 내비와 완전히 동일한 정확도는 앱 코드만으로 보장할 수 없습니다.
다음 데이터/SDK가 있으면 추가 개선할 수 있습니다.
- 차선 단위 HD map 또는 상용 Navigation SDK
- 실시간 도로규제/차로 연결정보
- 최신 CCTV/구간단속/제한속도 원천 데이터
- 차량 CAN/OBD 속도·yaw 입력(선택)
- Android Foreground Location Service(백그라운드 지속 주행)

## 빌드
versionName: 8.1.0
versionCode: 210
