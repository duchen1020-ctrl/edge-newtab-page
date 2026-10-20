@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo ============================================
echo   Music Parse Proxy (Bilibili / NetEase)
echo   http://127.0.0.1:8787
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 goto :nonode
netstat -ano ^| findstr /R /C:":8787 .*LISTENING" >nul 2>nul
if not errorlevel 1 goto :inuse
node "%~dp0lyric-proxy.js"
goto :end
:inuse
echo [INFO] Port 8787 is already in use - proxy seems to be running.
echo        If parsing fails, close the old window and run this file again.
echo.
pause
goto :eof
:nonode
echo [ERROR] Node.js not found in PATH.
echo Please install Node.js LTS from: https://nodejs.org
echo Then double-click this file again.
:end
echo.
pause
