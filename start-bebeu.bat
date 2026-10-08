@echo off
setlocal
title bebeu server

set "APP_DIR=D:\bebeyu"
set "V2_DIR=%APP_DIR%\bebeu\v2"
set "PHOTO_ROOT=%APP_DIR%\bebeu_image"
set "LOG_DIR=%APP_DIR%\app_logs"
set "PORT=3000"
set "MYSQL_HOST=127.0.0.1"
set "MYSQL_PORT=3306"
set "MYSQL_USER=bebeu_user"
set "MYSQL_PASSWORD="
set "MYSQL_DATABASE=bebeu"

if not exist "%V2_DIR%\server.js" (
  echo v2 server not found:
  echo   %V2_DIR%
  pause
  exit /b 1
)

if not exist "%PHOTO_ROOT%" mkdir "%PHOTO_ROOT%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
cd /d "%V2_DIR%"

echo.
echo Starting managed bebeu server...
echo.
echo PC address:
echo   http://localhost:3000
echo.
echo Same-network phone address:
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "IP=%%A"
  setlocal enabledelayedexpansion
  set "IP=!IP: =!"
  echo   http://!IP!:3000
  endlocal
)
echo.
echo Photo folder:
echo   %PHOTO_ROOT%
echo.
echo Log folder:
echo   %LOG_DIR%
echo.
echo Database:
echo   MariaDB bebeu at 127.0.0.1:3306
echo.
echo Keep this window open. Code updates are applied after a managed reload request.
echo Close this window to stop the server.
echo.

npm run serve:managed

echo.
echo Server stopped.
pause
