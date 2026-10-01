@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo =====================================================
echo  JOFAMS NAVI - Gradle 8.11.1 cache repair
echo =====================================================
echo.
echo [1/5] Stopping Gradle daemons...
call gradlew.bat --stop >nul 2>&1

echo [2/5] Removing corrupted Gradle transform metadata...
if exist "%USERPROFILE%\.gradle\caches\8.11.1\transforms" rmdir /s /q "%USERPROFILE%\.gradle\caches\8.11.1\transforms"
if exist "%USERPROFILE%\.gradle\caches\8.11.1\fileHashes" rmdir /s /q "%USERPROFILE%\.gradle\caches\8.11.1\fileHashes"
if exist "%USERPROFILE%\.gradle\caches\8.11.1\executionHistory" rmdir /s /q "%USERPROFILE%\.gradle\caches\8.11.1\executionHistory"
if exist ".gradle" rmdir /s /q ".gradle"

echo [3/5] Creating isolated Gradle user home...
set "GRADLE_USER_HOME=%CD%\.jofams-gradle-home"
if exist "%GRADLE_USER_HOME%" rmdir /s /q "%GRADLE_USER_HOME%"
mkdir "%GRADLE_USER_HOME%" >nul 2>&1

echo [4/5] Refreshing dependencies using isolated cache...
call gradlew.bat --no-daemon --refresh-dependencies clean
if errorlevel 1 goto :fail

echo [5/5] Building debug APK...
call gradlew.bat --no-daemon assembleDebug
if errorlevel 1 goto :fail

echo.
echo SUCCESS: Gradle cache repaired and debug build completed.
echo Gradle user home used: %GRADLE_USER_HOME%
pause
exit /b 0

:fail
echo.
echo FAILED. Close Android Studio and any Java/Gradle processes, then run this file again.
echo If antivirus is scanning .gradle, temporarily exclude this project and the Gradle cache directory.
pause
exit /b 1
