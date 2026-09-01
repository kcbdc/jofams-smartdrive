# 조팸스 스마트 드라이브 · MVP5 Pre Final Stable

사용자 화면 겹침과 로그인 지연을 안정화한 프리 MVP5 통합본입니다.

## 주요 변경
- 경로 선택 시트가 하단 고정 메뉴바에 가려지지 않도록 동적 뷰포트/안전 여백 재설계
- 목적지 선택 후 3초 뒤 자동 안내 시작
- 가상주행 배속 ×2 / ×4 / ×6 선택
- 서비스 소개성 "상용화 가능한 프리 MVP 5" 문구 제거
- MY 화면의 서비스 연동 상태 점검 UI 제거
- Google 로그인 UI 즉시 갱신 및 Firestore 로딩 비동기/타임아웃 처리
- Android WebView 시스템바/노치 인셋 반영
- MY 상단 닫기 버튼 sticky 처리 및 모바일 브라우저 UI 충돌 완화
- 주행 HUD/차로/교차로/하단 조작부 레이어 간 안전 간격 재조정

## 배포
Cloudflare Pages/Functions/D1 및 Firebase 설정은 기존 구조를 유지합니다. `config.js`, Pages Secrets, D1 Binding 값을 실제 환경 값으로 설정하세요.
