@echo off
setlocal enabledelayedexpansion
chcp 936 >nul
title 暖禾家具 - 停止服务

rem ========================================================
rem  暖禾家具官网 停止服务
rem    释放 8000 (API) / 5173 (前台) / 5174 (后台) 三个端口
rem ========================================================

echo ========================================================
echo    暖禾家具官网 - 停止服务
echo ========================================================
echo.

for %%P in (8000 5173 5174) do call :killport %%P

echo.
echo 完成，端口 8000 / 5173 / 5174 已释放。
echo 若还留着已断开的控制台窗口，直接关掉即可。
echo.
pause
exit /b 0

rem ---------- 按端口结束占用进程 ----------
:killport
set "N=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%1 " ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
  echo   端口 %1  已停止  PID %%a
  set /a N+=1
)
if "!N!"=="0" echo   端口 %1  未在运行
exit /b 0
