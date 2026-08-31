$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$taskName = "Trophy Backlog"
$productionPort = 47831

& schtasks.exe /End /TN $taskName 2>$null | Out-Null

$gracefulDeadline = (Get-Date).AddSeconds(3)

do {
    $listeners = @(
        Get-NetTCPConnection `
            -LocalPort $productionPort `
            -State Listen `
            -ErrorAction SilentlyContinue
    )

    if ($listeners.Count -eq 0) {
        Write-Host "Trophy Backlog production process stopped."
        exit 0
    }

    Start-Sleep -Milliseconds 250
}
while ((Get-Date) -lt $gracefulDeadline)

$processIds = @(
    $listeners |
        Select-Object -ExpandProperty OwningProcess -Unique
)

foreach ($ownerProcessId in $processIds) {
    Write-Host (
        "Stopping stale Trophy Backlog process " +
        "$ownerProcessId."
    )

    Stop-Process `
        -Id $ownerProcessId `
        -Force `
        -ErrorAction Stop
}

$forcedDeadline = (Get-Date).AddSeconds(10)

do {
    $listeners = @(
        Get-NetTCPConnection `
            -LocalPort $productionPort `
            -State Listen `
            -ErrorAction SilentlyContinue
    )

    if ($listeners.Count -eq 0) {
        Write-Host "Trophy Backlog production process stopped."
        exit 0
    }

    Start-Sleep -Milliseconds 250
}
while ((Get-Date) -lt $forcedDeadline)

throw (
    "Production port $productionPort remained occupied after " +
    "the stale Trophy Backlog process was stopped."
)