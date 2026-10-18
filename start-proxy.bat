@echo off
chcp 65001 >nul
echo 正在启动网易云歌词代理（http://127.0.0.1:8787）...
rem 若提示 node 不是命令，请安装 Node.js 后改用： node "%~dp0lyric-proxy.js"
"C:/Users/25498/.workbuddy/binaries/node/versions/22.22.2-6/node.exe" "%~dp0lyric-proxy.js"
pause
