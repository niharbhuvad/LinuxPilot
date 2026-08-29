@echo off
setlocal enabledelayedexpansion
title LinuxAI Unified Launcher

:: Set working directory to script location
cd /d "%~dp0"

:: 1. Check for Python inside venv
if exist "backend\.venv\Scripts\python.exe" (
    "backend\.venv\Scripts\python.exe" run.py
    goto end
)

:: 2. Check for system python
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python run.py
    goto end
)

:: 3. Check for python launcher 'py'
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    py -3 run.py
    goto end
)

:: 4. Not found
echo.
echo =======================================================
echo  ERROR: Python is not installed or not found in PATH!
echo =======================================================
echo Please install Python 3.11+ from https://www.python.org/
echo Make sure to check "Add Python to PATH" during setup.
echo.
pause

:end
