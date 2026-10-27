<#
.SYNOPSIS
  Regression checks that secrets stay out of the repository: no tracked
  appsettings file holds a connection string or password, the client uses only
  known public VITE_ variables, and no env file is tracked except .env.example.

.DESCRIPTION
  Plain PowerShell, no test framework. Reads tracked files only (git ls-files)
  and checks env files by path, never by contents. Prints rule names and file
  paths, never a value. The negative cases use inline fixtures.
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$failures = [System.Collections.Generic.List[string]]::new()
$checkCount = 0

function Assert-True([bool]$Condition, [string]$Name) {
	$script:checkCount++
	if (-not $Condition) { $failures.Add($Name) }
}

# VITE_ variables are compiled into the public client bundle, so each one must
# be safe to show anyone. Add a name here only when it is.
$allowedViteVariables = @('VITE_API_BASE_URL')

# Names of the secret settings found in one appsettings JSON document.
function Get-SecretSettings([string]$Json) {
	$found = [System.Collections.Generic.List[string]]::new()

	function Search($Node, [string]$Path) {
		if ($Node -is [System.Management.Automation.PSCustomObject]) {
			foreach ($property in $Node.PSObject.Properties) {
				$propertyPath = if ($Path) { "$Path.$($property.Name)" } else { $property.Name }
				if ($property.Name -ieq 'ConnectionStrings') { $found.Add($propertyPath) }
				Search $property.Value $propertyPath
			}
		}
		elseif ($Node -is [System.Array]) {
			foreach ($item in $Node) { Search $item $Path }
		}
		elseif ($Node -is [string] -and $Node -match '(?i)password\s*=') {
			$found.Add($Path)
		}
	}

	Search ($Json | ConvertFrom-Json) ''
	@($found)
}

# VITE_ names in the given text that are not on the allowlist.
function Get-UnknownViteVariables([string]$Text) {
	@([regex]::Matches($Text, '\bVITE_[A-Z0-9_]+') |
		ForEach-Object { $_.Value } |
		Where-Object { $allowedViteVariables -notcontains $_ } |
		Sort-Object -Unique)
}

# Tracked paths that are env files, other than the shareable .env.example.
function Get-TrackedEnvFiles([string[]]$Paths) {
	@($Paths | Where-Object { $_ -match '(^|/)\.env($|\.)' -and $_ -notmatch '(^|/)\.env\.example$' })
}

$trackedFiles = @(git -C $repoRoot ls-files)
Assert-True ($trackedFiles.Count -gt 0) 'git lists the tracked files'

$settingsFiles = @($trackedFiles | Where-Object { $_ -match '(^|/)appsettings[^/]*\.json$' })
Assert-True ($settingsFiles.Count -gt 0) 'appsettings files are found'
foreach ($settingsFile in $settingsFiles) {
	$secrets = Get-SecretSettings (Get-Content -Raw -LiteralPath (Join-Path $repoRoot $settingsFile))
	Assert-True ($secrets.Count -eq 0) "${settingsFile}: no connection string or password"
}

# A tracked file deleted in the working tree (not yet committed) has nothing to scan.
$clientFiles = @($trackedFiles | Where-Object {
	$_ -like 'vetiflow.client/*' -and (Get-TrackedEnvFiles @($_)).Count -eq 0 -and
		(Test-Path -LiteralPath (Join-Path $repoRoot $_))
})
Assert-True ($clientFiles.Count -gt 0) 'client files are found'
$unknownVite = @(foreach ($clientFile in $clientFiles) {
	foreach ($name in Get-UnknownViteVariables (Get-Content -Raw -LiteralPath (Join-Path $repoRoot $clientFile))) {
		"$clientFile ($name)"
	}
})
Assert-True ($unknownVite.Count -eq 0) "the client uses only allowed VITE_ variables$(if ($unknownVite) { ': ' + ($unknownVite -join ', ') })"

Assert-True ((Get-TrackedEnvFiles $trackedFiles).Count -eq 0) 'no env file is tracked except .env.example'

# The checks must catch what they guard against.
Assert-True ((Get-SecretSettings '{ "ConnectionStrings": { "VetiFlowDatabase": "Host=db" } }').Count -eq 1) 'a ConnectionStrings section is caught'
Assert-True ((Get-SecretSettings '{ "connectionStrings": {} }').Count -eq 1) 'a ConnectionStrings section in another case is caught'
Assert-True ((Get-SecretSettings '{ "Database": { "Url": "Host=db;Password=fixture" } }').Count -eq 1) 'a Password= value is caught'
Assert-True ((Get-SecretSettings '{ "Cors": { "AllowedOrigins": [ "https://example.test" ] } }').Count -eq 0) 'settings without secrets pass'
Assert-True ((Get-UnknownViteVariables 'const key = import.meta.env.VITE_STRIPE_SECRET;').Count -eq 1) 'an unknown VITE_ variable is caught'
Assert-True ((Get-UnknownViteVariables 'const url = import.meta.env.VITE_API_BASE_URL;').Count -eq 0) 'an allowed VITE_ variable passes'
Assert-True ((Get-TrackedEnvFiles @('vetiflow.client/.env.local')).Count -eq 1) 'a tracked .env.local is caught'
Assert-True ((Get-TrackedEnvFiles @('.env')).Count -eq 1) 'a tracked .env is caught'
Assert-True ((Get-TrackedEnvFiles @('vetiflow.client/.env.example', 'src/environment.ts')).Count -eq 0) '.env.example and similar names pass'

# --- Result --------------------------------------------------------------------

if ($failures.Count -gt 0) {
	Write-Host "Secrets config: $($failures.Count) of $checkCount checks failed"
	foreach ($name in $failures) { Write-Host "  FAIL  $name" }
	exit 1
}
Write-Host "Secrets config: all $checkCount checks passed"
exit 0
