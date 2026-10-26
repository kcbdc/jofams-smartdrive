# 단골로 v7.6.26.4 — 교통흐름 2글자 / 오피넷 연결 점검

## 교통흐름 6단계
원활, 서행, 지체, 정체, 극심, 통제. 카카오 traffic_state 4/3/2/1/6 기반. 극심은 traffic_state=1이고 공식 제공 traffic_speed가 0보다 크고 5km/h 이하인 경우만 추가 분류. 속도 0은 결측 또는 정차를 구분할 수 없어 극심으로 가정하지 않음. traffic_state=0은 미상. UI 교통 범례, 현재상태, 경로 구간 바, 상세창에 일관 적용. 통제는 traffic_state 6에만 표시.

## 오피넷
최신 v7.6.26.3 fuel.js 병합. aroundAll, areaCode, avgAllPrice가 모두 빈 배열인 경우 인증키·사용 권한·공급 응답 문제로 표시하며 가짜 가격을 생성하지 않음. 진단에 실제로 사용한 Cloudflare 환경변수 **이름만** 표시하고 Secret 값은 노출하지 않음. 코드로 확인할 수 없는 오피넷 서버 사용권한/키 활성화 여부는 별도 확인 필요.

## 배포
index.html, app.js, styles.css, functions/api/fuel.js를 함께 교체 후 Cloudflare Pages 재배포. 기존 AI·GPS 등 다른 파일 유지.
