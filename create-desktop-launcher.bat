@echo off
setlocal

set "APP_DIR=C:\bebeyu"
set "SOURCE=%APP_DIR%\start-bebeu.bat"
set "DESKTOP=%USERPROFILE%\OneDrive\Desktop"

if not exist "%DESKTOP%" set "DESKTOP=%USERPROFILE%\Desktop"
if not exist "%DESKTOP%" mkdir "%DESKTOP%"

copy /Y "%SOURCE%" "%DESKTOP%\bebeu server.bat" > nul

echo.
echo Created desktop launcher:
echo   %DESKTOP%\bebeu server.bat
echo.
echo Double-click it to start the server.
echo Close the server window to stop it.
echo.
pause
