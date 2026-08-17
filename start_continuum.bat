@echo off
setlocal ENABLEEXTENSIONS
title Continuum (Xuyan)

echo [INFO] Continuum launcher (Electron + React + TypeScript)

REM ---- Environment check ----
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ and add it to PATH.
    echo         Download: https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm not found. Please check your Node.js installation.
    pause
    exit /b 1
)

REM ---- Enter app directory ----
cd /d "%~dp0desktop"
if not exist package.json (
    echo [ERROR] desktop\package.json not found. Please check the project directory.
    pause
    exit /b 1
)

REM ---- Install dependencies on first run ----
if not exist node_modules (
    echo [INFO] First run: installing dependencies, this may take a few minutes...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies.
        echo         For slow networks, try: npm config set registry https://registry.npmmirror.com
        pause
        exit /b 1
    )
)

REM ---- Launch ----
echo [INFO] Starting Continuum, please wait...
call npm run dev
if errorlevel 1 (
    echo [ERROR] Application exited with code %ERRORLEVEL%
)

pause
