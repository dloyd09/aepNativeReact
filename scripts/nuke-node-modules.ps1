# Run ONLY after fully quitting Cursor/VS Code (File -> Exit).
# Stops Gradle daemons, then removes node_modules.
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  Write-Host 'Run from repo root or keep script in scripts/' -ForegroundColor Red
  exit 1
}
Set-Location $root
Write-Host "Project: $root"

if (Test-Path 'android\gradlew.bat') {
  Write-Host 'Stopping Gradle daemons...'
  Push-Location android
  & .\gradlew.bat --stop 2>$null
  Pop-Location
  Start-Sleep -Seconds 2
}

if (-not (Test-Path 'node_modules')) {
  Write-Host 'node_modules already gone.'
  exit 0
}

$empty = Join-Path $root '_empty_nuke_node_modules'
New-Item -ItemType Directory -Path $empty -Force | Out-Null
Write-Host 'Clearing node_modules (robocopy)...'
robocopy $empty node_modules /mir /nfl /ndl /njh /njs /nc /ns /np /mt:16 | Out-Null
Remove-Item $empty -Force -ErrorAction SilentlyContinue
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path 'node_modules') {
  cmd /c "rd /s /q node_modules"
}

if (Test-Path 'node_modules') {
  Write-Host ''
  Write-Host 'FAILED: Something still has files open. Close all IDEs, then reboot and run this script again.' -ForegroundColor Red
  exit 1
}

Write-Host 'OK: node_modules removed. Run: npm install' -ForegroundColor Green
exit 0
