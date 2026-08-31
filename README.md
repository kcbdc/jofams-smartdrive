# 조팸스 스마트 드라이브 — Pre-5 MVP

**다임·순식·훈민과 함께하는 상용화 전단계 웹/하이브리드 내비게이션**

이 패키지는 4차 MVP의 경로·차로·교차로·안전운행·AR·주차장·Firebase·Android API 36 WebView 기능을 유지하면서, 생성된 상용화 UI 제안 수준으로 화면 체계를 전면 재구성한 **5차 전단계(Pre-5) 실행 MVP**입니다.

## 1. 이번 단계의 핵심

기능을 추가하는 단계보다 **“실제로 서비스처럼 보이고 조작되는 화면”**에 초점을 맞췄습니다.

- 홈 / 목적지 검색
- 경로 옵션 선택
- 주행 HUD
- AR 내비게이션
- 목적지 주변 주차장
- MY / 로그인 / 주행기록 / 가이드 설정

위 6개 사용자 흐름을 하나의 디자인 시스템으로 통합했습니다.

## 2. 상용 UI 디자인 시스템

### 색상

- Primary Blue: `#2468E8`
- Dark Navy: `#0E1A2D`
- Surface: `#FFFFFF`
- Background: `#F6F8FB`
- Success: `#33A36B`
- Warning: `#F4913A`
- Danger: `#EB4D53`

### 원칙

- 운전 중 핵심 정보는 3초 이내 인지
- 주행 화면은 텍스트보다 방향·거리·차로를 우선
- 일반 화면은 밝은 Surface, 주행 HUD는 Dark Navy
- 주행 중 최소 터치
- 캐릭터는 지도 정보를 가리지 않는 보조 레이어
- 캐릭터마다 역할과 색감을 일관되게 유지

## 3. 화면별 구현

### 홈

- 대형 목적지 검색
- 집 / 회사 / 즐겨찾기 shortcut
- 최근 목적지
- 주유소 / 카페 / 편의점 / 전기차 충전
- 다임 / 순식 / 훈민 가이드 선택
- AUTO 캐릭터 안내
- 하단 4탭 내비게이션

### 경로 선택

- 추천 / 빠른길 / 짧은길 / 무료도로
- 도착예정시간 / 소요시간 / 거리
- 복수 경로 비교
- 목적지 주변 주차장
- 즐겨찾기
- 안내 시작 CTA

### 주행 HUD

- 대형 회전 방향과 잔여거리
- 현재 도로
- 실제/추정 차로
- 제한속도 및 안전운행 상태
- 교통 흐름
- ETA / 잔여거리 / 잔여시간
- 교차로 확대 안내
- 대안경로 / 가상주행 / AR / 종료

### AR

- 카메라 또는 WebXR/Native AR
- route corridor
- 다음 회전과 거리
- AR 정합도
- 다임·순식·훈민 contextual guide
- 속도 및 잔여시간 보조 HUD

### 주차장

- 목적지 기준 Kakao Local PK6 검색
- 거리순 추천
- 주차장을 새 목적지로 즉시 재탐색
- Kakao 제휴형 endpoint 사용 시 destination correction 구조 지원

### MY

- Firebase Google 로그인
- 즐겨찾기
- 최근 주행기록
- 음성 안내 상태
- AUTO / 다임 / 순식 / 훈민 모드
- 로컬 저장 fallback

## 4. 기존 4차 기능 유지

- Kakao Mobility Directions `guides`
- 다중경로
- 경로이탈 재탐색
- Native `KNLane` packet
- Native Image Direction packet
- 제한속도 / 사고 / 공사 / 통제 Native packet
- 터널 Dead Reckoning fallback
- Native map-matched location
- WebXR → Camera AR fallback
- TTS / 햅틱
- Cloudflare Pages + Functions + D1
- Firebase Auth + Firestore
- Android API 36 WebView Host
- iOS Native Bridge scaffold

## 5. 프로젝트 구조

