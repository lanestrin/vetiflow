<#
.SYNOPSIS
  Removes what new-fixture.ps1 created. Removes .claude/settings.local.json only
  when new-fixture.ps1 created it and it is unchanged since. Safe to run twice.
#>
param(
	# Only for the regression checks, which point this at their own TEMP folder.
	[string]$TempRoot = (Join-Path ([System.IO.Path]::GetTempPath()) 'vetiflow-integration')
)

$ErrorActionPreference = 'Stop'
# This folder is scripts/tests/integration, three levels below the repo root.
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$fixtureDir = Join-Path $RepoRoot 'scripts/tests/fixtures'
$localSettings = Join-Path $RepoRoot '.claude/settings.local.json'
$marker = Join-Path $fixtureDir 'settings-local-created-by-fixture'

if ((Test-Path $marker) -and (Test-Path $localSettings)) {
	if ((Get-Content -Raw $localSettings) -eq (Get-Content -Raw $marker)) {
		Remove-Item $localSettings
	}
	else {
		Write-Output 'settings.local.json changed since the fixture created it: left in place.'
	}
}
foreach ($path in $fixtureDir, $TempRoot) {
	if (Test-Path $path) { Remove-Item -Recurse -Force $path }
}
Write-Output 'Fixtures removed.'
