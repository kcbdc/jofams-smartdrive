# 터널 GPS 두절 대응 — 실시간 위성신호 감지 연결 + 장거리 터널 DR 상한 통일

지난 검토에서 발견한 두 가지 미연결 지점을 수정했습니다. (웹 app.js 쪽 dead-reckoning
로직 자체는 이미 잘 되어 있어 변경하지 않았고, 네이티브(Android) 쪽만 손봤습니다.)

## 1. 네이티브 GNSS 품질 감지를 웹으로 실제 연결 (`emitTunnelState` 사용)
- 문제: `JofamsWebBridge.emitTunnelState()`가 정의만 되어 있고 어디서도 호출되지 않았고,
  `JofamsWebBridge` 클래스 자체도 인스턴스화되어 있지 않았습니다. 웹 쪽 핸들러
  (`window.JofamsNative.onTunnelState`)는 이미 준비돼 있었지만 native에서 아무 것도
  쏘지 않아 죽은 코드였습니다.
- 수정:
  - `MainActivity.buildWebView()`에서 `JofamsWebBridge(webView)`를 실제로 생성.
  - `NativeNavigationEngine.Listener`에 `onTunnelLikely(active: Boolean)` 콜백 추가.
  - `NativeNavigationEngine`이 `GnssStatus.Callback`에서 위성 개수/신호세기(C/N0)를
    실시간 감시하다가, **1.5초 이상 지속적으로 약해지면** `onTunnelLikely(true)`를,
    회복되면 `onTunnelLikely(false)`를 호출하도록 디바운스 로직(`updateTunnelLikely`)을
    추가. 순간적인 흔들림(교량 아래 통과 등)으로 오탐하지 않게 하기 위한 최소 지속시간입니다.
  - `MainActivity`가 이 콜백을 받아 `jofamsWebBridge.emitTunnelState(active)`를 호출 →
    웹의 `window.JofamsNative.onTunnelState`가 실제로 발화되어, "GPS 갱신 자체가 끊기는
    것"을 기다리지 않고 훨씬 빠르게 dead-reckoning을 시작할 수 있게 됩니다.

## 2. 네이티브 dead-reckoning의 장거리 터널 상한을 웹과 통일
- 문제: 네이티브 자체 dead-reckoning은 최대 90초(약 2.5km @100km/h)에서 감속·정지하도록
  하드코딩되어 있었던 반면, 웹 쪽은 "이름이 확인된 터널" 구간에서는 최대 25분까지 버티도록
  이미 구현되어 있었습니다. 즉 네이티브 지도 화면(가로/세로 회전 작업 때 다뤘던 그 화면)이
  떠 있는 상태로 장거리 터널을 지나면 도중에 위치 추정이 멈출 수 있는 불일치가 있었습니다.
- 수정:
  - `NativeNavigationEngine.setKnownTunnelActive(active: Boolean)` 추가 — 웹이 경로
    데이터(터널 이름 구간)로 판단한 "현재 터널 안" 여부를 네이티브에 전달받는 진입점.
    약 3초 이상 갱신이 없으면 자동 만료(연결이 끊기거나 웹이 멈춰도 무한정 늘어난 상태로
    고착되지 않도록 하는 안전장치).
  - `MainActivity.NavigationBridge.updateNavigationState()`(웹이 약 700ms마다 보내는
    주기적 상태 동기화 경로)에서 `tunnelActive` 필드를 읽어 그대로 전달하도록 연결.
  - 이 페이로드를 만드는 MainActivity 내 임베디드 JS(webView에 주입되는 스크립트)에도
    `tunnelActive: Boolean(state?.tunnelRouteLock?.active)` 필드를 추가해, 웹의
    `state.tunnelRouteLock`(이름 기반 터널 판정 결과)을 그대로 실어 보내도록 함.
  - `deadReckoningTick()`의 하드코딩된 90,000ms / 86,000ms를 `knownTunnel` 여부에 따라
    90초 또는 25분(1,500,000ms)로 갈리는 변수(`maxGapMs`, `decelStartMs`)로 교체.
    감속 진행 구간 길이(4초)는 두 경우 모두 동일하게 유지해 정지 직전 부자연스러운 튐이
    없도록 함.

## 변경하지 않은 부분
- 웹(app.js)의 dead-reckoning 알고리즘 본체(속도 추정 블렌딩, IMU 가속도/자이로 보정,
  경로 잠금 로직 등)는 이미 검증된 상태라 손대지 않았습니다.
- `window.JofamsNative.onTunnelState`의 `active === false` 처리(현재 사실상 no-op)도
  그대로 뒀습니다 — 실제 GPS 신호가 돌아오면 어차피 `applyGps` 정상 흐름으로 복귀되므로,
  false 신호에 별도 동작을 추가하는 건 리스크 대비 이득이 적다고 판단했습니다.

## 한계 (여전히 남아있는 물리적 한계)
- 두 수정 모두 "터널 진입/탈출을 더 빠르고 정확하게 감지"하고 "장거리 터널에서 추정이
  중간에 끊기지 않게" 하는 것이지, GPS 두절 자체를 없애는 것은 아닙니다.
- 터널 내부 실제 갈림길, 극단적으로 긴 터널에서의 누적 오차 등은 여전히 근본적으로
  해결 불가능한 영역입니다(이전 답변에서 설명한 한계 그대로).

## 검증
- Kotlin 컴파일러가 없는 환경이라 실제 빌드는 못 했습니다. 수정 전/후 파일의 중괄호
  `{ }` 개수가 정확히 1쌍만 늘어난 것을 확인했고(내가 추가한 `onTunnelLikely` 오버라이드
  블록 1개), 괄호 `( )` 불균형 오프셋은 원본 파일과 동일함을 확인해(한글 주석 안의 괄호
  때문에 원래도 불균형이었음) 새로 깨진 구조가 없음을 간접 확인했습니다.
- Android Studio에서 실제 빌드 및 실기기(특히 알려진 장거리 터널 구간)로 검증해 보시길
  권장드립니다.
