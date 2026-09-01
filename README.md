# 조팸스 스마트 드라이브 · MVP5 Pre Final

첨부된 상용화 UI 시안을 기준으로 홈 / 경로선택 / 주행 HUD / AR / 주차장 / MY 화면을 통합 정리한 MVP5 직전 최종 프리버전입니다.

## UI/UX
- 홈: 햄버거 / 알림 / 목적지 검색 / 집·회사 / 즐겨찾기 / 최근 목적지 / 주변 탐색
- 캐릭터: 다임·순식·훈민 카드와 캐릭터별 TTS 프로필
- 경로선택: 추천·빠른길·대안경로 + **훈민 무료도로 추천**
- HUD: 상단 방향 카드 → 차로 카드 → 교차로 카드 → 하단 속도·도착 카드 자동 배치
- AR: 원근형 파란 경로 리본 + 방향 화살표 + 캐릭터 말풍선
- 주차: 상태 배지 + 거리/요금 힌트 + 바로 안내
- MY: Google 로그인, 즐겨찾기, 주행기록, 음성 볼륨/캐릭터 음성, 연동 상태 점검

## Cloudflare / D1
`wrangler.toml`에는 가짜 D1 UUID를 넣지 않았습니다. GitHub Pages 배포 후 Dashboard에서 `DB` binding을 연결하면 됩니다.
상세: `docs/DEPLOYMENT_FINAL.md`

## Firebase
`config.js`에 Firebase Web 설정을 입력한 뒤 Google 로그인과 Firestore rules를 설정합니다.
MY 화면의 **서비스 연동 상태 > 연동 상태 점검**에서 Auth/Firestore 상태를 확인할 수 있습니다.
상세: `docs/FIREBASE_CHECK.md`

## Android WebView
`android-app/gradle.properties`의 `SMARTDRIVE_URL`을 실제 Pages 주소로 변경합니다.
- targetSdk 36
- 카메라 / GPS
- HTTPS WebView
- Native Bridge
- 네트워크 오류 재시도
상세: `android-app/docs/FINAL_WEBVIEW_SETUP.md`

## 데모
- `/?demo=home`
- `/?demo=route`
- `/?demo=drive`
- `/?demo=my`
