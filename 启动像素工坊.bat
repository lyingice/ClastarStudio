@echo off
setlocal
cd /d "%~dp0"
where pyw.exe >nul 2>nul
if %errorlevel%==0 (
  start "" pyw.exe "%~dp0tools\launch_kiosk.py"
  exit /b
)
where pythonw.exe >nul 2>nul
if %errorlevel%==0 (
  start "" pythonw.exe "%~dp0tools\launch_kiosk.py"
  exit /b
)
py -3 "%~dp0tools\launch_kiosk.py"
