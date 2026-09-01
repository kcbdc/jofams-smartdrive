# 조팸스 스마트 드라이브 MVP 6

MVP6는 길찾기/주행 화면을 실제 운전 중 필요한 핵심 정보 위주로 다시 작성한 버전입니다.

## MVP6 핵심 변경
- 기존 길찾기 내부 AR, 주차 추천, 가상주행, 교차로 확대, 다중 배너/팝업 제거
- 주행 화면을 단순화: 다음 회전, 후속 회전, 현재 속도/제한속도, 경로선, 남은시간/거리, 재탐색, 주행 메뉴
- 목적지 선택 후 경로 계산이 완료되면 3초 뒤 자동 안내 시작
- 다임/순식/훈민 선택 상태 유지
- 선택 캐릭터의 KOMSCO 자동차 이미지가 실제 GPS 위치 마커로 표시되어 목적지까지 경로를 따라 이동
- 경로 이탈 감지 시 자동 재탐색
- 캐릭터별 TTS rate/pitch 적용
- Google 로그인/Firebase 설정 동기화 유지
- Android API 36 WebView host 단순화: 카메라/AR/Native Bridge 제거, GPS 내비게이션 중심

## 웹 배포
Cloudflare Pages 저장소 루트에 전체 파일을 배포합니다.

필수 구성:
- `KAKAO_REST_API_KEY` : Cloudflare Secret
- `KAKAO_DIRECTIONS_TIER=standard`
- D1 사용 시 `DB` binding을 `jofams-smartdrive-db`에 연결

`wrangler.toml`의 D1 UUID는 현재 프로젝트에서 사용 중인 값을 유지했습니다. 다른 Cloudflare 계정에 배포하면 해당 UUID를 새 D1 database_id로 교체하세요.

## Firebase
`config.js`에는 Firebase Web config가 들어 있습니다. Google Authentication을 활성화하고 실제 Pages 도메인을 Firebase Authentication > Authorized domains에 추가하세요.

## Android
`android-app`을 Android Studio에서 열고 `gradle.properties`의 `SMARTDRIVE_URL`을 실제 Cloudflare Pages HTTPS 주소로 설정합니다.
- compileSdk 36
- targetSdk 36
- versionCode 6
- versionName 6.0.0
- 위치 권한만 사용

## 캐릭터 자동차 자산
- `assets/daim_car.png` / `daim_car_marker.png`
- `assets/sunsik_car.png` / `sunsik_car_marker.png`
- `assets/hunmin_car.png` / `hunmin_car_marker.png`

`*_marker.png`는 지도 위에서 사용하도록 외곽 배경을 투명화한 파일입니다.
