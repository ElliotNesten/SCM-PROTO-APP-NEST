@echo off
setlocal

for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "NODE_DIR=%ROOT%\.tools\node-v24.14.0-win-x64"

title SCM Platform Dev Server
cd /d "%ROOT%"
set "PATH=%NODE_DIR%;%PATH%"

call "%NODE_DIR%\npm.cmd" run dev

echo.
echo Dev server stopped. Press any key to close this window.
pause >nul
