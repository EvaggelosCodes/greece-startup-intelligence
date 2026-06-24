param(
  [switch]$Force,
  [int]$IntervalHours = 12,
  [int]$MaxRunMinutes = 60
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$StatePath = Join-Path $ScriptDir "state.json"
$LockPath = Join-Path $ScriptDir "run.lock"
$LogDir = Join-Path $ScriptDir "logs"
$ProviderPath = Join-Path $Root "console\provider.json"
$DailyLogs = Join-Path $Root "daily-logs"

New-Item -ItemType Directory -Force -Path $ScriptDir, $LogDir, $DailyLogs | Out-Null

function NowUtcIso {
  return [DateTime]::UtcNow.ToString("o")
}

function Read-JsonFile($Path, $Fallback) {
  if (!(Test-Path $Path)) { return $Fallback }
  try {
    return Get-Content -Raw -Path $Path | ConvertFrom-Json
  } catch {
    return $Fallback
  }
}

function Write-JsonFile($Path, $Value) {
  $Value | ConvertTo-Json -Depth 8 | Set-Content -Path $Path -Encoding UTF8
}

function Append-RunLog($Message) {
  $line = "$(NowUtcIso) $Message"
  Add-Content -Path (Join-Path $LogDir "scheduler.log") -Value $line -Encoding UTF8
}

function Get-LastRunUtc($State) {
  if (!$State.lastRunAtUtc) { return $null }
  try { return [DateTime]::Parse($State.lastRunAtUtc).ToUniversalTime() } catch { return $null }
}

function Write-NoOutputMarker($RunUrl, $Model, $SmallModel, $ExitCode) {
  $date = [DateTime]::UtcNow.ToString("yyyy-MM-dd")
  $stamp = [DateTime]::UtcNow.ToString("HH:mm:ss 'UTC'")
  $file = Join-Path $DailyLogs "$date-local-no-output.md"
  @"
# Local Mike no-output run - $date

The local 12-hour Windows scheduler woke up at $stamp, but no research files changed.

- Runner: local Windows Task Scheduler
- Model: $Model
- Small model: $SmallModel
- Exit code: $ExitCode
- Note: this marker proves the local automation woke up instead of failing silently.
"@ | Set-Content -Path $file -Encoding UTF8
}

function Commit-ResearchChanges {
  Push-Location $Root
  try {
    & git add brain/ ideas/ daily-logs/ | Out-Null
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
      Append-RunLog "No research changes to commit."
      return
    }
    $date = [DateTime]::UtcNow.ToString("yyyy-MM-dd")
    & git commit -m "Run ${date}: local Mike update" | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Append-RunLog "git commit failed with exit $LASTEXITCODE"
      return
    }
    & git push origin main | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Append-RunLog "git push failed with exit $LASTEXITCODE"
    } else {
      Append-RunLog "Committed and pushed research changes."
    }
  } finally {
    Pop-Location
  }
}

$state = Read-JsonFile $StatePath ([pscustomobject]@{})
$lastRun = Get-LastRunUtc $state
$dueAt = if ($lastRun) { $lastRun.AddHours($IntervalHours) } else { [DateTime]::MinValue }
$now = [DateTime]::UtcNow

if (!$Force -and $lastRun -and $now -lt $dueAt) {
  $remaining = [Math]::Round(($dueAt - $now).TotalMinutes)
  Append-RunLog "Skip: not due for about $remaining minutes."
  exit 0
}

try {
  $lock = New-Item -Path $LockPath -ItemType File -Value "$(NowUtcIso) pid=$PID" -ErrorAction Stop
} catch {
  Append-RunLog "Skip: another local Mike run appears to be active."
  exit 0
}

$startedAt = [DateTime]::UtcNow
$runStamp = $startedAt.ToString("yyyyMMdd-HHmmss")
$stdoutPath = Join-Path $LogDir "$runStamp.stdout.jsonl"
$stderrPath = Join-Path $LogDir "$runStamp.stderr.log"
$exitCode = 999

