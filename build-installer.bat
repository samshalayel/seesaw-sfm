@echo off
title بناء المكتب الذكي - Installer
cd /d "%~dp0"
echo.
echo  ╔══════════════════════════════════════╗
echo  ║   بناء ملف التثبيت (.exe) للويندوز  ║
echo  ╚══════════════════════════════════════╝
echo.
echo [1/2] بناء الواجهة (Vite)...
call npm run build
if %errorlevel% neq 0 ( echo [!] فشل البناء & pause & exit /b 1 )

echo.
echo [2/2] تجميع ملف الإنستولر (electron-builder)...
call node_modules\.bin\electron-builder.cmd --win
if %errorlevel% neq 0 ( echo [!] فشل التجميع & pause & exit /b 1 )

echo.
echo  ╔══════════════════════════════════════╗
echo  ║  ✅ تم! الملف في مجلد dist-electron  ║
echo  ╚══════════════════════════════════════╝
echo.
explorer dist-electron
pause
