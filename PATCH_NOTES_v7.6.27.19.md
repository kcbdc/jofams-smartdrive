# 단골로 v7.6.27.19 — 첨부 수정_v7.6.27.18 기반 복합 AI 조건 검색

## 원본 유지 원칙
- **원본 `functions/api/fuel.js` 바이트 단위 완전 유지** (SHA-256 원본과 일치).
- `functions/api/ai-recommend.js`, `wrangler.toml.example` 역시 원본 그대로 유지.
- 기존 경로·GPS·카메라 및 기존 지도 CSS 블록 변경 없음.
- 추가 코드는 `app.js`, `index.html`, `styles.css`, `functions/api/ai-assist.js`에만 적용.

## 신기능
1. 홈 목적지 입력창에 AI 음성 버튼 및 예시 문장 버튼 추가.
2. `/api/ai-assist`에 `trip_plan` 추가: Llama/Gemma가 업종, 결제수단, 최대 우회시간, 목적지 조건을 구조화 JSON으로 반환. 서버에서 허용값/한도 검증. 오류 시 제한된 규칙 기반 폴백.
3. 목적지가 없으면 별도 검색 시트에서 목적지 후보를 사용자가 직접 선택. 첫 번째 검색 결과 자동 채택 금지.
4. `/api/local-voucher` 및 `/api/onnuri-voucher` 실제 후보만 조회. 결제수단별 분리, 업종이 확인되지 않으면 보수적 제외.
5. 기존 `/api/route` 경유지 경로 재계산으로 실제 증가시간 산출. 지정 우회시간을 넘는 후보 제외. API 응답 없는 후보 제외.
6. 경유지 적용은 사용자 후보 선택 후에만 가능. 경로 갱신 후 별도 안내 시작. 주행 중에는 변경을 막고 정차를 요구.
7. AI 조건검색 전용 데이터 로더에서는 **오피넷 조회를 하지 않음**.

## 유의사항
- 첨부 원본에는 `/api/search`, `/api/route`, `/api/onnuri-voucher`, `/api/local-voucher` 서버 함수가 포함되지 않았으므로 실제 운영 서버에서 각각 응답해야 합니다.
- 위 소스의 정적 JavaScript 문법 검사는 통과했지만 모바일 실사용, 실제 AI/가맹점/경로 API 호출은 미검증입니다.
- 오피넷 정상 조회를 보장하는 패치가 아닙니다. 파일이 원본과 동일하다는 점만 확인했습니다.
- 상점 업종이나 결제 가능 여부가 공공데이터에 없으면 후보가 제외될 수 있습니다.
- 지도상 근접 거리와 실제 자동차 우회시간은 별개입니다. 최종 우회시간은 경로 API로만 판단합니다.
- `gemma` 선택은 기존 routeAiModel/driveAiModel 선택을 따릅니다. 홈 기본 모델은 Llama입니다.
- Cloudflare Workers AI 바인딩 `AI`가 있어야 LLM 호출이 실행됩니다.
