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

function Stop-Verify([string]$Line) {
	$results.Add($Line)
	Write-Summary
	exit 1
}

# $OnFailure runs only when the step fails, to print a hint about the likely cause.
function Invoke-Step([string]$Name, [scriptblock]$Command, [scriptblock]$OnFailure) {
	Write-Host ''
	Write-Host "==> $Name" -ForegroundColor Cyan
	& $Command
	$exitCode = $LASTEXITCODE
	if ($exitCode -ne 0) {
		if ($OnFailure) { & $OnFailure }
		Stop-Verify "FAIL  $Name (exit code $exitCode)"
	}
	$results.Add("PASS  $Name")
}

Push-Location $repoRoot
try {
	# Checks for the workflow's own guardrails. Fast, so they run in every mode, and
	# in the same PowerShell that runs Verify (5.1 or pwsh).
	$powershellExe = (Get-Process -Id $PID).Path
	Invoke-Step 'Workflow tests' {
		foreach ($testFile in Get-ChildItem scripts/tests/*.tests.ps1) {
			& $powershellExe -NoProfile -ExecutionPolicy Bypass -File $testFile.FullName
			if ($LASTEXITCODE -ne 0) { return }
		}
	}

	if (-not $ClientOnly) {
		# Testcontainers needs Docker unless the tests use an existing Postgres server.
		# Checking first gives one clear line instead of a failure in every database test.
		# Windows PowerShell 5.1 throws on redirected native stderr, hence the try.
		if (-not $env:VETIFLOW_TEST_POSTGRES) {
			$dockerRunning = $false
			try {
				docker info *> $null
				$dockerRunning = ($LASTEXITCODE -eq 0)
			}
			catch {
				$dockerRunning = $false
			}
			if (-not $dockerRunning) {
				Stop-Verify 'FAIL  Docker (not running: start Docker Desktop or set VETIFLOW_TEST_POSTGRES)'
			}
		}

		# Building the test project also builds the server. The solution includes the
		# client .esproj, which the dotnet CLI cannot always build.
		Invoke-Step 'Server build' { dotnet build vetiflow.Server.Tests/vetiflow.Server.Tests.csproj } {
			if (Get-Process vetiflow.Server -ErrorAction SilentlyContinue) {
				Write-Host 'vetiflow.Server is running and locks its exe (MSB3027). Stop it, then rerun.' -ForegroundColor Yellow
			}
		}
		Invoke-Step 'Server tests' { dotnet test --project vetiflow.Server.Tests --no-build }

		# dotnet-ef is pinned in .config/dotnet-tools.json, so the migration check
		# always runs with the same version and never depends on a global install.
		Invoke-Step 'Tool restore' { dotnet tool restore }
		Invoke-Step 'No pending model changes' { dotnet ef migrations has-pending-model-changes --project vetiflow.Server }
	}

	if (-not $ServerOnly) {
		Push-Location vetiflow.client
		try {
			# npm writes node_modules/.package-lock.json on install. If package-lock.json
			# is newer (a pull or branch switch changed it), the installed packages are stale.
			$installed = 'node_modules/.package-lock.json'
			if (-not (Test-Path $installed) -or
				(Get-Item package-lock.json).LastWriteTimeUtc -gt (Get-Item $installed).LastWriteTimeUtc) {
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
