@echo off
setlocal enabledelayedexpansion
chcp 936 >nul
title 暖禾家具 - 一键启动

rem ========================================================
rem  暖禾家具官网 一键启动
rem    API      8000  FastAPI / uvicorn
rem    Admin    5174  Vite 后台管理
rem    Frontend 5173  Vite 前台官网
rem  停止服务：关闭这三个控制台窗口，或双击 stop.bat
rem ========================================================

set "ROOT=%~dp0.."
rem 规范化路径（解析 ..），并去掉结尾的反斜杠，避免拼出双反斜杠
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo ========================================================
echo    暖禾家具官网 - 服务启动
echo ========================================================
echo.

rem ---------- 1. 定位 node.exe ----------
set "NODE_EXE="
if exist "C:\Users\20454\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" (
  set "NODE_EXE=C:\Users\20454\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"
)
if not defined NODE_EXE (
  for /d %%D in ("C:\Users\20454\.workbuddy\binaries\node\versions\*") do (
    if not defined NODE_EXE if exist "%%~fD\node.exe" set "NODE_EXE=%%~fD\node.exe"
  )
)
if not defined NODE_EXE (
  for %%P in (node.exe) do if not "%%~$PATH:P"=="" set "NODE_EXE=%%~$PATH:P"
)
if not defined NODE_EXE (
  echo [错误] 未找到 node.exe，无法启动前端服务。
  echo        请确认 Node 运行时已安装。
  echo.
  pause
  exit /b 1
)

rem ---------- 2. 定位 python.exe ----------
set "PY_EXE="
if exist "C:\Users\20454\.workbuddy\binaries\python\envs\default\Scripts\python.exe" (
  set "PY_EXE=C:\Users\20454\.workbuddy\binaries\python\envs\default\Scripts\python.exe"
)
if not defined PY_EXE (
  for /d %%D in ("C:\Users\20454\.workbuddy\binaries\python\versions\*") do (
    if not defined PY_EXE if exist "%%~fD\python.exe" set "PY_EXE=%%~fD\python.exe"
  )
)
if not defined PY_EXE (
  for %%P in (python.exe) do if not "%%~$PATH:P"=="" set "PY_EXE=%%~$PATH:P"
)
if not defined PY_EXE (
  echo [错误] 未找到 python.exe，无法启动 API 服务。
  echo.
  pause
  exit /b 1
)

rem ---------- 3. 项目完整性检查 ----------
set "MISSING=0"
if not exist "%ROOT%\api\app\main.py" set "MISSING=1"
if not exist "%ROOT%\backend\node_modules\vite\bin\vite.js" set "MISSING=1"
if not exist "%ROOT%\frontend\node_modules\vite\bin\vite.js" set "MISSING=1"
if "%MISSING%"=="1" (
  echo [错误] 目录不完整，请把 start.bat 放在项目根目录下运行。
  echo        需要 api\app\main.py、backend\node_modules、frontend\node_modules
  echo        当前根目录：%ROOT%
  echo.
  pause
  exit /b 1
)

echo   node   : %NODE_EXE%
echo   python : %PY_EXE%
echo   根目录 : %ROOT%
echo.

rem ---------- 4. 启动三个服务 ----------
call :isbusy 8000
if errorlevel 1 (
  echo   [跳过] 端口 8000 已被占用 - API 可能已在运行
) else (
  start "暖禾-api" /D "%ROOT%\api" cmd /k ""%PY_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
  echo   [启动] API       http://127.0.0.1:8000/docs
)

call :isbusy 5174
if errorlevel 1 (
  echo   [跳过] 端口 5174 已被占用 - 后台管理可能已在运行
) else (
  start "暖禾-admin" /D "%ROOT%\backend" cmd /k ""%NODE_EXE%" node_modules\vite\bin\vite.js --port 5174 --host 127.0.0.1"
  echo   [启动] 后台管理  http://127.0.0.1:5174
)

call :isbusy 5173
if errorlevel 1 (
  echo   [跳过] 端口 5173 已被占用 - 前台官网可能已在运行
) else (
  start "暖禾-front" /D "%ROOT%\frontend" cmd /k ""%NODE_EXE%" node_modules\vite\bin\vite.js --port 5173 --host 127.0.0.1"
  echo   [启动] 前台官网  http://127.0.0.1:5173
)

echo.
echo ========================================================
echo   启动完成。若某个窗口报错，请查看该窗口的提示。
echo ========================================================
echo   前台官网 : http://127.0.0.1:5173
echo   后台管理 : http://127.0.0.1:5174
echo   接口文档 : http://127.0.0.1:8000/docs
echo.
echo   停止服务：双击 stop.bat
echo.
timeout /t 6 >nul 2>&1
exit /b 0

rem ---------- 端口占用检测 ----------
:isbusy
set "BUSY="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%1 " ^| findstr "LISTENING"') do set "BUSY=1"
if defined BUSY (exit /b 1)
exit /b 0
