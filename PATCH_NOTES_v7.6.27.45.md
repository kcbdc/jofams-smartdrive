# 단골로 v7.6.27.45 실시간 교통정보 상세 개선

- 주행 경로 없이도 관심지역(지역 선택, 현 GPS 위치) 별 교통소통 정보 확인
- 관심지역 최대 5개 브라우저 로컬 저장; 반경 5~15km; 새로고침
- Cloudflare Pages Function `/api/traffic-live` 신규 추가: 국토교통부 국가교통정보센터 실시간 교통소통 API 연계
- Cloudflare Pages Secret `ITS_API_KEY` 필수; 미등록 시 데이터 임의 생성 없이 안내
- 고속도로·국도 제공범위 한계, 외부 API 유효 키 실제 호출은 미검증
- 수정: app.js, styles.css, functions/api/traffic-live.js, wrangler.toml.example
- 기존 fuel.js, ai-assist.js, ai-recommend.js, weather.js 수정 없음
