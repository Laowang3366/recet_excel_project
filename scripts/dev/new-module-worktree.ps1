param(
    [Parameter(Mandatory = $true)]
    [string]$Module,

    [Parameter(Mandatory = $true)]
    [string]$Feature,

    [string]$Base = "origin/main",
    [string]$WorktreeRoot = ".worktrees",
    [switch]$NoFetch,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Convert-ToSlug {
    param([string]$Value)

    $slug = $Value.Trim().ToLowerInvariant() -replace "[^a-z0-9._-]+", "-"
    $slug = $slug -replace "^-+", "" -replace "-+$", ""
    if ([string]::IsNullOrWhiteSpace($slug)) {
        throw "Module and feature must contain at least one ASCII letter or number."
    }
    return $slug
}

function Test-GitRef {
    param([string]$Ref)

    $null = & git rev-parse --verify --quiet $Ref 2>$null
    return $LASTEXITCODE -eq 0
}

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
    throw "This script must run inside a Git repository."
}

Set-Location $repoRoot

$moduleSlug = Convert-ToSlug $Module
$featureSlug = Convert-ToSlug $Feature
$branchName = "codex/$moduleSlug-$featureSlug"
$worktreeName = "$moduleSlug-$featureSlug"
$worktreeRootPath = Join-Path $repoRoot $WorktreeRoot
$worktreePath = Join-Path $worktreeRootPath $worktreeName

$status = & git status --porcelain
if ($status) {
    if ($DryRun) {
        Write-Warning "Main worktree is not clean. A real module worktree creation would stop here."
    } else {
        throw "Main worktree is not clean. Commit, stash, or move current changes before creating a module worktree."
    }
}

$ignoreProbe = ($WorktreeRoot -replace "[\\/]+$", "") + "/"
$null = & git check-ignore -q $ignoreProbe 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "$WorktreeRoot is not ignored. Add it to .gitignore before creating project-local worktrees."
}

if (Test-Path -LiteralPath $worktreePath) {
    throw "Worktree path already exists: $worktreePath"
}

if (-not $NoFetch -and -not $DryRun) {
    & git fetch origin --prune
    if ($LASTEXITCODE -ne 0) {
        throw "git fetch origin --prune failed."
    }
}

$baseExists = Test-GitRef $Base
if (-not $baseExists) {
    throw "Base ref does not exist: $Base"
}

$localBranchExists = Test-GitRef "refs/heads/$branchName"
$remoteBranchExists = Test-GitRef "refs/remotes/origin/$branchName"

Write-Host "Module: $moduleSlug"
Write-Host "Feature: $featureSlug"
Write-Host "Branch: $branchName"
Write-Host "Worktree: $worktreePath"
Write-Host "Base: $Base"

if ($DryRun) {
    Write-Host "Dry run only. No worktree created."
    exit 0
}

New-Item -ItemType Directory -Path $worktreeRootPath -Force | Out-Null

if ($localBranchExists) {
    & git worktree add $worktreePath $branchName
} elseif ($remoteBranchExists) {
    & git worktree add -b $branchName $worktreePath "origin/$branchName"
} else {
    & git worktree add -b $branchName $worktreePath $Base
}

if ($LASTEXITCODE -ne 0) {
    throw "git worktree add failed."
}

Write-Host ""
Write-Host "Module worktree ready."
Write-Host "Next:"
Write-Host "  cd `"$worktreePath`""
Write-Host "  git status -sb"
