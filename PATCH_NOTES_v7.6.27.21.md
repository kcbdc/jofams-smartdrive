# 단골로 v7.6.27.21 — Gemma·Llama 응답 호환성 패치

## 원인 및 변경 사항
- Cloudflare 공식 Gemma 4 모델은 thinking 모드를 지원하며 공식 사용 예시는 `chat_template_kwargs: { enable_thinking: false }`를 사용합니다. 짧은 UI/JSON 처리에서는 이를 Gemma에만 적용합니다.
- Gemma에 `max_completion_tokens`와 기존 `max_tokens`를 제공하고, 생성 출력 한도를 780~850 토큰으로 확대합니다.
- `response` 문자열 외에 `result.response`, `choices[0].message.content`, `output_text`, 텍스트 블록 배열 등 반환 형태를 처리합니다.
- 모델 응답이 비어 있거나 일시적인 예외일 때 최대 1회 재시도하며, 인증/할당량/모델 부재 오류는 무의미하게 반복하지 않습니다.
- 두 API `/api/ai-assist`, `/api/ai-recommend`에 동일하게 적용. 성공 응답에 사용 모델을 명시하며, 오류 시 모델 식별자를 반환합니다.

## 변경 파일
- `functions/api/ai-assist.js`
- `functions/api/ai-recommend.js`
- `index.html` (빌드 식별자 7.6.27.21)

## 보존 파일
- `functions/api/fuel.js`, `app.js`, `styles.css`, `wrangler.toml.example` 및 나머지 프로젝트 파일은 v7.6.27.20과 바이트 단위 동일.

## 주의
- 실제 Cloudflare 계정의 Workers AI 호출 및 무료 사용량, 모델 별 과부하 상황은 코드만으로 보증할 수 없습니다.
- Cloudflare 대시보드 Settings > Bindings의 `AI` 바인딩을 유지하고 전체 배포 후 Llama/Gemma 각각 음성 해석·경로 비교·가맹점 설명을 테스트하세요.
