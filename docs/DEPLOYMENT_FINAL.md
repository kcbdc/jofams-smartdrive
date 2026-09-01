# Cloudflare Pages + D1 최종 배포 체크리스트

## 1. Pages
- GitHub 저장소 루트에 이 프로젝트를 업로드합니다.
- Cloudflare Pages에서 Git 저장소를 연결합니다.
- Framework preset: None
- Build command: 비움
- Build output directory: `.`
- Production branch: `main`

## 2. D1
```powershell
npx wrangler login
npx wrangler d1 create jofams-smartdrive-db
npx wrangler d1 migrations apply jofams-smartdrive-db --remote
```
Cloudflare Dashboard > Workers & Pages > jofams-smartdrive > Settings > Bindings에서 D1을 추가합니다.
- Variable name: `DB`
- Database: `jofams-smartdrive-db`

`wrangler.toml`에는 의도적으로 가짜 UUID를 넣지 않았습니다. 따라서 예전의 `Invalid database UUID (REPLACE_WITH_D1_DATABASE_ID)` 오류가 재발하지 않습니다.

## 3. Variables / Secrets
- Secret: `KAKAO_REST_API_KEY`
- Variable: `KAKAO_DIRECTIONS_TIER=standard`

## 4. 배포 후 확인
- `/api/health` 접속
- `integrations.kakao=true`
- `integrations.d1=true`
- 앱 > MY > 서비스 연동 상태 > `연동 상태 점검`
