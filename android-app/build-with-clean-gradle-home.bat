@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "GRADLE_USER_HOME=%CD%\.jofams-gradle-home"
echo Using isolated GRADLE_USER_HOME=%GRADLE_USER_HOME%
call gradlew.bat --no-daemon clean assembleDebug
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" echo Build failed with exit code %EXITCODE%.
exit /b %EXITCODE%
