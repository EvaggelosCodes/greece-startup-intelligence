param(
  [string]$TaskName = "Startup Mike Local 12h Catchup"
)

$ErrorActionPreference = "Stop"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed scheduled task: $TaskName"
} else {
  & schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null
  & schtasks.exe /Delete /TN "$TaskName Logon" /F 2>$null | Out-Null
  Write-Host "Removed schtasks entries if present: $TaskName"
}
