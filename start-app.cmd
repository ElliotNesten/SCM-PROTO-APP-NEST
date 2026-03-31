@echo off
setlocal

for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "NODE_DIR=%ROOT%\.tools\node-v24.14.0-win-x64"
set "TARGET_URL=http://localhost:3000/dashboard"
set "CMD_EXE=%SystemRoot%\System32\cmd.exe"
set "CURL_EXE=%SystemRoot%\System32\curl.exe"

if not exist "%NODE_DIR%\node.exe" (
  echo Portable Node.js was not found in "%NODE_DIR%".
  pause
  exit /b 1
)

set "PATH=%NODE_DIR%;%PATH%"

if not exist "%ROOT%\node_modules" (
  echo Installing dependencies...
  call "%NODE_DIR%\npm.cmd" install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Checking if SCM Platform is already running...
call :is_server_up
if not errorlevel 1 (
  echo SCM Platform is already running. Opening browser...
  start "" %TARGET_URL%
  exit /b 0
)

echo Starting SCM Platform dev server...
start "SCM Platform Dev Server" "%CMD_EXE%" /k call "%ROOT%\run-dev-server.cmd"

echo Waiting for SCM Platform to start...
call :wait_for_server
if errorlevel 1 (
  echo The dev server did not respond on localhost:3000 in time.
  echo The server window is still open, so you can check it for errors.
  pause
  exit /b 1
)

start "" %TARGET_URL%
exit /b 0

:is_server_up
"%CURL_EXE%" --silent --output NUL --max-time 2 "%TARGET_URL%"
if not errorlevel 1 exit /b 0
exit /b 1

:wait_for_server
for /l %%I in (1,1,30) do (
  call :is_server_up
  if not errorlevel 1 exit /b 0
  ping -n 3 127.0.0.1 >nul
)
exit /b 1
