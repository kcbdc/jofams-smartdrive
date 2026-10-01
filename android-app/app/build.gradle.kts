plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")  // 이 줄 추가

}

android {
    namespace = "com.komsco.jofams.smartdrive"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.komsco.jofams.smartdrive"
        minSdk = 26
        targetSdk = 36
        versionCode = 115
        versionName = "8.0.9"
        val smartDriveUrl = providers.gradleProperty("SMARTDRIVE_URL").orElse("https://jofams-smartdrive.pages.dev/").get()
        val googleWebClientId = providers.gradleProperty("GOOGLE_WEB_CLIENT_ID").orElse("").get()
        val googleAndroidClientId = providers.gradleProperty("GOOGLE_ANDROID_CLIENT_ID").orElse("").get()
        val knownSigningSha1s = providers.gradleProperty("KNOWN_SIGNING_SHA1S").orElse("").get()
        buildConfigField("String", "SMARTDRIVE_URL", "\"${smartDriveUrl}\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${googleWebClientId}\"")
        buildConfigField("String", "GOOGLE_ANDROID_CLIENT_ID", "\"${googleAndroidClientId}\"")
        buildConfigField("String", "KNOWN_SIGNING_SHA1S", "\"${knownSigningSha1s}\"")
    }

    buildFeatures { buildConfig = true }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
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
    implementation("com.google.android.gms:play-services-auth:21.3.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
}
