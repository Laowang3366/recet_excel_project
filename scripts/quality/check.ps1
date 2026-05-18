param(
    [switch]$SkipFrontend,
    [switch]$SkipFrontendBuild,
    [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Name"
    & $Action
}

function Invoke-InDirectory {
    param(
        [string]$Path,
        [scriptblock]$Action
    )

    Push-Location $Path
    try {
        & $Action
    } finally {
        Pop-Location
    }
}

function Test-FrontendExplicitAny {
    $sourceRoot = Join-Path $root "reace_web\src\app"
    $files = Get-ChildItem -Path $sourceRoot -Recurse -Include *.ts,*.tsx -File
    $patterns = @(
        ":\s*any\b",
        "\bas\s+any\b",
        "<\s*any\s*>",
        "\bArray\s*<\s*any\s*>",
        "\bRecord\s*<[^>]*\bany\b[^>]*>"
    )

    $matches = foreach ($pattern in $patterns) {
        $files | Select-String -Pattern $pattern
    }

    if ($matches) {
        $matches | ForEach-Object {
            Write-Host ("{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim())
        }
        throw "Frontend explicit any scan failed."
    }

    Write-Host "No explicit any usage found under reace_web/src/app."
}

if (-not $SkipFrontend) {
    Invoke-Step "Frontend explicit any scan" {
        Test-FrontendExplicitAny
    }

    Invoke-Step "Frontend typecheck" {
        Invoke-InDirectory (Join-Path $root "reace_web") {
            npm run typecheck
        }
    }

    if (-not $SkipFrontendBuild) {
        Invoke-Step "Frontend production build" {
            Invoke-InDirectory (Join-Path $root "reace_web") {
                npm run build
            }
        }
    }
}

if (-not $SkipBackend) {
    Invoke-Step "Backend tests" {
        Invoke-InDirectory (Join-Path $root "excel-forum-backend") {
            mvn test
        }
    }
}

Write-Host ""
Write-Host "Quality gate passed."
