# 7.5.7.9 hotfix

- Fixed Kotlin compile error in MainActivity.kt: unresolved reference `getSigningSha1`.
- Reused the already implemented `currentAppSigningSha1()` helper for OAuth signing certificate validation.
- No change to Firebase package/OAuth/SHA-1 values.
- versionCode 100 / versionName 7.5.7.9.
