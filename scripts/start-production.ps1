$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$logPath = $null

function Rotate-ProductionLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [int64]$MaximumBytes = 5MB,

        [int]$RetainedFiles = 3
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return
    }

    if ((Get-Item -LiteralPath $Path).Length -lt $MaximumBytes) {
        return
    }

    for ($index = $RetainedFiles - 1; $index -ge 1; $index--) {
        $sourcePath = "$Path.$index"
        $destinationPath = "$Path.$($index + 1)"

        if (Test-Path -LiteralPath $sourcePath -PathType Leaf) {
            Move-Item `
                -LiteralPath $sourcePath `
                -Destination $destinationPath `
                -Force
        }
    }

    Move-Item `
        -LiteralPath $Path `
        -Destination "$Path.1" `
        -Force
}

try {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        throw "Windows did not provide the LOCALAPPDATA directory."
    }

    $repositoryDirectory = Split-Path -Parent $PSScriptRoot
    $applicationDataDirectory = Join-Path $env:LOCALAPPDATA "TrophyBacklog"
    $logDirectory = Join-Path $applicationDataDirectory "logs"
    $logPath = Join-Path $logDirectory "production.log"
    $apiEntryPoint = Join-Path $repositoryDirectory "apps\api\dist\index.js"
    $webDirectory = Join-Path $repositoryDirectory "apps\web\dist"
    $webIndexPath = Join-Path $webDirectory "index.html"

    New-Item `
        -ItemType Directory `
        -Path $logDirectory `
        -Force |
        Out-Null

    Rotate-ProductionLog -Path $logPath

    if (-not (Test-Path -LiteralPath $apiEntryPoint -PathType Leaf)) {
        throw "The compiled API was not found. Run npm run build before starting production."
    }

    if (-not (Test-Path -LiteralPath $webIndexPath -PathType Leaf)) {
        throw "The compiled web application was not found. Run npm run build before starting production."
    }

    $nodeCommand = Get-Command node.exe -ErrorAction Stop

    Set-Location -LiteralPath $repositoryDirectory

    $env:NODE_ENV = "production"
    $env:BACKLOG_HOST = "127.0.0.1"
    $env:BACKLOG_PORT = "47831"
    $env:BACKLOG_DATA_DIRECTORY = $applicationDataDirectory
    $env:BACKLOG_WEB_DIRECTORY = $webDirectory

    Add-Content `
        -LiteralPath $logPath `
        -Encoding UTF8 `
        -Value "`r`n=== Trophy Backlog starting at $((Get-Date).ToString("O")) ==="

    & $nodeCommand.Source $apiEntryPoint 2>&1 |
        Out-File `
            -LiteralPath $logPath `
            -Append `
            -Encoding utf8

    $processExitCode = $LASTEXITCODE

    Add-Content `
        -LiteralPath $logPath `
        -Encoding UTF8 `
        -Value "=== Trophy Backlog exited with code $processExitCode at $((Get-Date).ToString("O")) ==="

    exit $processExitCode
}
catch {
    $failureMessage =
        "Trophy Backlog launcher failed at $((Get-Date).ToString("O")): $($_.Exception.Message)"

    if ($null -ne $logPath) {
        Add-Content `
            -LiteralPath $logPath `
            -Encoding UTF8 `
            -Value $failureMessage
    }
    else {
        Write-Error $failureMessage
    }

    exit 1
}