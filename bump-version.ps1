$currentDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition

$output = . "GitVersion"
$joined = $output -join "`n"
$versionInfo = $joined | ConvertFrom-Json

$manifest = (Get-Content "$currentDir\addon\manifest.JSON)" -join "`n" | ConvertFrom-Json
$manifest.version = $versionInfo.SemVer

mkdir -f "$currentDir\Artifacts"

$manifest | ConvertTo-Json | Out-File -encoding ASCII "$currentDir\Artifacts\manifest.json"
