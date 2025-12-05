@echo off
echo ==========================================
echo  Push to GitHub - YellowKidokc/theophysics-vault-manager
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
echo Step 4: Adding GitHub remote...
git remote add origin https://github.com/YellowKidokc/theophysics-vault-manager.git

echo.
echo Step 5: Setting main branch...
git branch -M main

echo.
echo Step 6: Pushing to GitHub...
echo (You may need to enter your GitHub credentials)
git push -u origin main

echo.
echo ==========================================
echo  DONE!
echo ==========================================
echo.
echo Your repo is now at:
echo https://github.com/YellowKidokc/theophysics-vault-manager
echo.
pause

