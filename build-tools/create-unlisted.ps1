<#
.SYNOPSIS
  Interactive workflow for publishing a beta to AMO unlisted via CI.

  Pre-flight checks:
    - We're on master.
    - Working tree is clean.
    - Local master is in sync with <Remote>/master (Remote auto-detected
      as 'origin' or 'upstream', overridable via -Remote).
    - Lists local branches NOT merged into master so you can spot
      anything you forgot to bring across.

  Confirmation prompts:
    - "Have you tested everything in master and are sure it works?"
    - "Are all open patches you want shipped already merged?"

  Then:
    npm run stage           (bumps the LAST version segment — 3-seg stable
                             0.9.0 → 0.9.1, 4-seg beta 0.9.0.1 → 0.9.0.2;
                             syncs manifest + docs/version.json; regenerates
                             tiddlers/index.json)
    web-ext lint            (run directly via node_modules\.bin\web-ext.cmd,
                             NOT via `npm run lint` — the npm script would
                             trigger prelint=stage and bump a second time)
    git commit              (commits package.json, addon/manifest.json,
                             docs/version.json, addon/tiddlers/index.json with
                             default message "release: <version> (beta)" or
                             your override)
    git push <Remote> master              (publish the bump on master)
    git push <Remote> master:unlisted     (triggers sign-unlisted.yml)

  Aborts early on any failed check or any "no" answer. If lint fails
  AFTER stage has bumped the version, the script tells you the exact
  command to revert the bump.

.PARAMETER DryRun
  Run only:
    - the pre-flight READ checks (branch, clean tree, sync with the
      remote, unmerged-branch listing),
    - the user-confirmation prompts, and
    - `web-ext lint` against the current addon/ — read-only, catches
      issues like an invalid `manifest_version` before a real publish.
  Then print what the real publish WOULD do (stage bump preview,
  commit message, pushes) without executing any of it.
  No file mutations, no commits, no pushes, no `git checkout --`
  cleanup. If lint fails, the dry run aborts.

.PARAMETER Remote
  Name of the git remote to fetch from / push to. Defaults to "origin"
  if it exists, else falls back to "upstream". Override if your local
  setup uses a different name.

