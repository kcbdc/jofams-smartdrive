# 단골로 — 원본 재활용 UI/UX 디자인 우선 통합본

원본 `jofams-smartdrive-main(3).zip`을 수정 최소화 방식으로 적용했습니다.

## 원본 3중 검토
1. **구조:** index.html, styles.css, app.js, native-bridge, API, 지도·안내 연동을 확인했습니다.
2. **자산:** 다임·순식·훈민 기본/자동차/차량 마커, KOMSCO 숏폼(komscoShortsHomeBlock, komscoShortsScroll, api/komsco-shorts), 오피넷 유가(fuelPriceSummary, fuelStationList, api/fuel) 구조 확인.
3. **보존/영향:** 기존 요소 ID, 스크립트, API, 캐릭터 선택, 내비게이션 흐름은 변경하지 않았고 신규 스타일 레이어만 추가했습니다.

## 변경 파일
- index.html: 타이틀과 홈 상단 브랜딩/캐릭터 히어로 섹션 추가, 기존 기능 영역 유지.
- dangollo-theme.css: 디자인 토큰, 화면 카드, 검색/내비 시각 개선.
- manifest.webmanifest: 설치 이름과 색상 변경.

## 그대로 유지한 기능
- 원본 app.js, styles.css 전체, Cloudflare functions, 데이터셋, native-bridge, 카메라·경로 및 안전안내 엔진 인터페이스
- KOMSCO 유튜브 숏폼 영역과 API, 유가 공개 영역과 API, 차량용 조팸스 캐릭터·마커

## 유의
본 산출물은 **디자인 우선 1차 구현**입니다. 기존 서비스 환경변수/지도 API 키/Cloudflare D1 설정을 별도로 연결해야 실제 조회가 됩니다. 외부 맵·유가 등 기능의 실기기 회귀 테스트는 수행하지 않았습니다. 브랜딩 변경은 기존 기능에 영향을 주지 않도록 국소적으로 적용했습니다.

## 실행
원본과 동일한 Cloudflare Pages 환경에 소스 디렉터리 배포(환경변수 및 D1 연동 유지). 로컬에서는 정적 서버로 시각 검토 가능합니다.
