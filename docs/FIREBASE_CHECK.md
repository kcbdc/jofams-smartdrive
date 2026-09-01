# Firebase 실제 로그인 연동 점검

1. Firebase Console에서 Web App을 생성합니다.
2. `config.js`에 Web Firebase 설정값을 입력합니다.
3. Authentication > Sign-in method > Google을 활성화합니다.
4. Authentication > Settings > Authorized domains에 실제 Pages 도메인을 추가합니다.
5. Firestore를 생성하고 루트의 `firestore.rules`를 적용합니다.
6. 배포 후 MY 화면에서 Google 로그인을 실행합니다.
7. MY > 서비스 연동 상태 > `연동 상태 점검`을 누릅니다.

점검 항목은 다음과 같습니다.
- Cloudflare Functions `/api/health`
- D1 binding 존재 여부
- Firebase Auth SDK 초기화 및 로그인 상태
- 로그인 사용자의 Firestore settings 문서 읽기 권한

주의: Firebase 프로젝트 키/계정은 사용자 소유 값이므로 이 ZIP 자체에서 실제 계정 로그인까지 대신 검증할 수는 없습니다. 대신 배포 환경에서 즉시 확인 가능한 런타임 진단 기능을 포함했습니다.
