<#
.SYNOPSIS
  Runs every automated check VetiFlow has, in order, and stops at the first failure.

.DESCRIPTION
  This is the one Verify command. You, Claude and CI run the same script, so
  "it passed" means the same thing everywhere.

  Each step's full output goes to .verify/logs/<step>.log. The console shows one
  line per step and the summary, plus the end of the log when a step fails.
  Every run writes .verify/evidence.json (result, mode, steps, file fingerprint);
  see scripts/verify-evidence.ps1.

  -ReuseIfCurrent skips the run when the last one was a full PASS and no file has
  changed since (workflow bookkeeping aside); otherwise it says why and runs in full.

  Server tests need Docker running (Testcontainers) or VETIFLOW_TEST_POSTGRES
  pointing at an existing Postgres server.

.EXAMPLE
  pwsh -File scripts/verify.ps1
  pwsh -File scripts/verify.ps1 -ServerOnly
  pwsh -File scripts/verify.ps1 -ClientOnly
  pwsh -File scripts/verify.ps1 -ReuseIfCurrent
#>
param(
	[switch]$ServerOnly,
	[switch]$ClientOnly,
	[switch]$ReuseIfCurrent
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'verify-evidence.ps1')

$evidencePath = Join-Path $repoRoot '.verify/evidence.json'
$logFolder = Join-Path $repoRoot '.verify/logs'
$steps = [System.Collections.Generic.List[object]]::new()

if ($ServerOnly -and $ClientOnly) {
	Write-Host 'Use -ServerOnly or -ClientOnly, not both.'
	exit 1
}
$mode = if ($ServerOnly) { 'server' } elseif ($ClientOnly) { 'client' } else { 'full' }

if ($ReuseIfCurrent) {
	if ($mode -ne 'full') {
		Write-Host '-ReuseIfCurrent reuses or runs a full Verify; it cannot be combined with -ServerOnly or -ClientOnly.'
		exit 1
	}
	$check = Test-VerifyEvidence -Path $evidencePath -Fingerprint (Get-VerifyFingerprint -RepoRoot $repoRoot)
	if ($check.Reusable) {
		$evidence = $check.Evidence
		Write-Host "Reusing Verify PASS from $($evidence.finishedAt) ($($evidence.branch) @ $("$($evidence.head)".Substring(0, 7)))"
		Write-Host ''
		Write-Host 'Verify summary (reused)'
		foreach ($step in $evidence.steps) { Write-Host "  $($step.result)  $($step.name)" }
		exit 0
	}
	Write-Host "Not reusing the last Verify: $($check.Reason). Running it in full."
}

# An interrupted run must leave no evidence behind. The fingerprint is taken
# before any step, so a file edited during the run makes the evidence stale.
Remove-VerifyEvidence -Path $evidencePath
$fingerprint = Get-VerifyFingerprint -RepoRoot $repoRoot
if (Test-Path $logFolder) { Remove-Item (Join-Path $logFolder '*.log') -Force }
else { New-Item -ItemType Directory $logFolder | Out-Null }

function Complete-Verify([string]$Result) {
	Write-VerifyEvidence -Path $evidencePath -RepoRoot $repoRoot -Result $Result -Mode $mode -Steps $steps -Fingerprint $fingerprint
	Write-Host ''
	Write-Host 'Verify summary'
	foreach ($step in $steps) { Write-Host "  $($step.result)  $($step.name)$($step.note)" }
}

function Stop-Verify([string]$Name, [string]$Note) {
	$steps.Add([ordered]@{ name = $Name; result = 'FAIL'; note = " ($Note)" })
	Complete-Verify 'FAIL'
	exit 1
}

# $OnFailure runs only when the step fails, to print a hint about the likely cause.
function Invoke-Step([string]$Name, [scriptblock]$Command, [scriptblock]$OnFailure) {
	Write-Host "==> $Name" -ForegroundColor Cyan
	$logPath = Join-Path $logFolder (($Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-') + '.log')
	$exitCode = Invoke-VerifyCommand -Command $Command -LogPath $logPath
	if ($exitCode -ne 0) {
		$relativeLog = $logPath.Substring($repoRoot.Length + 1).Replace('\', '/')
		Write-Host ''
		Write-Host "Last 60 lines of $relativeLog" -ForegroundColor Yellow
		Get-Content $logPath -Tail 60 | ForEach-Object { Write-Host $_ }
		if ($OnFailure) { & $OnFailure }
		Stop-Verify $Name "exit code $exitCode, full output in $relativeLog"
	}
	$steps.Add([ordered]@{ name = $Name; result = 'PASS'; note = '' })
}

# UTF-8 for the run, so test output with non-ASCII characters logs correctly.
$consoleEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
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
		# The exit code is the only signal: Docker may warn on stderr while running.
		if (-not $env:VETIFLOW_TEST_POSTGRES) {
			$global:LASTEXITCODE = 1
			try {
				$ErrorActionPreference = 'Continue'
				docker info --format '{{.ServerVersion}}' *> $null
			}
			catch {
				$global:LASTEXITCODE = 1
			}
			finally {
				$ErrorActionPreference = 'Stop'
			}
			if ($global:LASTEXITCODE -ne 0) {
				Stop-Verify 'Docker' 'not running: start Docker Desktop or set VETIFLOW_TEST_POSTGRES'
			}
		}

		# Building the test project also builds the server. The solution includes the
		# client .esproj, which the dotnet CLI cannot always build.
		Invoke-Step 'Server build' { dotnet build vetiflow.Server.Tests/vetiflow.Server.Tests.csproj } {
			if (Get-Process vetiflow.Server -ErrorAction SilentlyContinue) {
				Write-Host 'vetiflow.Server is running and locks its exe (MSB3027). Stop it, then rerun.' -ForegroundColor Yellow
			}
		}
		# Includes MigrationTests, which fail when the model has changes no migration captures.
		Invoke-Step 'Server tests' { dotnet test --project vetiflow.Server.Tests --no-build }
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
	[Console]::OutputEncoding = $consoleEncoding
}

Complete-Verify 'PASS'
exit 0
