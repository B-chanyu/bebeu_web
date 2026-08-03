@echo off
setlocal
title bebeu server

set "APP_DIR=C:\bebeyu"
set "V2_START=%APP_DIR%\bebeu\v2\start-bebeu.bat"

if not exist "%V2_START%" (
  echo v2 start script not found:
  echo   %V2_START%
  pause
  exit /b 1
)

call "%V2_START%"
