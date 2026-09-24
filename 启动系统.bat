@echo off
rem ============================================================
rem  Data Security Evaluation System - One-click Launcher
rem  Double-click this file to start the local server and open
rem  the browser automatically.
rem  Close this window (or press Ctrl+C) to stop the service.
rem  Optional args: --port PORT  --host 0.0.0.0  --no-browser
rem ============================================================
cd /d "%~dp0"

set "PYCMD="
where python >nul 2>nul && set "PYCMD=python"
if not defined PYCMD (where py >nul 2>nul && set "PYCMD=py")

if not defined PYCMD (
    echo [ERROR] Python 3 not found. Please install it from:
    echo         https://www.python.org/downloads/
    echo         and tick "Add Python to PATH" during setup.
    echo.
    pause
    exit /b 1
)

"%PYCMD%" "%~dp0start_server.py" %*
if errorlevel 1 (
    echo.
    echo [HINT] Failed to start. If Python is installed but this
    echo         still fails, the "python" command may be the
    echo         Microsoft Store stub. Install the real Python
    echo         from https://www.python.org/downloads/
    echo.
    pause
)
