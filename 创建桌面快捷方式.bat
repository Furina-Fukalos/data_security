@echo off
rem ============================================================
rem  Create a desktop shortcut for "Start System" launcher.
rem  Double-click this file once. After that you can start the
rem  system by double-clicking the desktop icon.
rem ============================================================
cd /d "%~dp0"

set "PYCMD="
where python >nul 2>nul && set "PYCMD=python"
if not defined PYCMD (where py >nul 2>nul && set "PYCMD=py")

if not defined PYCMD (
    echo [ERROR] Python 3 not found. Install from https://www.python.org/downloads/
    pause
    exit /b 1
)

"%PYCMD%" "%~dp0start_server.py" --create-shortcut
echo.
pause
