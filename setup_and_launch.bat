@echo off
REM ============================================================
REM Obsidian Definitions Manager - Complete Setup & Launch
REM ============================================================
title Obsidian Definitions Manager - Setup & Launch

:: Change to script directory
cd /d "%~dp0"

echo.
echo ============================================================
echo   Obsidian Definitions Manager - Setup & Launch
echo ============================================================
echo.

:: Check if Python is installed
echo [1/6] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Python is not installed or not in PATH!
    echo.
    echo Please install Python from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] Python %PYTHON_VERSION% found

:: Check Python version (need 3.8+)
python -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Python 3.8 or higher is required!
    echo Current version: %PYTHON_VERSION%
    echo.
    pause
    exit /b 1
)

echo [OK] Python version is compatible
echo.

:: Create virtual environment
echo [2/6] Setting up virtual environment...
if exist "venv" (
    echo [INFO] Virtual environment already exists, checking...
    call venv\Scripts\activate.bat >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Virtual environment appears corrupted, recreating...
        rmdir /s /q venv
        python -m venv venv
        if errorlevel 1 (
            echo [ERROR] Failed to create virtual environment!
            pause
            exit /b 1
        )
    ) else (
        echo [OK] Using existing virtual environment
    )
) else (
    echo [INFO] Creating new virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment!
        echo.
        echo Try running: python -m pip install --upgrade pip
        echo.
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created
)

echo.

:: Activate virtual environment
echo [3/6] Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment!
    pause
    exit /b 1
)
echo [OK] Virtual environment activated
echo.

:: Upgrade pip
echo [4/6] Upgrading pip...
python -m pip install --upgrade pip --quiet
if errorlevel 1 (
    echo [WARNING] Failed to upgrade pip, continuing anyway...
) else (
    echo [OK] pip upgraded
)
echo.

:: Install/update dependencies
echo [5/6] Installing/updating dependencies...
if exist "requirements.txt" (
    echo [INFO] Installing packages from requirements.txt...
    python -m pip install -r requirements.txt --quiet
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to install dependencies!
        echo.
        echo Trying verbose installation for troubleshooting...
        echo.
        python -m pip install -r requirements.txt
        echo.
        echo [TROUBLESHOOTING]
        echo If installation failed, try:
        echo   1. Check your internet connection
        echo   2. Run: python -m pip install --upgrade pip
        echo   3. Try installing packages one by one
        echo.
        pause
        exit /b 1
    )
    echo [OK] All dependencies installed/updated
) else (
    echo [WARNING] requirements.txt not found!
    echo [INFO] Installing basic dependencies...
    python -m pip install PySide6 --quiet
    if errorlevel 1 (
        echo [ERROR] Failed to install PySide6!
        pause
        exit /b 1
    )
    echo [OK] Basic dependencies installed
)
echo.

:: Verify installation
echo [6/6] Verifying installation...
python -c "import PySide6; print('[OK] PySide6 installed')" 2>nul
if errorlevel 1 (
    echo [ERROR] PySide6 verification failed!
    echo.
    echo [TROUBLESHOOTING]
    echo Try running: python -m pip install --force-reinstall PySide6
    echo.
    pause
    exit /b 1
)

python -c "import sys; sys.path.insert(0, '.'); from core.settings_manager import SettingsManager; print('[OK] Core modules importable')" 2>nul
if errorlevel 1 (
    echo [WARNING] Some modules may not be fully set up, but continuing...
)

echo [OK] Installation verified
echo.

:: Summary
echo ============================================================
echo   Setup Complete!
echo ============================================================
echo.
echo Virtual environment: venv\
echo Python: %PYTHON_VERSION%
echo Location: %CD%
echo.
echo Ready to launch Obsidian Definitions Manager!
echo.

:: Launch app
echo [LAUNCH] Starting application...
echo.
python app.py
set APP_EXIT_CODE=%ERRORLEVEL%

echo.
echo ============================================================
if %APP_EXIT_CODE% equ 0 (
    echo   Application closed normally
) else (
    echo   Application exited with code %APP_EXIT_CODE%
    echo.
    echo [TROUBLESHOOTING]
    echo If the app crashed, check:
    echo   1. All dependencies are installed: pip list
    echo   2. Python version is 3.8+: python --version
    echo   3. Vault path is set correctly in Settings tab
    echo   4. Check for error messages above
)
echo ============================================================
echo.

:: Keep window open
echo Press Enter to close this window...
pause >nul

:: Deactivate virtual environment
call venv\Scripts\deactivate.bat >nul 2>&1

exit /b %APP_EXIT_CODE%

