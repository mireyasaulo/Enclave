@echo off
cd /d "%~dp0"

echo 关闭占用端口...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5180 " 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5181 " 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5184 " 2^>nul') do taskkill /f /pid %%a >nul 2>&1

echo 启动后端 (port 3000)...
start "yinjie-api" cmd /k "cd /d "%~dp0api" && npm run start:dev"

timeout /t 3 /nobreak >nul

echo 启动主 App (port 5180)...
start "yinjie-app" cmd /k "cd /d "%~dp0apps\app" && npm run dev"

echo 启动 Wiki 角色管理平台 (port 5184)...
start "yinjie-wiki" cmd /k "cd /d "%~dp0apps\wiki" && npm run dev"

echo 启动管理后台 (port 5181)...
start "yinjie-admin" cmd /k "cd /d "%~dp0apps\admin" && npm run dev"

echo.
echo 后端 API:       http://localhost:3000
echo 主 App:         http://localhost:5180
echo Wiki 角色平台:  http://localhost:5184
echo 管理后台:       http://localhost:5181
