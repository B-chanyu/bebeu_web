@echo off
setlocal
title bebeu server

set "DATA_ROOT=C:\bebeyu"
set "APP_DIR=%DATA_ROOT%\bebeu\v2"
cd /d "%APP_DIR%"

if not defined PHOTO_ROOT set "PHOTO_ROOT=%DATA_ROOT%\bebeu_image"
if not defined LOG_DIR set "LOG_DIR=%DATA_ROOT%\app_logs"
if not defined PORT set "PORT=3000"
if not defined MYSQL_HOST set "MYSQL_HOST=127.0.0.1"
if not defined MYSQL_PORT set "MYSQL_PORT=3306"
if not defined MYSQL_USER set "MYSQL_USER=bebeu_user"
if not defined MYSQL_PASSWORD set "MYSQL_PASSWORD="
if not defined MYSQL_DATABASE set "MYSQL_DATABASE=bebeu"

if not exist "%PHOTO_ROOT%" mkdir "%PHOTO_ROOT%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

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
