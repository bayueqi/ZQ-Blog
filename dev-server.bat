@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
title ZQ-Blog dev :3000
"C:\Users\byqij\.workbuddy\binaries\node\versions\22.22.2-6\node_modules\bun\bin\bun.exe" dev
echo.
echo ==== dev server exited (code %ERRORLEVEL%) ====
pause
