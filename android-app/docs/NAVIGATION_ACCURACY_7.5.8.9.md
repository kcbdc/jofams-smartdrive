# Navigation accuracy 7.5.8.9

Android 네이티브 빌드는 Google Play services Location을 사용합니다.

- dependency: `com.google.android.gms:play-services-location:21.3.0`
- FusedLocationProviderClient -> `JofamsNative.onLocationUpdate`
- Gyroscope / Linear Acceleration / Rotation Vector -> `JofamsNative.onMotionUpdate`
- 네이티브 위치 공급은 길안내 시작 시 활성화되고 종료 시 해제됩니다.

웹 브라우저 단독 실행에서는 기존 Geolocation API가 fallback으로 유지됩니다.
