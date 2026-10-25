# 단골로 v7.6.24.4 / 21개 항목 정적 점검

PASS | 01 CSS top-level parse
PASS | 02 balanced braces
PASS | 03 HTML stylesheet version
PASS | 04 HTML script version
PASS | 05 stylesheet exists
PASS | 06 endpoint parent visibility
PASS | 07 endpoint map anchoring
PASS | 08 origin route position
PASS | 09 destination route position
PASS | 10 portrait lane center
PASS | 11 portrait lane spacing
PASS | 12 radio on animation
PASS | 13 radio off static
PASS | 14 homepage hides endpoints
PASS | 15 recent release duplicate removed
PASS | 16 route and drive view support
PASS | 17 fuel endpoint retained
PASS | 18 location request retained
PASS | 19 matching endpoint svg
PASS | 20 CSS contains landscape layout
PASS | 21 JavaScript syntax

- 최신 CSS 꼬리의 7.6.24.0~24.3 중복 선언을 통합해 마지막 단일 적용 블록으로 유지.
- 주행 중앙 레이어 242px 상대 배치, 중앙 정렬 유지.
- 라디오 ON 애니메이션/OFF 고정, 출발·도착 경로좌표 마커, 기존 GPS 기능 보존.
- 운영 지도/실제 단말 시각 검증은 수행하지 않음.
