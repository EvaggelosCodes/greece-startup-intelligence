param(
  [string]$ConsoleUrl = "http://localhost:4317",
  [int]$PollSeconds = 30,
  [int]$RestSeconds = 45,
  [string]$StopFile = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if ([string]::IsNullOrWhiteSpace($StopFile)) {
  $StopFile = Join-Path $Root "local-automation\STOP_OPENROUTER_SPRINT"
}
$LogFile = Join-Path $Root "local-automation\openrouter-sprint.log"

function Log($Message) {
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -LiteralPath $LogFile -Value $line
}

function Get-State {
  (Invoke-RestMethod -Uri "$ConsoleUrl/api/state" -Method Get -TimeoutSec 20)
}

function Start-Run {
  Invoke-RestMethod -Uri "$ConsoleUrl/api/run" -Method Post -TimeoutSec 20
}

Log "sprint started; stop file: $StopFile"

while ($true) {
  if (Test-Path -LiteralPath $StopFile) {
    Log "stop file found; exiting"
    break
  }

  try {
    $state = Get-State
  } catch {
    Log "console unavailable: $($_.Exception.Message)"
    Start-Sleep -Seconds $PollSeconds
    continue
  }

  if ($state.run.running) {
    Log "run active; phase=$($state.run.phase)"
    Start-Sleep -Seconds $PollSeconds
    continue
  }

  $err = [string]$state.run.lastError
  if ($err -match "quota|credit|insufficient|rate limit|too many requests|authentication|auth|context limit|max_tokens") {
    Log "stopping on provider/error: $err"
    break
  }

  try {
    $res = Start-Run
    Log "start requested: ok=$($res.ok) running=$($res.running)"
  } catch {
    Log "start failed: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds $RestSeconds
}

Log "sprint ended"
