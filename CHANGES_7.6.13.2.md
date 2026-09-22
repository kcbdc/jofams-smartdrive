# 7.6.13.2 — 단속카메라 위치 정확도 구조 개선

## 요약
- 경찰청 표준데이터(data.go.kr) 위경도 오차로 안내가 일찍 시작/종료되는 현상에 대해,
  단기(코드) 개선 + 중장기(D1 인프라) 개선을 함께 반영.
- 전국 카메라 데이터를 Cloudflare D1에 적재하고, Worker API로 앱이 그때그때 불러오는
  구조를 새로 추가(`backend/` 폴더). 지역 수집 우선순위:
  대전→세종→충남→충북→대구→서울→경기→전북→전남→경북→경남→인천→강원→부산→광주→울산→제주.

## 코드(app.js) 변경
- `loadStaticCameraEvents`에서 카메라를 경로에 스냅할 때, 스냅 거리(routeMatchDistance)가
  40m를 넘으면 `lowPrecision: true`로 표시.
- `computeSafetyCandidates`: 저정밀 매칭 카메라는
  - 안내 시작 창을 최대 +40m(=80m*0.5) 더 일찍 열고,
  - 통과 직후에도 최대 60m까지 안내를 유지(tailGrace)하도록 하여,
  원본 좌표 오차로 인해 안내가 실제 위치보다 너무 일찍 끝나 보이는 문제를 완화.
  (근본 원인인 "원본 좌표 자체의 오차"는 아래 D1 파이프라인으로 계속 줄여나감)
- `updateSafetyUI`의 통과 판정도 동일한 tailGrace를 반영하도록 수정(안 그러면 위 여유가
  바로 다음 줄에서 무효화됨).
- 카메라 데이터 소스를 Cloudflare Worker API(`/api/cameras?bbox=...`)에서 우선 시도하고,
  실패 시(미배포/네트워크 오류) 기존 정적 JSON 4개 번들로 자동 폴백하는
  `fetchCamerasFromApi()` 추가. 배포 전에는 `CAMERA_API_BASE`가 비어 있어 기존과 100%
  동일하게 동작(하위 호환, 회귀 없음). Worker 배포 후 `CAMERA_API_BASE`만 채우면 활성화.
- Worker 응답은 원본 data.go.kr 한글 필드명 그대로 별칭 처리되어 있어, 기존
  `pickField(...)` 파싱 로직을 전혀 바꾸지 않고도 그대로 재사용 가능.

## 신규: backend/ (Cloudflare D1 + Worker 인프라)
- `backend/schema.sql` — 카메라 테이블(`cameras`), 실주행 확인 좌표 보정 이력
  (`camera_corrections`), 지역별 수집 현황(`ingest_runs`) 스키마.
- `backend/regions.mjs` — 17개 지역 우선순위 정의 및 시도명 정규화(신/구 행정구역명 별칭 포함).
- `backend/scripts/ingest-cameras.mjs` — data.go.kr
  `tn_pubr_public_unmanned_traffic_camera_api`를 페이지네이션으로 전량 수집한 뒤, 사용자가
  지정한 우선순위 순서(대전→세종→...→제주)대로 D1에 upsert. Worker의 CPU/서브리퀘스트
  한도를 피하기 위해 일반 Node 환경(GitHub Actions)에서 실행하고 D1 HTTP API로 직접 기록.
- `backend/worker/` — 조회 전용 Cloudflare Worker(`/api/cameras`, `/api/meta`,
  `/api/corrections`). 앱이 실시간으로 호출하는 가벼운 bbox 조회만 담당.
- `backend/.github/workflows/ingest-cameras.yml` — 매일 자동 재적재 크론(+수동 실행 버튼).
- `backend/DEPLOY.md` — D1 생성부터 Worker 배포, 최초 적재, 크론 시크릿 설정, 앱 연동,
  세종↔대전 고속화도로 등 우선 보정 구간 표시, 실주행 좌표 보정 반영 방법까지 단계별 가이드.

## 참고
- 이 저장소(zip)에는 `backend/` 스캐폴딩 코드만 포함되어 있고, 실제 Cloudflare 리소스
  생성·배포·데이터 최초 적재는 `backend/DEPLOY.md`를 따라 직접 진행해야 합니다
  (data.go.kr 서비스키, Cloudflare 계정/토큰 등 사용자 소유 자격 증명이 필요해 이 환경에서
  대신 실행할 수 없습니다).
