<#
.SYNOPSIS
  Runs every automated check VetiFlow has, in order, and stops at the first failure.

.DESCRIPTION
  This is the one Verify command. You, Claude and CI run the same script, so
  "it passed" means the same thing everywhere.

  Server tests need Docker running (Testcontainers) or VETIFLOW_TEST_POSTGRES
  pointing at an existing Postgres server.

.EXAMPLE
  pwsh -File scripts/verify.ps1
  pwsh -File scripts/verify.ps1 -ServerOnly
  pwsh -File scripts/verify.ps1 -ClientOnly
#>
param(
	[switch]$ServerOnly,
	[switch]$ClientOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$results = [System.Collections.Generic.List[string]]::new()

function Write-Summary {
	Write-Host ''
	Write-Host 'Verify summary'
	foreach ($line in $results) { Write-Host "  $line" }
}

function Invoke-Step([string]$Name, [scriptblock]$Command) {
	Write-Host ''
	Write-Host "==> $Name" -ForegroundColor Cyan
	& $Command
	if ($LASTEXITCODE -ne 0) {
		$results.Add("FAIL  $Name (exit code $LASTEXITCODE)")
		Write-Summary
		exit 1
	}
	$results.Add("PASS  $Name")
}

Push-Location $repoRoot
try {
	if (-not $ClientOnly) {
		# Building the test project also builds the server. The solution includes the
		# client .esproj, which the dotnet CLI cannot always build.
		Invoke-Step 'Server build' { dotnet build vetiflow.Server.Tests/vetiflow.Server.Tests.csproj }
		Invoke-Step 'Server tests' { dotnet test --project vetiflow.Server.Tests --no-build }

		# Windows PowerShell 5.1 throws on redirected native stderr, hence the try.
		$hasEfTool = $false
		try {
			dotnet ef --version *> $null
			$hasEfTool = ($LASTEXITCODE -eq 0)
		}
		catch {
			$hasEfTool = $false
		}
		if ($hasEfTool) {
			Invoke-Step 'No pending model changes' { dotnet ef migrations has-pending-model-changes --project vetiflow.Server }
		}
		else {
			$results.Add('SKIP  No pending model changes (install with: dotnet tool install --global dotnet-ef)')
		}
	}

	if (-not $ServerOnly) {
		Push-Location vetiflow.client
		try {
			if (-not (Test-Path node_modules)) {
				Invoke-Step 'Client install' { npm ci }
			}
			Invoke-Step 'Client lint' { npm run lint }
			Invoke-Step 'Client build' { npm run build }
			Invoke-Step 'Client tests' { npm run test -- --run }
		}
		finally {
			Pop-Location
		}
	}
}
finally {
	Pop-Location
}

Write-Summary
exit 0
