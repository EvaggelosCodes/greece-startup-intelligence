param(
  [int]$CheckEveryMinutes = 15,
  [int]$IntervalHours = 12,
  [int]$MaxRunMinutes = 60
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runner = Join-Path $ScriptDir "run-mike-if-due.ps1"
$LogDir = Join-Path $ScriptDir "logs"
$PidFile = Join-Path $ScriptDir "loop.pid"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$PID | Set-Content -Path $PidFile -Encoding UTF8

while ($true) {
  try {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Runner -IntervalHours $IntervalHours -MaxRunMinutes $MaxRunMinutes
  } catch {
    Add-Content -Path (Join-Path $LogDir "scheduler.log") -Value "$([DateTime]::UtcNow.ToString('o')) LOOP ERROR: $($_.Exception.Message)" -Encoding UTF8
  }
  Start-Sleep -Seconds ($CheckEveryMinutes * 60)
}
