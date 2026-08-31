# Native Bridge — 4차 MVP

웹 본체는 브라우저만으로도 `Kakao Directions guides + Web lane fallback + camera AR`로 실행됩니다. Android/iOS host에서 Kakao Navi SDK를 연결하면 웹 UI를 그대로 유지하면서 아래 정밀 데이터를 주입할 수 있습니다.

## Web → Native commands

`native-bridge.js`가 다음 메시지를 host로 보냅니다.

- `navigationState` — 안내 시작/종료 및 목적지
- `requestLane` — 실제 차로 정보 요청
- `requestSafety` — 제한속도/안전운행 정보 요청
- `requestImageDirection` — 교차로 확대 이미지 요청
- `requestRoadEvents` — 사고/공사/통제 정보 요청
- `requestAlternatives` — SDK 대안경로 정보 요청
- `acceptAlternative` — SDK가 제안한 대안경로 전환 요청
- `startAR` / `stopAR` — 네이티브 ARCore/ARKit 연결 지점

## Native → Web packets

### 1. 실제 차로

```json
{
  "source":"kakao-native",
  "lanes":[
    {"index":0,"turnType":10,"highlightType":4,"pocketType":0,"busType":0,"facilityType":0,"suggest":1,"colorType":2}
  ]
}
```

Android: `bridge.emitLane(packet)` → `window.JofamsNative.onLaneUpdate(...)`

### 2. 안전운행/제한속도

```json
{
  "source":"kakao-native",
  "speedLimit":80,
  "message":"전방 과속 단속 구간입니다.",
  "urgent":false
}
```

`speedLimit`보다 실제 속도가 4km/h 이상 높으면 웹 HUD가 과속 경고 상태로 전환되고 TTS/햅틱을 실행합니다.

### 3. 교차로 확대 이미지

```json
{
  "source":"kakao-native",
  "distance":240,
  "imageDataUrl":"data:image/png;base64,iVBOR..."
}
```

`KNGuide_Route.imgDirection` / `KNImageDirection.directionImg`를 host에서 PNG/JPEG data URL로 변환해 전달합니다. 이미지 packet이 없으면 웹은 다음 회전 타입으로 자체 확대 안내를 표시합니다.

### 4. 사고·공사·행사·통제

```json
{
  "events":[
    {"code":0,"type":2,"title":"전방 사고","distance":1200}
  ]
}
```

- `code`: 0 사고, 1 공사, 2 행사, 3 통제
- `type`: 0 없음, 1 전면, 2 부분

### 5. 대안경로

```json
{
  "source":"kakao-native",
  "distGap":-1300,
  "timeGap":-240,
  "costGap":0,
  "routeId":"candidate-id"
}
```

`timeGap`이 충분히 유리하면 훈민 캐릭터가 전환 배너를 표시합니다. 사용자가 전환을 누르면 WebView host로 `acceptAlternative` command가 전달됩니다.

### 6. 터널/Map-matched 위치

```json
{
  "lng":127.0,
  "lat":36.0,
  "speedMps":18.3,
  "heading":95,
  "accuracy":5,
  "tunnel":true
}
```

SDK의 map-matched 위치를 제공할 수 있으면 위 packet을 우선 사용합니다. packet이 없고 현재 road name이 터널로 판단되며 브라우저 GPS가 끊기면 웹은 route geometry + 최근 속도로 dead reckoning fallback을 수행합니다.

## 파일

- `android/JofamsWebBridge.kt` — Kakao SDK와 독립적인 generic Android bridge
- `android/KakaoLanePacketExample.kt` — KNLane packet 참고
- `android/KakaoRouteGuidePacketExample.kt` — image direction / safety / road event / multi-route packet 참고
- `ios/JofamsNavigationBridge.swift` — WKWebView command/packet bridge

실제 Android API 36 WebView host는 루트 `android-app/` 폴더에 별도 포함되어 있습니다.
