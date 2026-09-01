plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.komsco.jofams.smartdrive"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.komsco.jofams.smartdrive"
        minSdk = 26
        targetSdk = 36
        versionCode = 5
        versionName = "5.0.0-pre"
        val smartDriveUrl = providers.gradleProperty("SMARTDRIVE_URL").orElse("https://example.pages.dev/").get()
        buildConfigField("String", "SMARTDRIVE_URL", "\"${smartDriveUrl}\"")
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.appcompat:appcompat:1.7.1")
    // Kakao Navi SDK는 운영 앱에서 공식 repository/dependency를 추가한 뒤
    // docs/KakaoNaviSdkIntegration.md의 callback -> bridge 매핑을 적용합니다.
}
