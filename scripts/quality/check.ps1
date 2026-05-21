param(
    [switch]$SkipFrontend,
    [switch]$SkipFrontendAudit,
    [switch]$SkipFrontendTest,
    [switch]$SkipFrontendBuild,
    [switch]$SkipBackend,
    [switch]$SkipBackendCompile
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

function Invoke-Native {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
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

function Test-BackendSourceGuardrails {
    $sourceRoot = Join-Path $root "excel-forum-backend\src\main\java"
    $controllerRoot = Join-Path $sourceRoot "com\excel\forum\controller"

    $requestBodyMapMatches = Get-ChildItem -Path $controllerRoot -Recurse -Filter *.java -File |
        Select-String -Pattern "@RequestBody\s+(java\.util\.)?Map\b"
    $sqlSuffixMatches = Get-ChildItem -Path $sourceRoot -Recurse -Filter *.java -File |
        Select-String -Pattern "\.last\s*\("
    $ignoredCatchMatches = Get-ChildItem -Path $sourceRoot -Recurse -Filter *.java -File |
        Select-String -Pattern "catch\s*\([^)]*\bignored\b[^)]*\)"

    $failed = $false
    foreach ($matchGroup in @(
        @{ Name = "Controller @RequestBody Map"; Matches = $requestBodyMapMatches },
        @{ Name = "MyBatis-Plus .last SQL suffix"; Matches = $sqlSuffixMatches },
        @{ Name = "ignored catch blocks"; Matches = $ignoredCatchMatches }
    )) {
        if ($matchGroup.Matches) {
            Write-Host ""
            Write-Host ("{0} scan failed:" -f $matchGroup.Name)
            $matchGroup.Matches | ForEach-Object {
                Write-Host ("{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim())
            }
            $failed = $true
        }
    }

    if ($failed) {
        throw "Backend source guardrail scan failed."
    }

    Write-Host "Backend source guardrails passed."
}

if (-not $SkipFrontend) {
    Invoke-Step "Frontend explicit any scan" {
        Test-FrontendExplicitAny
    }

    if (-not $SkipFrontendAudit) {
        Invoke-Step "Frontend dependency audit" {
            Invoke-InDirectory (Join-Path $root "reace_web") {
                Invoke-Native "npm" @("audit", "--audit-level=moderate")
            }
        }
    }

    Invoke-Step "Frontend typecheck" {
        Invoke-InDirectory (Join-Path $root "reace_web") {
            Invoke-Native "npm" @("run", "typecheck")
        }
    }

    if (-not $SkipFrontendTest) {
        Invoke-Step "Frontend tests" {
            Invoke-InDirectory (Join-Path $root "reace_web") {
                Invoke-Native "npm" @("run", "test")
            }
        }
    }

    if (-not $SkipFrontendBuild) {
        Invoke-Step "Frontend production build" {
            Invoke-InDirectory (Join-Path $root "reace_web") {
                Invoke-Native "npm" @("run", "build")
            }
        }
    }
}

Invoke-Step "Perf script validation" {
    Invoke-InDirectory $root {
        Invoke-Native "powershell" @("-ExecutionPolicy", "Bypass", "-File", "scripts\perf\validate-k6-scripts.ps1")
    }
}

if (-not $SkipBackend) {
    Invoke-Step "Backend source guardrails" {
        Test-BackendSourceGuardrails
    }

    if (-not $SkipBackendCompile) {
        Invoke-Step "Backend compile" {
            Invoke-InDirectory (Join-Path $root "excel-forum-backend") {
                Invoke-Native "mvn" @("-q", "-DskipTests", "compile")
            }
        }
    }

    Invoke-Step "Backend tests" {
        Invoke-InDirectory (Join-Path $root "excel-forum-backend") {
            Invoke-Native "mvn" @("test")
        }
    }
}

Write-Host ""
Write-Host "Quality gate passed."
