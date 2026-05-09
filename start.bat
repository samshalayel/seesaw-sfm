@echo off
title Office Lite
echo Starting Office Lite...

:: Server
start "Office-Server" cmd /k "cd /d D:\office-lite && set NODE_ENV=development && set PORT=3001 && node node_modules\tsx\dist\cli.mjs server\index.ts"

:: Wait a moment then start Vite
timeout /t 3 /nobreak >nul

:: Vite client
start "Office-Vite" cmd /k "cd /d D:\office-lite && node node_modules\vite\bin\vite.js"

:: Open browser after Vite starts
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo Servers started!
echo   Client: http://localhost:5173
echo   Server: http://localhost:3001
