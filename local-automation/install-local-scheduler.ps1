param(
  [string]$TaskName = "Startup Mike Local 12h Catchup",
  [int]$CheckEveryMinutes = 15,
  [int]$IntervalHours = 12,
  [int]$MaxRunMinutes = 60
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$Runner = Join-Path $ScriptDir "run-mike-if-due.ps1"

if (!(Test-Path $Runner)) {
  throw "Missing runner script: $Runner"
}

$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$args = "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`" -IntervalHours $IntervalHours -MaxRunMinutes $MaxRunMinutes"

$action = New-ScheduledTaskAction -Execute $ps -Argument $args -WorkingDirectory $Root
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn
$pollTrigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes $CheckEveryMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes ($MaxRunMinutes + 15))
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($logonTrigger, $pollTrigger) -Settings $settings -Principal $principal -Force | Out-Null
} catch {
  Write-Host "Register-ScheduledTask failed, falling back to schtasks.exe: $($_.Exception.Message)"
  $pollName = $TaskName
  $logonName = "$TaskName Logon"
  $quotedRunner = '"' + $Runner + '"'
  $taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $quotedRunner -IntervalHours $IntervalHours -MaxRunMinutes $MaxRunMinutes"
  & schtasks.exe /Create /TN $pollName /SC MINUTE /MO $CheckEveryMinutes /TR $taskCommand /F | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "schtasks poll task creation failed with exit $LASTEXITCODE" }
  & schtasks.exe /Create /TN $logonName /SC ONLOGON /TR $taskCommand /F | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not create the optional logon task. The 15-minute catch-up task is installed and will still run after login."
  }
}

try {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  $task.Settings.DisallowStartIfOnBatteries = $false
  $task.Settings.StopIfGoingOnBatteries = $false
  $task.Settings.ExecutionTimeLimit = "PT$($MaxRunMinutes + 15)M"
  Set-ScheduledTask -InputObject $task | Out-Null
} catch {
  Write-Host "Could not tune battery/time-limit settings: $($_.Exception.Message)"
}

Write-Host "Installed scheduled task: $TaskName"
Write-Host "It checks every $CheckEveryMinutes minutes and runs Mike only if $IntervalHours hours have passed."
Write-Host "It also checks immediately whenever you log in."
