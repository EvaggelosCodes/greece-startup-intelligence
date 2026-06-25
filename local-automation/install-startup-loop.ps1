param(
  [string]$ShortcutName = "Startup Mike Local Scheduler.cmd"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runner = Join-Path $ScriptDir "start-local-scheduler-loop.ps1"
$StartupDir = [Environment]::GetFolderPath("Startup")
$StartupCmd = Join-Path $StartupDir $ShortcutName

$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes(@"
Start-Process powershell.exe -WindowStyle Minimized -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '$Runner')
"@))
$content = @"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded
"@

Set-Content -Path $StartupCmd -Value $content -Encoding ASCII
Start-Process powershell.exe -WindowStyle Minimized -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $Runner)

Write-Host "Installed startup loop: $StartupCmd"
Write-Host "It runs in the background while you are logged in and checks every 15 minutes."
