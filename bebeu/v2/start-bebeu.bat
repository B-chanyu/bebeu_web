@echo off
setlocal
title bebeu server

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
set "DATA_ROOT=C:\bebeyu"
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
echo Starting bebeu server...
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
echo Close this window to stop the server.
echo.

npm run build:app
if errorlevel 1 (
  echo.
  echo Failed to build public app.
  pause
  exit /b 1
)

node server.js

echo.
echo Server stopped.
pause
