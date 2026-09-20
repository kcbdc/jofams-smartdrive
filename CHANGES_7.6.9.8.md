# 7.6.9.8

원인 확인: 이전 수정본의 CSS 자체는 정상이나, 수정파일 ZIP 내부 경로가 하위 폴더에 들어가 있어 루트 styles.css 교체가 누락될 수 있었고, 실제 화면은 기존 녹색 .maneuver-main 규칙을 계속 사용하고 있었습니다.

개선:
- 턴 안내판 핵심 스타일을 index.html 내부에 직접 삽입해 외부 styles.css 캐시/배포 경로와 무관하게 적용
- 실행 시 style.setProperty(..., important)로 한 번 더 강제 적용
- 주행 화면 클래스 변경 시 MutationObserver로 재적용
- 수정 ZIP의 파일을 루트에 바로 배치
