<#
.SYNOPSIS
  Local convenience for signing the addon against AMO. Reads the AMO API
  key + secret from Windows SecretStore, hands them to web-ext via the
  WEB_EXT_API_KEY / WEB_EXT_API_SECRET env vars (in-process only — never
  in argv, never in shell history).

.PARAMETER Channel
  unlisted = beta channel; AMO auto-signs (no human review).
  listed   = stable channel; AMO human-reviews (hours to days).
             Adds --approval-timeout 0 so this script returns
             immediately after upload rather than blocking.

.EXAMPLE
  .\build-tools\sign.ps1 -Channel unlisted

.NOTES
  One-time setup (in PowerShell, BEFORE first run):

    Install-Module Microsoft.PowerShell.SecretManagement -Scope CurrentUser
    Install-Module Microsoft.PowerShell.SecretStore -Scope CurrentUser
    Register-SecretVault -Name FileBackupsVault `
        -ModuleName Microsoft.PowerShell.SecretStore -DefaultVault

    # Interactive prompts — values never appear in argv/history.
    Set-Secret -Name AMO_JWT_ISSUER `
        -Secret (Read-Host "AMO JWT issuer (user:NNN:NN)" -AsSecureString)
    Set-Secret -Name AMO_JWT_SECRET `
        -Secret (Read-Host "AMO JWT secret" -AsSecureString)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("unlisted", "listed")]
    [string]$Channel
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$webExt   = Join-Path $repoRoot "node_modules\.bin\web-ext.cmd"
$source   = Join-Path $repoRoot "addon"

if (-not (Test-Path $webExt)) {
    throw "web-ext not found at $webExt — run 'npm ci' from $repoRoot first."
}

# Stage first: bump-beta advances the local counter (so this sign gets a
# unique AMO version), copy-version syncs into manifest.json + version.json,
# index-tiddlers regenerates addon/tiddlers/index.json against the current
# .tid files. web-ext sign reads the manifest as-is, so without staging
# you'd ship a stale version + stale tiddler index.
#
# To sign a SPECIFIC committed version without bumping, set
# $env:CI = "true" before calling this script — bump-beta skips, the
# rest of stage stays idempotent.
Push-Location $repoRoot
try {
    Write-Host "→ npm run stage" -ForegroundColor Cyan
    & npm run stage
    if ($LASTEXITCODE -ne 0) { throw "npm run stage failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

# Pull credentials from SecretStore AFTER stage has succeeded — no point
# touching the vault if the build is broken. -AsPlainText decrypts
# in-memory only; the env vars below are scoped to this PowerShell process.
$env:WEB_EXT_API_KEY    = Get-Secret -Name AMO_JWT_ISSUER -AsPlainText
$env:WEB_EXT_API_SECRET = Get-Secret -Name AMO_JWT_SECRET -AsPlainText

$webExtArgs = @(
    "sign",
    "--source-dir", $source,
    "--channel", $Channel
)

# Listed channel goes through AMO human review (hours to days). Without
# this flag, web-ext blocks until review clears. With it, web-ext returns
# as soon as the upload succeeds — same as the GitHub Actions workflow.
if ($Channel -eq "listed") {
    $webExtArgs += @("--approval-timeout", "0")
}

Write-Host "→ $webExt $($webExtArgs -join ' ')" -ForegroundColor Cyan
& $webExt @webExtArgs

if ($LASTEXITCODE -ne 0) {
    throw "web-ext sign exited with code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Signed artifact:" -ForegroundColor Green
Get-ChildItem (Join-Path $source "web-ext-artifacts") -Filter "*.xpi" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 |
    ForEach-Object { Write-Host "  $($_.FullName)" }
