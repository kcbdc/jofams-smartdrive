# JOFAMS NAVI 7.5.7.2

## AR 복원
- 별도 AR 전용 HUD 복원
- 카메라 전면 표시 + 파란 반투명 주행 리본 복원
- 다음 회전/거리/도로명, AR 중앙 거리, 속도/ETA/잔여거리 HUD 복원
- AR 캐릭터는 기존 기준에서 화면 높이의 3%만 전방(위쪽)으로 이동
- 속도가 약 1.3km/h 이하이면 캐릭터 애니메이션 정지, 주행 중에만 미세 움직임

## Android 권한 처리
- 앱 시작 시 ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION / CAMERA 중 실제 미허용 권한만 요청
- 이미 위치와 카메라가 모두 허용되어 있으면 권한 다이얼로그를 다시 호출하지 않음
- WebView에 JofamsPermissionBridge 추가
- Android 네이티브 권한 상태를 웹 권한 게이트가 직접 확인하므로, WebView Permissions API가 `prompt`로 오판하여 권한 화면을 반복 노출하는 문제 방지
- 마이크는 기존처럼 음성입력 기능을 사용할 때만 요청

기존 7.5.7.1 클릭 불능 핫픽스, Google 로그인 복귀 보강, 고정밀 GPS, 터널 추정주행, 실제 이탈 시에만 재탐색 로직은 유지합니다.
