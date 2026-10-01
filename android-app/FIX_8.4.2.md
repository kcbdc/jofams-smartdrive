# 8.4.2 NativeGuidanceEngine compile fix
- NativeGuidanceEngine.kt line 519의 compact if-expression을 명시적 block if/else로 변경.
- 동일한 project() 계산식을 가진 NativeSafetyRepository.kt도 같은 방식으로 선제 수정.
- versionName 8.4.2 / versionCode 242.
