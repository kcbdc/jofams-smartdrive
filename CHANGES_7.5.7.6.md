# 조팸스 내비 7.5.7.6 전체 안정화

- 안내 종료 버튼 독립 캡처 이벤트 처리 및 z-index/pointer-events 보강
- stopNavigation() 정리 단계별 오류 격리: 주행기록/AR/GPS/지도 정리 중 일부 실패해도 홈 화면 복귀 보장
- 7.5.7.2 이후 병합 과정에서 누락된 공통 함수 7개 복구
  - saveTripHistory / addTripHistory / updateTripHistorySummary
  - openInfoModal / closeInfoModal
  - toLocalDateInput / setFutureDefaultTime
- 주행속도 보완 계산의 잘못된 haversine() 호출을 기존 hav() 함수로 수정
  - 해당 ReferenceError로 GPS 처리 콜백이 중단되어 속도 표시가 0에 머물 수 있던 문제 해결
- 중요 버튼 바인딩을 일반 bindUI와 분리해 다른 UI 오류가 안내 종료에 전파되지 않도록 보강
- 웹 정적 리소스 버전을 7.5.7.6으로 갱신해 이전 캐시 혼합 방지
- Android versionCode 97 / versionName 7.5.7.6