```text
jofams-smartdrive-pre5/
├─ index.html
├─ styles.css
├─ app.js
├─ native-bridge.js
├─ config.js
├─ config.example.js
├─ manifest.webmanifest
├─ sw.js
├─ firestore.rules
├─ docs-ui-proposal.png
├─ assets/
│  ├─ daim.png
│  ├─ sunsik.png
│  └─ hunmin.png
├─ functions/api/
│  ├─ search.js
│  ├─ route.js
│  ├─ parking.js
│  ├─ trip.js
│  └─ health.js
├─ native-bridge/
├─ android-app/
├─ migrations/
├─ tools/validate.mjs
├─ wrangler.toml
└─ README.md
```

## 6. 실행

### Cloudflare Pages 로컬 개발

```bash
cp .dev.vars.example .dev.vars
npx wrangler pages dev .
```

브라우저:

```text
http://localhost:8788
```

실제 GPS / 카메라 / 방향센서는 HTTPS 환경 또는 Android WebView에서 테스트하는 것을 권장합니다.

### API 없이 화면 검토하기 — UI Demo Mode

Cloudflare/로컬 서버에서 다음 query를 사용하면 GPS나 Kakao 키 없이 화면 흐름을 검토할 수 있습니다.

```text
/?demo=home   # 홈 디자인
/?demo=route  # 가상 코엑스 경로 + 3개 경로 옵션 + 주차장
/?demo=drive  # 가상주행 자동 시작 + HUD/차로/교차로
/?demo=my     # 경로 상태에서 MY 화면
```

`demo=drive`는 실제 GPS 대신 내장된 route geometry를 따라 이동하므로 UI QA와 발표 시연에 사용할 수 있습니다.

## 7. Kakao 설정

`.dev.vars`

```text
KAKAO_REST_API_KEY=YOUR_REST_API_KEY
KAKAO_DIRECTIONS_TIER=standard
```

제휴 권한이 있는 경우에만:

```text
KAKAO_DIRECTIONS_TIER=affiliate
```

일반 REST 키는 브라우저에 넣지 않고 Cloudflare Function에서 사용합니다.

## 8. Firebase

`config.js`

```js
window.__APP_CONFIG__ = {
  firebase: {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    appId: "..."
  }
};
```

Firebase Console에서 Google Authentication과 Firestore를 활성화하고 Pages 도메인을 Authorized Domain에 등록합니다.

## 9. Android API 36

`android-app/`는 기존 4차 Host를 유지합니다.

- compileSdk 36
- targetSdk 36
- minSdk 26
- JDK 17
- WebView Location / Camera permission
- JavaScript Native Bridge
- Kakao Navi SDK 연결 hook
- ARCore 연결 hook

실제 Kakao Navi SDK의 `KNLane`, Image Direction, 안전운행 및 map-matching packet은 Kakao SDK 사용 권한과 앱키를 적용한 후 Native callback에 연결해야 합니다.

## 10. 검증

```bash
node tools/validate.mjs
```

검증 항목:

- HTML ↔ JavaScript DOM ID 정합성
- JavaScript 문법
- Functions 문법
- 캐릭터 자산 존재 여부
- manifest JSON

## 11. 5차 MVP로 넘어가기 전 남은 작업

Pre-5에서는 상용 화면 구조까지 완성했습니다. 실제 5차 MVP는 아래를 **실장비/실도로 검증**하는 단계로 정의하는 것이 좋습니다.

1. Kakao Navi SDK 실제 앱키 연결
2. KNLane 실제 주행 packet 검증
3. Image Direction 실데이터 연결
4. ARCore world anchor 방식 도로 위 화살표 고정
5. 터널/지하차도 map matching 검증
6. 실제 제한속도·안전운행 이벤트 QA
7. Firebase 운영 Security Rules 및 App Check
8. Android WebView 권한/백그라운드 복귀 안정화
9. 개인정보·위치정보 동의 UX
10. Play Store 배포용 서명/아이콘/스크린샷

---

`docs-ui-proposal.png`에는 이번 구현의 기준이 된 상용화 화면 디자인 제안 이미지를 함께 포함했습니다.
