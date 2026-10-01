# 조팸스 내비 8.0.0 — Native Navigation Engine 전환

## 이번 구조 변경

기존 앱은 WebView가 `navigator.geolocation`과 웹 자바스크립트에서 위치 필터·터널 추측항법까지 대부분 담당했습니다.

8.0.0에서는 **주행 핵심을 Android Kotlin NativeNavigationEngine으로 이동**했습니다.

- Android FusedLocationProvider + GPS_PROVIDER 병렬 수신
- 200~250ms 고정밀 위치 샘플링 요청
- Android GNSS 위성 상태(GnssStatus) 직접 수집
- 위성 사용 수, 평균 CN0, speedAccuracy, bearingAccuracy 기반 품질평가
- 노이즈성 `speed=0` 제거
- Rotation Vector + Gyroscope 센서융합
- 실제 진행방향 기반 경로 매칭
- 평행 반대차선 heading 패널티
- 경로선을 Android 엔진으로 전달하여 터널에서 경로 기반 Dead Reckoning
- GPS 끊김 1.5초 후 DR, 최대 90초
- GPS 재획득 3.5초 smooth convergence
- raw GPS와 표시좌표를 별도 전달
- 최신 웹의 `JofamsNavigationBridge`와 구버전 `navigator.geolocation` shim 모두 호환

## 중요한 현실적 한계

이 변경은 Android에서 얻을 수 있는 GNSS/센서 데이터를 훨씬 적극적으로 활용하는 구조입니다.
하지만 소프트웨어가 휴대전화 GPS 안테나의 **물리적 RF 수신감도 자체를 증폭할 수는 없습니다.**

또한 TMAP/카카오내비 같은 상용 내비게이션과 동일한 수준은
- 차선 단위 HD map
- 실시간 차선/도로규제 데이터
- 사업자 전용 map matching/navigation SDK
- 차량 CAN/속도 펄스
등이 결합될 때 가능합니다.

따라서 8.0.0은 현재 프로젝트에서 API key/별도 상용 SDK 없이 구현 가능한 범위에서
**위치수집·터널연속성·진행방향 판별을 네이티브화한 기반 버전**입니다.

## 다음 단계 권장

완전한 Pure Native 화면까지 전환하려면 다음 단계에서:
1. WebView 홈/검색/마이 화면을 Jetpack Compose로 이동
2. Native map SDK 채택
3. 기존 `/api/route` 응답을 Kotlin NavigationRoute 모델로 변환
4. CCTV/구간단속/제한속도도 Kotlin SafetyEngine으로 이동
5. Foreground location service + notification으로 백그라운드 주행 지속

현재 ZIP은 기존 서비스 기능을 깨뜨리지 않기 위해 WebView UI는 유지하면서,
**실제 주행 엔진만 먼저 네이티브로 전환**한 안전한 마이그레이션 단계입니다.
