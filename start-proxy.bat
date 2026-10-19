@echo off
chcp 65001 >nul
echo 正在启动网易云歌词代理（http://127.0.0.1:8787）...
echo.
where node >nul 2>nul
if %errorlevel%==0 (
  node "%~dp0lyric-proxy.js"
) else (
  echo [错误] 未检测到 Node.js。
  echo 请先安装： https://nodejs.org （LTS 版即可）
  echo 安装后重新双击本文件，或手动运行： node "%~dp0lyric-proxy.js"
)
pause
