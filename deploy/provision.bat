@echo off
REM Wrapper: run provision.ps1 without touching the machine-wide execution policy.
REM Usage:
REM   provision.bat -Image registry.cn-hangzhou.aliyuncs.com/<ns>/nuanhe-api:v1 -Plan
REM   provision.bat -Image registry.cn-hangzhou.aliyuncs.com/<ns>/nuanhe-api:v1
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0provision.ps1" %*
set RC=%ERRORLEVEL%
endlocal & exit /b %RC%
