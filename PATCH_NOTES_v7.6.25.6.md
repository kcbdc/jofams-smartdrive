# v7.6.25.6 – Workers AI 통합

- 기존 `/api/ai-recommend` 유지.
- 신규 `/api/ai-assist`에서 `voice_parse`(구조화 JSON), `route_compare`(제공된 숫자만 설명) 지원.
- 기존 음성 규칙 우선, 복합 명령만 AI 분류 후 규칙 기반 처리. 실패 시 기존 검색 사용.
- 경로 카드 아래 모델 선택 및 AI 경로 비교 버튼, AI 장애 시 수치 기반 비교 제공.
- 주행 안전, 단속, GPS 계산 로직은 수정하지 않음.
- Cloudflare Pages Workers AI binding `AI` 필요; 실제 클라우드 모델 호출 검증은 배포 후 수행.
- API 공개 접근 관련 Cloudflare WAF/rate-limit 권장.
