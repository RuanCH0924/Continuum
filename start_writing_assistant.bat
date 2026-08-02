@echo off
@chcp 65001 >nul
setlocal ENABLEEXTENSIONS

echo [INFO] Checking Python environment...
set "PYTHON_EXE=python"

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('where python') do (
        if "%%~zi" NEQ "0" (
             goto :Found
        )
    )
)

echo [WARN] Python not found in PATH or is a zero-byte stub.
echo [INFO] Searching for Anaconda...

if exist "%USERPROFILE%\anaconda3\python.exe" (
    set "PYTHON_EXE=%USERPROFILE%\anaconda3\python.exe"
    set "PATH=%USERPROFILE%\anaconda3;%USERPROFILE%\anaconda3\Scripts;%USERPROFILE%\anaconda3\Library\bin;%PATH%"
    echo [INFO] Found Anaconda Python at: %USERPROFILE%\anaconda3\python.exe
    goto :Found
)

echo [ERROR] Python not found.
echo Please install Python 3.10+ and add it to PATH.
echo Or install Anaconda.
echo Download: https://www.python.org/downloads/windows/
pause
exit /b 1

:Found
echo [INFO] Python found. Checking version...
"%PYTHON_EXE%" --version

echo [INFO] Installing dependencies...
"%PYTHON_EXE%" -m pip install -r "%~dp0requirements.txt" -i https://pypi.tuna.tsinghua.edu.cn/simple

echo [INFO] Starting Continuum (续言)...
"%PYTHON_EXE%" "%~dp0run.py"
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Application exited with error code %ERRORLEVEL%
)

pause
