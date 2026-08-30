$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$taskName = "Trophy Backlog"
$existingTask = Get-ScheduledTask `
    -TaskName $taskName `
    -ErrorAction SilentlyContinue

if ($null -eq $existingTask) {
    Write-Host "The Trophy Backlog production task is not installed."
    exit 0
}

if ($existingTask.State -eq "Running") {
    Stop-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 2
}

Unregister-ScheduledTask `
    -TaskName $taskName `
    -Confirm:$false

Write-Host "The Trophy Backlog production task was removed."
Write-Host "Application data and logs were preserved in:"
Write-Host (Join-Path $env:LOCALAPPDATA "TrophyBacklog")