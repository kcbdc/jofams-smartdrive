pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Kakao Navi SDK를 직접 붙일 때 Kakao Mobility 공식 문서의 Maven repository를 추가하세요.
    }
}
rootProject.name = "JofamsSmartDrive"
include(":app")