try {
  $provider = Read-JsonFile $ProviderPath $null
  if (!$provider) { throw "Missing console/provider.json. Open the console Model panel and save a provider first." }
  if ($provider.enabled -eq $false) { throw "Provider is disabled in console/provider.json." }
  if ([string]::IsNullOrWhiteSpace($provider.apiKey)) { throw "Missing provider apiKey in console/provider.json." }

  $claude = (Get-Command claude -ErrorAction Stop).Source
  $model = if ($provider.model) { [string]$provider.model } else { "openai/gpt-oss-120b:free" }
  $smallModel = if ($provider.smallModel) { [string]$provider.smallModel } else { $model }
  $baseUrl = if ($provider.baseUrl) { [string]$provider.baseUrl } else { "https://openrouter.ai/api" }
  $timeoutMs = if ($provider.timeoutMs) { [string]$provider.timeoutMs } else { "900000" }

  $env:ANTHROPIC_BASE_URL = $baseUrl
  $env:ANTHROPIC_AUTH_TOKEN = [string]$provider.apiKey
  $env:ANTHROPIC_API_KEY = ""
  $env:OPENROUTER_API_KEY = [string]$provider.apiKey
  $env:ANTHROPIC_MODEL = $model
  $env:ANTHROPIC_DEFAULT_OPUS_MODEL = $model
  $env:ANTHROPIC_DEFAULT_SONNET_MODEL = $model
  $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $smallModel
  $env:ANTHROPIC_SMALL_FAST_MODEL = $smallModel
  $env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"
  $env:API_TIMEOUT_MS = $timeoutMs

  $before = (& git -C $Root status --short brain ideas daily-logs) -join "`n"
  $prompt = @"
You are Startup Mike. Run the complete daily sequence in CLAUDE.md, but keep it bounded for a local unattended 12-hour run.
Read brain/MIKE_JOURNAL.md, brain/FEEDBACK.md, brain/FOUNDER.md, brain/SEASONS.md, and the idea files first.
Do 3-5 targeted Greek-first searches, score candidates and existing ideas, kill weak ideas when justified, update the brain files, and write a daily log.
Before finishing, you MUST write or update one file under daily-logs/ with today's date, even if you found no good new idea.
Commit and push your changes.
"@

  Append-RunLog "Starting due run with model $model."
  $job = Start-Job -ScriptBlock {
    param($ClaudePath, $WorkDir, $PromptText, $StdoutFile, $StderrFile)
    Set-Location $WorkDir
    & $ClaudePath -p $PromptText --output-format stream-json --verbose --dangerously-skip-permissions 1> $StdoutFile 2> $StderrFile
    return $LASTEXITCODE
  } -ArgumentList $claude, $Root, $prompt, $stdoutPath, $stderrPath

  $finished = Wait-Job -Job $job -Timeout ($MaxRunMinutes * 60)
  if (!$finished) {
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    $exitCode = 124
    Append-RunLog "Stopped run after $MaxRunMinutes minutes."
  } else {
    $received = Receive-Job -Job $job
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    $exitCode = [int]($received | Select-Object -Last 1)
    Append-RunLog "Run exited with code $exitCode."
  }

  $after = (& git -C $Root status --short brain ideas daily-logs) -join "`n"
  if ($before -eq $after) {
    Write-NoOutputMarker "" $model $smallModel $exitCode
  }

  Commit-ResearchChanges

  $state = [pscustomobject]@{
    lastRunAtUtc = $startedAt.ToString("o")
    lastExitCode = $exitCode
    lastStdout = $stdoutPath
    lastStderr = $stderrPath
    intervalHours = $IntervalHours
    nextDueAtUtc = $startedAt.AddHours($IntervalHours).ToString("o")
  }
  Write-JsonFile $StatePath $state
} catch {
  Append-RunLog "ERROR: $($_.Exception.Message)"
  $state = [pscustomobject]@{
    lastRunAtUtc = $startedAt.ToString("o")
    lastExitCode = 1
    lastError = $_.Exception.Message
    intervalHours = $IntervalHours
    nextDueAtUtc = $startedAt.AddHours($IntervalHours).ToString("o")
  }
  Write-JsonFile $StatePath $state
  exit 1
} finally {
  Remove-Item -Path $LockPath -Force -ErrorAction SilentlyContinue
}

exit $exitCode
