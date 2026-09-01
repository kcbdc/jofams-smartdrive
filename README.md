# 조팸스 스마트 드라이브 MVP 6.3 안정화

## 이번 수정
- 길찾기 지도 표시 안정화
  - MapLibre CDN 이중 fallback: unpkg → jsDelivr
  - CARTO raster tile 실패 시 OSM tile 자동 fallback
  - route 화면 전환 즉시 `resize()` 및 route 재렌더링
  - style/tile 로딩 실패 watchdog 추가
- 최초 진입 권한 설정 UI
  - 위치 허용 버튼
  - 카메라 허용 버튼
  - `_headers`의 `camera=()` 오류를 `camera=(self)`로 수정
  - 권한 버튼 클릭 시 실제 브라우저 위치/카메라 permission 요청
- 목적지 선택 반응 속도 개선
  - 목적지 클릭 즉시 route 화면 전환
  - GPS 확인과 경로 계산은 화면 전환 후 비동기 처리
- 순식 보이스 남성화
  - 한국어 음성 중 `InJoon`, `Minho`, `Male`, `남성` 등 남성 보이스 이름 우선 탐색
  - 기기에 남성 전용 한국어 TTS가 없을 경우 낮은 pitch(0.72)로 보정
- Android WebView 버전 6.3.0 / API 36 유지
- 서비스워커 캐시 갱신

## Cloudflare 배포 시 확인
`_headers` 파일이 같이 배포되어야 합니다.

```text
Permissions-Policy: geolocation=(self), camera=(self), microphone=(self)
```

Cloudflare Pages 배포 후 강력 새로고침 또는 기존 서비스워커 캐시 삭제 후 확인하세요.

## 지도 데이터
MVP 단계에서는 외부 raster tile을 사용합니다. 상용화 시에는 별도 지도 사업자 라이선스/API로 교체하는 것을 권장합니다.
