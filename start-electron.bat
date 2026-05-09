@echo off
title المكتب الذكي
cd /d "%~dp0"
echo.
echo  ╔══════════════════════════════╗
echo  ║     المكتب الذكي - بدء      ║
echo  ╚══════════════════════════════╝
echo.

:: تحقق من node
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [!] Node.js غير مثبت — حمّله من https://nodejs.org
  pause
  exit /b 1
)

:: تحقق من electron
if not exist "node_modules\electron\dist\electron.exe" (
  echo [!] Electron غير مثبت — جاري التثبيت...
  npm install --save-dev electron --legacy-peer-deps
)

echo [✓] جاري تشغيل التطبيق...
"node_modules\.bin\electron.cmd" .

