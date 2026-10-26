# v7.6.26.0 – 오피넷 유가 조회 수정

## 증상
"오피넷 접속오류 / 현재 반경에 판매가격 정보가 없습니다. 유종·위치를 확인해 주세요. / 오피넷 또는 네트워크 연결이 일시적으로 지연되고 있습니다."

## 원인 (functions/api/fuel.js)
1. **반경 조회가 아니었다.** `lowTop10.do`(시군구 최저가 N개)만 사용. 카카오 지역 키(KAKAO_REST_API_KEY)가 없거나 지역 매칭이 실패하면
   시군구/시도 코드가 비어 전국 목록 또는 빈 목록이 반환 → 클라이언트가 "현재 반경에 판매가격 정보가 없습니다"로 표시.
2. **오류도 캐시.** 성공/오류 모두 `cache-control: public, max-age=120` → 일시 오류가 2분간 캐시되어 재시도해도 같은 오류 반복.
3. 오피넷 호출에 User-Agent 없음, 인증 파라미터가 `certkey` 한 가지, https 실패 시 폴백 없음.
4. 클라이언트가 "데이터 없음"까지 "네트워크 지연" 문구로 안내(원인 구분 불가).

## 수정
- `aroundAll.do` 반경 5km 검색을 우선 사용(가격순 → 비면 거리순). 시군구/시도 `lowTop10` 은 카카오 키가 있을 때만 폴백(전국 폴백 제거).
- 오피넷 좌표(KATEC)를 서버에서 WGS84 로 변환해 `lat/lng` 제공(카카오 지오코딩 불필요). pyproj 와 교차 검증, 오차 < 1m.
- 오류/빈 응답은 `no-store`, 정상 응답만 `max-age=60, s-maxage=120`.
- 호출: User-Agent/Accept 헤더, `certkey`+`code` 인증 파라미터 동시 전송, https → http 폴백, 8초 타임아웃.
- 오류 코드 구분: `OPINET_KEY_MISSING / OPINET_KEY_REJECTED / OPINET_BLOCKED / OPINET_UPSTREAM_ERROR / FUEL_EMPTY / INVALID_COORDINATES`.
- `(0,0)` 좌표(위치 미확보 값) 거부.
- 진단: `/api/fuel?lat=36.37&lng=127.38&diag=1` → 단계별 HTTP 상태/오류(인증키 값은 포함하지 않음).
- 클라이언트(app.js): 오류 코드별 정확한 안내 문구 + "다시 시도" 버튼, 데이터 없음은 `FUEL_EMPTY` 로 구분.

## 배포 후 확인 (Cloudflare Pages)
1. Settings → Variables and Secrets(Production) 에 `OPINET_CERT_KEY` 등록 후 **재배포**(환경변수는 재배포해야 반영됨).
2. 브라우저에서 `https://<도메인>/api/fuel?lat=36.3745&lng=127.3845&prodcd=B027&diag=1` 호출:
   - `stations` 가 채워지면 정상.
   - `code: OPINET_KEY_REJECTED` → 인증키/승인 상태 확인.
   - `code: OPINET_BLOCKED` 또는 trace 에 HTTP 403/HTML → 오피넷이 Cloudflare 출구 IP 를 차단한 경우(프록시 필요).
   - trace 의 `status` 가 200 인데 `stations` 가 비면 해당 유종의 반경 내 데이터가 없는 것.

## 검증 범위
- 모의 오피넷 응답으로 17개 시나리오 통과(정상/https 실패→http/빈 결과/전체 실패/인증키 오류/HTML 차단/키 미설정/잘못된 좌표/캐시 헤더/키 노출 없음).
- 실제 오피넷 서버 호출과 사용자의 인증키는 배포 환경에서만 확인 가능(이번 점검에서는 오피넷에 접속하지 못함).
