<#
.SYNOPSIS
  Interactive workflow for publishing a beta to AMO unlisted via CI.

  Pre-flight checks:
    - We're on master.
    - Working tree is clean.
    - Local master is in sync with origin/master.
    - Lists local branches NOT merged into master so you can spot
      anything you forgot to bring across.

  Confirmation prompts:
    - "Have you tested everything in master and are sure it works?"
    - "Are all open patches you want shipped already merged?"

  Then:
    npm run stage   (bumps the 4th segment, syncs manifest + version.json,
                     regenerates tiddlers/index.json)
    npm run lint    (web-ext lint — same check CI runs)
    git commit      (version + index changes; default message
                     "release: <version> (beta)" or your override)
    git push origin master              (publish the bump on master)
    git push origin master:unlisted     (triggers sign-unlisted.yml)

  Aborts early on any failed check or any "no" answer. If lint fails
  AFTER stage has bumped the version, the script tells you the exact
  command to revert the bump.

.PARAMETER DryRun
  Run all the pre-flight checks and the stage + lint cycle, but DO NOT
  commit and DO NOT push. Stage's side-effects on package.json /
  manifest.json / version.json / addon/tiddlers/index.json are reverted
  via `git checkout --` at the end so the workspace returns to its
  starting state. Useful for verifying the chain works before a real
  publish.

.NOTES
  Invoke via `npm run create-unlisted`, or directly:
    .\build-tools\create-unlisted.ps1
    .\build-tools\create-unlisted.ps1 -DryRun

  Requires PowerShell 7 (pwsh) or Windows PowerShell 5.1+, plus git
  and npm on PATH.
#>

[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

function Confirm-Prompt {
    param([string]$Question)
    while ($true) {
        $resp = Read-Host "$Question (y/n)"
        if ($resp -match '^[yY]') { return $true }
        if ($resp -match '^[nN]') { return $false }
    }
}

function Step {
    param([string]$Title)
    Write-Host ""
    Write-Host "→ $Title" -ForegroundColor Cyan
}

Push-Location $repoRoot
try {
    if ($DryRun) {
        Write-Host ""
        Write-Host "*** DRY RUN — no commit, no push ***" -ForegroundColor Magenta
    }

    # ---- Pre-flight: branch ----
    $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    if ($branch -ne "master") {
        Write-Host "Currently on branch '$branch'." -ForegroundColor Yellow
        if (-not (Confirm-Prompt "Switch to master?")) {
            throw "Aborted: must be on master to publish a beta."
        }
        & git checkout master
        if ($LASTEXITCODE -ne 0) { throw "git checkout master failed" }
    }

    # ---- Pre-flight: clean tree ----
    $dirty = (& git status --porcelain) -join ""
    if ($dirty) {
        Write-Host "Working tree has uncommitted changes:" -ForegroundColor Red
        & git status --short
        throw "Aborted: commit or stash before publishing."
    }

    # ---- Pre-flight: sync with origin/master ----
    Step "git fetch origin master"
    & git fetch origin master
    $local  = (& git rev-parse master).Trim()
    $remote = (& git rev-parse origin/master 2>$null)
    if ($remote) {
        $remote = $remote.Trim()
        if ($local -ne $remote) {
            $base = (& git merge-base master origin/master).Trim()
            if ($base -ne $remote) {
                Write-Host "Local master diverges from origin/master." -ForegroundColor Red
                Write-Host "  local:  $local"
                Write-Host "  remote: $remote"
                Write-Host "  base:   $base"
                throw "Aborted: pull/rebase first."
            }
        }
    }

    # ---- Inspect: master HEAD + unmerged branches ----
    Write-Host ""
    Write-Host "Master HEAD: $((& git log --oneline -1 master).Trim())"
    $unmerged = (& git branch --no-merged master) |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne "" -and $_ -notmatch '^\*' }
    if ($unmerged) {
        Write-Host ""
        Write-Host "Local branches NOT merged into master:" -ForegroundColor Yellow
        $unmerged | ForEach-Object { Write-Host "  $_" }
    }

    # ---- User confirmations ----
    Write-Host ""
    if (-not (Confirm-Prompt "Have you tested everything in master and are sure it works?")) {
        throw "Aborted: test master first."
    }
    if (-not (Confirm-Prompt "Are all open patches you want shipped already merged into master?")) {
        throw "Aborted: merge what you want shipped first."
    }

    # ---- Stage ----
    Step "npm run stage"
    & npm run stage
    if ($LASTEXITCODE -ne 0) { throw "stage failed (exit $LASTEXITCODE)" }

    # ---- Lint ----
    Step "npm run lint"
    & npm run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Lint failed. Version files were bumped during stage." -ForegroundColor Red
        Write-Host "If you want to abort and revert the bump, run:" -ForegroundColor Yellow
        Write-Host "  git checkout -- package.json addon/manifest.json version.json addon/tiddlers/index.json"
        throw "lint failed (exit $LASTEXITCODE)"
    }

    # ---- Read the new version ----
    $pkg = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
    $version = $pkg.version

    if ($DryRun) {
        # ---- Revert the stage mutations so the dry run is non-destructive ----
        Step "DRY RUN: revert stage changes"
        & git checkout -- package.json addon/manifest.json version.json addon/tiddlers/index.json
        Write-Host ""
        Write-Host "Dry run complete." -ForegroundColor Green
        Write-Host "  Stage chain ran cleanly; would have produced version $version."
        Write-Host "  Lint passed."
        Write-Host "  Workspace reverted to clean state — no commit, no push."
        return
    }

    # ---- Commit message ----
    $defaultMsg = "release: $version (beta)"
    Write-Host ""
    Write-Host "Default commit message: $defaultMsg" -ForegroundColor Cyan
    $customMsg = Read-Host "Press Enter to accept, or type a custom message"
    $msg = if ($customMsg) { $customMsg } else { $defaultMsg }

    # ---- Commit version files ----
    Step "git add + commit"
    & git add package.json addon/manifest.json version.json addon/tiddlers/index.json
    & git commit -m $msg
    if ($LASTEXITCODE -ne 0) { throw "git commit failed (or nothing to commit?)" }

    # ---- Final confirmation before push ----
    Write-Host ""
    Write-Host "About to push:" -ForegroundColor Cyan
    Write-Host "  origin master              (publish $version on master)"
    Write-Host "  origin master:unlisted     (trigger sign-unlisted.yml)"
    if (-not (Confirm-Prompt "Proceed?")) {
        Write-Host ""
        Write-Host "Aborted before push. The commit stays local; push manually when ready:" -ForegroundColor Yellow
        Write-Host "  git push origin master"
        Write-Host "  git push origin master:unlisted"
        return
    }

    # ---- Push ----
    Step "git push origin master"
    & git push origin master
    if ($LASTEXITCODE -ne 0) { throw "push to master failed" }

    Step "git push origin master:unlisted"
    & git push origin master:unlisted
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Master pushed, but unlisted push failed. Retry manually:" -ForegroundColor Yellow
        Write-Host "  git push origin master:unlisted"
        throw "push to unlisted failed"
    }

    Write-Host ""
    Write-Host "Beta $version published. Watch CI:" -ForegroundColor Green
    Write-Host "  https://github.com/pmario/file-backups/actions"
} finally {
    Pop-Location
}