.NOTES
  Invoke via `npm run create-unlisted`, or directly:
    .\build-tools\create-unlisted.ps1
    .\build-tools\create-unlisted.ps1 -DryRun
    .\build-tools\create-unlisted.ps1 -Remote upstream

  Requires PowerShell 7 (pwsh) or Windows PowerShell 5.1+, plus git
  and npm on PATH.
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [string]$Remote
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

    # ---- Resolve which git remote to use ----
    # The maintainer's local checkout might use 'origin' or 'upstream'
    # (e.g. when cloned as a fork). Auto-detect, with -Remote as override.
    if (-not $Remote) {
        $remoteList = & git remote
        if ($remoteList -contains "origin")        { $Remote = "origin" }
        elseif ($remoteList -contains "upstream")  { $Remote = "upstream" }
        else {
            throw "No 'origin' or 'upstream' remote configured. Pass -Remote <name>."
        }
    }
    Write-Host "Using remote: $Remote" -ForegroundColor DarkGray

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

    # ---- Pre-flight: sync with <Remote>/master ----
    Step "git fetch $Remote master"
    & git fetch $Remote master
    if ($LASTEXITCODE -ne 0) { throw "git fetch $Remote master failed" }
    $local      = (& git rev-parse master).Trim()
    $remoteRef  = "$Remote/master"
    $remoteHead = (& git rev-parse $remoteRef 2>$null)
    if ($null -ne $remoteHead -and $remoteHead -ne "") {
        $remoteHead = $remoteHead.Trim()
        if ($local -ne $remoteHead) {
            $base = (& git merge-base master $remoteRef).Trim()
            if ($base -ne $remoteHead) {
                Write-Host "Local master diverges from ${remoteRef}." -ForegroundColor Red
                Write-Host "  local:  $local"
                Write-Host "  remote: $remoteHead"
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

    # ---- Read current version (used by both real run and dry run) ----
    $pkg = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
    $currentVersion = $pkg.version

    if ($DryRun) {
        # Predict what bump-beta would produce, without invoking it: take
        # the last segment of the current version and increment it.
        $segments = $currentVersion -split '\.'
        if ($segments.Length -ge 1 -and $segments[-1] -match '^\d+$') {
            $segments[-1] = ([int]$segments[-1] + 1).ToString()
            $bumpedVersion = $segments -join '.'
        } else {
            $bumpedVersion = "$currentVersion (bump skipped — last segment not numeric)"
        }

        # Run lint against the CURRENT addon/. This catches manifest /
        # JS / web-accessible-resource issues before a real publish,
        # without mutating anything (stage stays skipped).
        Step "web-ext lint (against current addon/)"
        $webExt = Join-Path $repoRoot "node_modules\.bin\web-ext.cmd"
        Push-Location (Join-Path $repoRoot "addon")
        try {
            & $webExt lint
            $lintExit = $LASTEXITCODE
        } finally {
            Pop-Location
        }
        if ($lintExit -ne 0) {
            Write-Host ""
            Write-Host "Lint failed against the current addon/." -ForegroundColor Red
            Write-Host "Fix the reported issues before running the real publish." -ForegroundColor Yellow
            throw "web-ext lint failed (exit $lintExit)"
        }

        Write-Host ""
        Write-Host "Dry run — would execute (in order):" -ForegroundColor Green
        Write-Host "  1. npm run stage    (bump $currentVersion → $bumpedVersion, sync manifest + docs/version.json, regenerate index.json)"
        Write-Host "  2. web-ext lint     (run directly, not via 'npm run lint' — that would re-trigger stage)"
        Write-Host "  3. git commit       message: ""release: $bumpedVersion (beta)""  (overridable at the prompt)"
        Write-Host "  4. git push $Remote master"
        Write-Host "  5. git push $Remote master:unlisted    (triggers sign-unlisted.yml)"
        Write-Host ""
        Write-Host "Lint passed against the current addon/. No files modified." -ForegroundColor DarkGray
        return
    }

    # ---- Stage (real run only) ----
    Step "npm run stage"
    & npm run stage
    if ($LASTEXITCODE -ne 0) { throw "stage failed (exit $LASTEXITCODE)" }

    # ---- Lint (real run only) ----
    # Invoke web-ext directly, NOT `npm run lint`. The npm script's
    # prelint hook would re-run stage (bumping the version a second
    # time on each create-unlisted run); we already staged above, so
    # going direct keeps the bump count at one per invocation.
    Step "web-ext lint"
    $webExt = Join-Path $repoRoot "node_modules\.bin\web-ext.cmd"
    Push-Location (Join-Path $repoRoot "addon")
    try {
        & $webExt lint
        $lintExit = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($lintExit -ne 0) {
        Write-Host ""
        Write-Host "Lint failed. Version files were bumped during stage." -ForegroundColor Red
        Write-Host "If you want to abort and revert the bump, run:" -ForegroundColor Yellow
        Write-Host "  git checkout -- package.json addon/manifest.json docs/version.json addon/tiddlers/index.json"
        throw "web-ext lint failed (exit $lintExit)"
    }

    # ---- Re-read the new version after stage bumped it ----
    $pkg = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
    $version = $pkg.version

    # ---- Commit message ----
    $defaultMsg = "release: $version (beta)"
    Write-Host ""
    Write-Host "Default commit message: $defaultMsg" -ForegroundColor Cyan
    $customMsg = Read-Host "Press Enter to accept, or type a custom message"
    $msg = if ($customMsg) { $customMsg } else { $defaultMsg }

    # ---- Commit version files ----
    Step "git add + commit"
    & git add package.json addon/manifest.json docs/version.json addon/tiddlers/index.json
    & git commit -m $msg
    if ($LASTEXITCODE -ne 0) { throw "git commit failed (or nothing to commit?)" }

    # ---- Final confirmation before push ----
    Write-Host ""
    Write-Host "About to push:" -ForegroundColor Cyan
    Write-Host "  $Remote master              (publish $version on master)"
    Write-Host "  $Remote master:unlisted     (trigger sign-unlisted.yml)"
    if (-not (Confirm-Prompt "Proceed?")) {
        Write-Host ""
        Write-Host "Aborted before push. The commit stays local; push manually when ready:" -ForegroundColor Yellow
        Write-Host "  git push $Remote master"
        Write-Host "  git push $Remote master:unlisted"
        return
    }

    # ---- Push ----
    Step "git push $Remote master"
    & git push $Remote master
    if ($LASTEXITCODE -ne 0) { throw "push to master failed" }

    Step "git push $Remote master:unlisted"
    & git push $Remote master:unlisted
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Master pushed, but unlisted push failed. Retry manually:" -ForegroundColor Yellow
        Write-Host "  git push $Remote master:unlisted"
        throw "push to unlisted failed"
    }

    Write-Host ""
    Write-Host "Beta $version published. Watch CI:" -ForegroundColor Green
    Write-Host "  https://github.com/pmario/file-backups/actions"
} finally {
    Pop-Location
}
