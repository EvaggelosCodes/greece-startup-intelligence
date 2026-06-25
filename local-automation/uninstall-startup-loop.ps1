param(
  [string]$ShortcutName = "Startup Mike Local Scheduler.cmd"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $ScriptDir "loop.pid"
$StartupDir = [Environment]::GetFolderPath("Startup")
$StartupCmd = Join-Path $StartupDir $ShortcutName

Remove-Item -Path $StartupCmd -Force -ErrorAction SilentlyContinue

if (Test-Path $PidFile) {
  $loopPid = Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($loopPid) {
    Stop-Process -Id ([int]$loopPid) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Removed startup loop if present."
