@echo off
echo ==========================================
echo  Push Theophysics Vault Manager to GitHub
echo ==========================================
echo.

cd /d "D:\theophysics-research-manager"

echo Step 1: Initializing Git...
git init

echo.
echo Step 2: Adding all files...
git add .

echo.
echo Step 3: Creating commit...
git commit -m "v2.0: Theophysics Vault Manager - Paper Scanner, Definition Engine, Structure Builder"

echo.
echo ==========================================
echo  Now do these steps manually:
echo ==========================================
echo.
echo 1. Go to https://github.com/new
echo 2. Create repo named: theophysics-vault-manager
echo 3. Don't initialize with README
echo 4. Copy your repo URL
echo.
echo Then run this command (replace YOUR_USERNAME):
echo.
echo   git remote add origin https://github.com/YOUR_USERNAME/theophysics-vault-manager.git
echo   git branch -M main
echo   git push -u origin main
echo.
pause

