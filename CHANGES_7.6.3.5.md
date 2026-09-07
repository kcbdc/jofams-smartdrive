# 7.6.3.5 온누리 2025 표시 복구

- 공식 2025-07-31 ODCLOUD endpoint를 fallback 기본값으로 내장.
- ONNURI_MERCHANT_DATA_URL은 선택 설정으로 변경.
- 최신 필드명 정확 대응: 가맹점명 / 소속 시장명(또는 상점가) / 소재지 / 취급품목 / 지류형 가맹 여부 / 디지털형 가맹 여부 / 등록년도.
- ODCLOUD `cond[소재지::LIKE]`로 현재 시군구를 서버측 필터링.
- 조건 검색 실패 시 totalCount 기반 전체 페이지 순회(최대 120×1000건)하여 첫 1,000건 누락 문제 제거.
- 공공데이터 키가 URL 인코딩값이어도 정상 처리.
- 좌표 없는 현재 지역 가맹점은 Kakao 주소검색으로 최대 180개, 동시 8개씩 좌표화.
- API 진단 필드: fetchedRows/localRows/mappedRows/fetchMeta/region.
- zoomend에서도 온누리/지역상품권/CCTV 레이어 즉시 재렌더.

필수 Production 환경변수:
- PUBLIC_DATA_SERVICE_KEY (또는 DATA_GO_KR_SERVICE_KEY / ONNURI_SERVICE_KEY)
- KAKAO_REST_API_KEY
