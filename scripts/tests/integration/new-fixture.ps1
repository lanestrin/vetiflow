<#
.SYNOPSIS
  Creates harmless fixtures for checking the secret guardrails through Claude
  Code's real permission engine (the /check steps in the secret-guardrails spec).

.DESCRIPTION
  Everything here stays harmless even if every deny rule and hook fails:

  - scripts/tests/fixtures/ gets two dotenv-style files with fake content only
    (FIXTURE_ONLY=not-a-secret): one the deny rules must block, and the
    .env.example name they must still allow.
  - A synthetic project in TEMP with a new random UserSecretsId. No secrets are
    ever stored for it, so listing its user secrets can only show nothing.
  - Only when .claude/settings.local.json doesn't exist: probe hooks that each
    fail in one way (missing script, missing executable, crash, timeout) with
    onFailure "block", scoped with "if" to harmless `echo onfailure-...`
    commands. An existing settings.local.json is never touched.

  Prints the paths to use. Run remove-fixture.ps1 afterwards. Safe to run twice.
#>
param(
	# Only for the regression checks, which point this at their own TEMP folder.
	[string]$TempRoot = (Join-Path ([System.IO.Path]::GetTempPath()) 'vetiflow-integration')
)

$ErrorActionPreference = 'Stop'
# This folder is scripts/tests/integration, three levels below the repo root.
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$fakeContent = "# Fake fixture for the secret guardrails. Not a secret.`nFIXTURE_ONLY=not-a-secret"

$fixtureDir = Join-Path $RepoRoot 'scripts/tests/fixtures'
New-Item -ItemType Directory -Force $fixtureDir | Out-Null
Set-Content -Path (Join-Path $fixtureDir ('.env' + '.fixture')) -Value $fakeContent
Set-Content -Path (Join-Path $fixtureDir ('.env' + '.example')) -Value $fakeContent

$projectDir = Join-Path $TempRoot 'synthetic-project'
New-Item -ItemType Directory -Force $projectDir | Out-Null
$projectFile = Join-Path $projectDir 'Synthetic.csproj'
if (-not (Test-Path $projectFile)) {
	$secretsId = "vetiflow-fixture-$([guid]::NewGuid())"
	Set-Content -Path $projectFile -Value "<Project Sdk=`"Microsoft.NET.Sdk`"><PropertyGroup><TargetFramework>net10.0</TargetFramework><UserSecretsId>$secretsId</UserSecretsId></PropertyGroup></Project>"
}

$localSettings = Join-Path $RepoRoot '.claude/settings.local.json'
$marker = Join-Path $fixtureDir 'settings-local-created-by-fixture'
if (-not (Test-Path $localSettings)) {
	$probes = @(
		@{ type = 'command'; if = 'Bash(echo onfailure-missing-script*)'; command = 'node'; args = @('${CLAUDE_PROJECT_DIR}/scripts/tests/fixtures/no-such-hook.mjs'); onFailure = 'block' },
		@{ type = 'command'; if = 'Bash(echo onfailure-missing-exe*)'; command = 'vetiflow-no-such-executable'; args = @(); onFailure = 'block' },
		@{ type = 'command'; if = 'Bash(echo onfailure-crash*)'; command = 'node'; args = @('-e', 'process.exit(1)'); onFailure = 'block' },
		@{ type = 'command'; if = 'Bash(echo onfailure-timeout*)'; command = 'node'; args = @('-e', 'setTimeout(() => {}, 5000)'); timeout = 1; onFailure = 'block' }
	)
	$settings = @{ hooks = @{ PreToolUse = @(@{ matcher = 'Bash'; hooks = $probes }) } }
	New-Item -ItemType Directory -Force (Split-Path -Parent $localSettings) | Out-Null
	$json = $settings | ConvertTo-Json -Depth 6
	Set-Content -Path $localSettings -Value $json
	Set-Content -Path $marker -Value $json
}
elseif (-not (Test-Path $marker)) {
	Write-Output 'settings.local.json already exists: probe hooks not added (it was left untouched).'
}

Write-Output "Fixture folder:    $fixtureDir"
Write-Output "Synthetic project: $projectFile"
Write-Output "Isolated env dump: env -i FIXTURE_ONLY=not-a-secret /usr/bin/printenv"
