$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$taskName = "Trophy Backlog"
$repositoryDirectory = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $PSScriptRoot "start-production.ps1"
$hiddenLauncherPath = Join-Path $PSScriptRoot "start-production-hidden.vbs"
$apiEntryPoint = Join-Path $repositoryDirectory "apps\api\dist\index.js"
$webIndexPath = Join-Path $repositoryDirectory "apps\web\dist\index.html"
$productionUrl = "http://127.0.0.1:47831"
$healthUrl = "$productionUrl/api/health"

if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
    throw "The production launcher does not exist at $launcherPath."
}

if (-not (Test-Path -LiteralPath $hiddenLauncherPath -PathType Leaf)) {
    throw "The hidden production launcher does not exist at $hiddenLauncherPath."
}

if (-not (Test-Path -LiteralPath $apiEntryPoint -PathType Leaf)) {
    throw "The compiled API is missing. Run npm run build first."
}

if (-not (Test-Path -LiteralPath $webIndexPath -PathType Leaf)) {
    throw "The compiled web application is missing. Run npm run build first."
}

Get-Command node.exe -ErrorAction Stop | Out-Null

$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$windowsScriptHostPath = Join-Path `
    $env:SystemRoot `
    "System32\wscript.exe"

$hiddenLauncherArguments =
    "//B //NoLogo `"$hiddenLauncherPath`""

$existingTask = Get-ScheduledTask `
    -TaskName $taskName `
    -ErrorAction SilentlyContinue

if ($null -ne $existingTask) {
    if ($existingTask.State -eq "Running") {
        Stop-ScheduledTask -TaskName $taskName
        Start-Sleep -Seconds 2
    }

    Unregister-ScheduledTask `
        -TaskName $taskName `
        -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute $windowsScriptHostPath `
    -Argument $hiddenLauncherArguments `
    -WorkingDirectory $repositoryDirectory

$trigger = New-ScheduledTaskTrigger `
    -AtLogOn `
    -User $userId

$principal = New-ScheduledTaskPrincipal `
    -UserId $userId `
    -LogonType Interactive `
    -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

$task = New-ScheduledTask `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Runs the local Trophy Backlog production application."

Register-ScheduledTask `
    -TaskName $taskName `
    -InputObject $task `
    -Force |
    Out-Null

Start-ScheduledTask -TaskName $taskName

$healthy = $false

for ($attempt = 1; $attempt -le 20; $attempt++) {
    Start-Sleep -Milliseconds 500

    try {
        $health = Invoke-RestMethod `
            -Uri $healthUrl `
            -Method Get `
            -TimeoutSec 1

        if ($health.ok -eq $true) {
            $healthy = $true
            break
        }
    }
    catch {
        # The application may still be starting.
    }
}

if (-not $healthy) {
    $logPath = Join-Path `
        $env:LOCALAPPDATA `
        "TrophyBacklog\logs\production.log"

    throw "The task was registered, but the health check failed. Inspect $logPath."
}

Write-Host ""
Write-Host "Trophy Backlog production task installed successfully."
Write-Host "Production URL: $productionUrl"
Write-Host "Friendly PC URL: http://trophy-backlog.localhost:47831"
Write-Host "The task will start automatically at Windows logon."