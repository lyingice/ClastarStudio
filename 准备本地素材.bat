@echo off
cd /d "%~dp0"
echo ========================================
echo   像素工坊 · 本地素材准备
echo ========================================
echo 把 Create jar / 原版客户端 jar / 资源包 ZIP
echo 放到 local\inbox\ 后运行本脚本。
echo.
py -3 tools\prepare_local_assets.py
echo.
pause
