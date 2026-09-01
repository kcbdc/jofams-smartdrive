# 조팸스 스마트 드라이브 MVP 6.4

## 주요 개선

### 지도 로딩 안정화
- MapLibre GL JS 6.6.0을 v6 권장 방식인 ESM(`maplibre-gl.mjs`)으로 동적 로딩
- unpkg 실패 시 jsDelivr ESM으로 자동 fallback
- 기본 지도 타일을 브라우저가 외부 서버에 직접 요청하지 않고 Cloudflare Pages Function `/api/tile`을 통해 same-origin으로 제공
- `/api/tile`은 CARTO 타일을 우선 사용하고 실패 시 OpenStreetMap 타일로 fallback
- Cloudflare edge cache 및 브라우저 cache-control 적용
- Pages Function 타일 프록시 실패 시 브라우저에서 OSM → CARTO 직접 타일 fallback 유지
- 지도 진입 시 resize 및 경로 재렌더링 유지

### 캐릭터 음성
- 순식: 저음 중년 남성 보이스 우선 선택
  - rate 0.86
  - pitch 0.62
  - 성숙/저음/남성 계열 TTS 이름 우선
- 훈민: 밝은 청년 남성 보이스 우선 선택
  - rate 1.12
  - pitch 1.08
  - 젊은/밝은/남성 계열 TTS 이름 우선
- 기기에 한국어 남성 TTS가 여러 개 있으면 순식과 훈민이 서로 다른 음성을 우선 사용
- 전용 음성이 없는 기기에서는 rate/pitch 차이로 캐릭터 성격을 유지

## Cloudflare 배포
`functions/api/tile.js`가 반드시 함께 배포되어야 합니다.

배포 후 다음 주소가 이미지 타일을 반환하는지 확인할 수 있습니다.

`/api/tile?z=14&x=13985&y=6469`

Pages Functions가 정상 배포되어 있다면 HTTP 200 및 PNG 이미지가 반환됩니다.

## Android
- compileSdk 36
- targetSdk 36
- versionCode 64
- versionName 6.4.0


## MVP 6.6 지도 스타일 수정
- 기본 지도: OpenFreeMap Liberty 컬러 벡터 스타일 (`https://tiles.openfreemap.org/styles/liberty`)
- API KEY REQUIRED 워터마크를 발생시키던 기존 Carto 타일 경로 제거
- OpenFreeMap 로딩 실패 시 OpenStreetMap Standard → OSM HOT 컬러 타일 순서로 fallback
- 지도는 흑백이 아니라 도로·공원·수계·POI가 구분되는 컬러 스타일을 기본 적용


## MVP 6.6 변경
- 장소 검색 결과를 검색어 포함/정확 일치 우선으로 재정렬하고 역명 검색을 보강했습니다.
- 지도는 pitch 0의 2D 컬러 탑뷰로 고정하며 3D 건물 레이어를 숨깁니다.
- MY에 주행기록, 앱정보, 개인정보처리방침 메뉴를 추가했습니다.
