# JOFAMS NAVI 7.5.7.5

- Gradle 8.11.1 `metadata.bin` corruption recovery script added (`android-app/repair-gradle-cache.bat`).
- Gradle build cache and VFS watching disabled to reduce repeated corrupt transform metadata on affected Windows environments.
- Normal map character moved backward by 3vh; AR character position unchanged.
- Android native voice recognition bridge added. Press the voice button and speak a destination to search and automatically change destination during navigation.
- Vehicle speed detection strengthened: native Fused speed + GPS distance/time derived speed + smoothing. Web fallback also derives speed when browser speed is missing/zero.
- Version 7.5.7.5 / code 96.
