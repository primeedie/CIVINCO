@echo off
setlocal
cd /d "%~dp0"
for /d %%D in ("%~dp0.runtime\node-v*-win-x64") do set "PATH=%%~fD;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or newer, then open this launcher again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install
  if errorlevel 1 goto failed
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 goto failed
)
echo.
echo CIVINCO for Milch
echo Open http://localhost:4173 in your browser.
echo Keep this window open while studying. Press Ctrl+C to stop.
echo.
call npm start
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo CIVINCO could not start. See the message above for details.
pause
exit /b 1
