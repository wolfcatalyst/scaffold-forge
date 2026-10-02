@echo off
title Scaffold Forge - Wolf Edition
echo.
echo  =============================
echo   Scaffold Forge - Wolf Edition
echo  =============================
echo.

cd /d "%~dp0electron"

if not exist "%~dp0.venv\Scripts\python.exe" (
    echo [ERROR] Run setup.bat first to create the virtual environment and install dependencies.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm not found. Install Node.js first.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [setup] Installing Electron dependencies...
    call npm install
    echo.
)

echo [start] Launching Scaffold Forge...
echo.
npm run dev
