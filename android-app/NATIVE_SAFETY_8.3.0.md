# 8.3.0 — Native Safety Repository

이번 단계에서 주행 중 CCTV·구간단속·ITS 제한속도 조회를 WebView에서 분리하여 Kotlin으로 이동.

- NativeSafetyRepository 신설
- `/api/cameras` 직접 호출
- `/api/its-vsl` 직접 호출
- 현재 route bbox + 현재 raw GPS 기준 주기적 갱신
- CCTV 좌표를 route에 직접 투영
- 평행도로/옆길 오탐 필터
- 시/종점 구간단속 페어링
- 한쪽 레코드만 있어도 공식 구간길이로 반대 끝점 복원
- NativeGuidanceEngine에 SafetyEvent 직접 주입
- 제한속도 우선순위:
  1. route roadSegment speedLimit
  2. ITS VSL(도로명 일치)
  3. 현재 경로 근접 CCTV/구간단속 제한속도
- 재탐색 후 NativeSafetyRepository 즉시 강제 갱신
- WebView는 주행 안전정보 계산에서 제거. 새 route 객체 호환 동기화만 유지.
