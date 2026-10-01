# 조팸스 내비 Android 고정밀 GPS 강화 (7.5.6)

- Google FusedLocationProviderClient 사용
- PRIORITY_HIGH_ACCURACY
- 목표 위치 갱신 1초 / 최소 0.5초
- 최소 이동거리 0.5m
- GRANULARITY_FINE + waitForAccurateLocation
- Android 위치설정이 부족하면 고정밀 위치 활성화 시스템 안내 호출
- 네이티브 위치를 WebView navigator.geolocation에 주입
- 위치 정확도 100m 초과 순간 튐은 최근 양질 좌표가 있을 때 필터링
- Activity 화면 표시 중 GPS 수신 유지, 백그라운드에서는 중단
- 화면 꺼짐으로 GPS 주행 안내가 끊기지 않도록 FLAG_KEEP_SCREEN_ON 적용

주의: 사용자가 Android 권한에서 '대략적인 위치'만 허용하면 앱이 이를 강제로 정밀 위치로 바꿀 수 없습니다. 반드시 '정확한 위치'를 허용해야 합니다.
백그라운드 위치 권한은 Play Store 정책 부담과 개인정보 최소수집 원칙 때문에 이번 수정에는 추가하지 않았습니다.
