@echo off
REM Quick launcher - tries to use system Python if venv doesn't exist
cd /d "%~dp0"

if exist "venv\Scripts\activate.bat" (
    echo Using virtual environment...
    call venv\Scripts\activate.bat
    python app.py
    call venv\Scripts\deactivate.bat
) else (
    echo Virtual environment not found!
    echo.
    echo Attempting to run with system Python...
    echo (If this fails, run setup_and_launch.bat first)
    echo.
    python app.py
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to launch!
        echo Please run setup_and_launch.bat to set up the virtual environment.
        echo.
        pause
    )
)

