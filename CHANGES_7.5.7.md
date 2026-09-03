# JOFAMS NAVI 7.5.7 통합 안정화

- Android Google 로그인: WebView redirect 대신 네이티브 JofamsAuthBridge 직접 호출, ID token -> Firebase signInWithCredential 처리, 앱 복귀/취소 시 로그인 버튼 복원.
- 제한속도: 현재 route road segment의 speedLimit 최우선. 단속카메라 제한속도를 현재 도로 제한속도로 사용하지 않음. OSM maxspeed는 동일 현재 세그먼트 보조값만 사용.
- 터널: GPS 2.5초 이상 단절 시 마지막 실측 속도로 누적 route distance를 0.5초 간격 전진. 3분까지 추정, 실 GPS 복귀 시 즉시 동기화. 추정 중에는 경로이탈 재탐색 금지.
- 자동 재탐색: 경로 이탈 3회 연속 확인 시에만 음성/경로 재탐색. GPS 정확도에 따라 이탈 임계값 가변.
- AR: 별도 AR HUD/리본 대신 일반 길안내 UI를 그대로 유지하고 배경만 후면 카메라 영상으로 전환.
- 캐릭터: 주행속도 > 약 1.3km/h일 때만 미세 전진/bob 애니메이션. 0km/h에서는 정지.

## 제한속도 주의
도로 제한속도는 경로 공급자 또는 현재 도로에 매칭되는 명시적 maxspeed 데이터가 있을 때만 표시합니다. 값이 불명확하면 잘못된 숫자를 추정 표시하지 않고 `--`로 표시합니다. 실제 표지판/도로교통 규제가 최우선입니다.
