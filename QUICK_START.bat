@echo off
REM Quick launcher - assumes setup is already done
cd /d "%~dp0"

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    python app.py
    call venv\Scripts\deactivate.bat
) else (
    echo Virtual environment not found!
    echo.
    echo Please run setup_and_launch.bat first to set up the app.
    echo.
    pause
)

