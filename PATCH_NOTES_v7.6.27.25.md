# 단골로 v7.6.27.25 — 홈 현 위치 날씨

- 홈 「가는 길에, 우리 동네 혜택까지」 옆 귀여운 SVG 날씨 칩 추가(맑음/구름/비/눈/뇌우/안개, 온도).
- 현위치 state.user 기준 Cloudflare Pages Functions `/api/weather` → Open-Meteo 현재 날씨, 10분 간격 및 3km 이동 시 갱신.
- GPS 미확보·API 실패 시 임의 온도 표시하지 않음. 별도 API 사용으로 오피넷·AI·경로 함수 변경 없음.
- 날씨 데이터 출처: Open-Meteo (서비스 사용 조건, 출처 표기 확인 필요).
- 추가 및 수정: index.html, styles.css, app.js, functions/api/weather.js. `fuel.js` 및 기존 AI 함수 내용은 원본과 동일.
- 실기기 위치/운영 날씨 API 연동은 배포 후 검증 필요.
