<#
.SYNOPSIS
  Runs the automated checks the branch's changes need, in order, and stops at the
  first failure.

.DESCRIPTION
  This is the one Verify command. You, Claude and CI run the same script, so
  "it passed" means the same thing everywhere.

  With no option it works out the scope from the files changed since the branch
  left main (see scripts/verify-scope.ps1): workflow tests always run, the server
  steps for server or full, the client steps for client or full. -Full runs
  everything; -ServerOnly and -ClientOnly (used by CI) run one side.

  Each step's full output goes to .verify/logs/<step>.log. The console shows one
  line per step and the summary, plus the end of the log when a step fails.
  Every run writes .verify/evidence.json (result, mode, complete step plan,
  branch, commit and file fingerprint); it records PASS only if repository
  state is unchanged from the start. See scripts/verify-evidence.ps1.

  -ReuseIfCurrent skips the run when the last one was a PASS that covers the scope
  needed now and no file has changed since (workflow bookkeeping aside);
  otherwise it says why and runs that scope.

  Server tests need Docker running (Testcontainers) or VETIFLOW_TEST_POSTGRES
  pointing at an existing Postgres server.

.EXAMPLE
  pwsh -File scripts/verify.ps1
  pwsh -File scripts/verify.ps1 -Full
  pwsh -File scripts/verify.ps1 -ServerOnly
  pwsh -File scripts/verify.ps1 -ClientOnly
  pwsh -File scripts/verify.ps1 -ReuseIfCurrent
#>
param(
	[switch]$Full,
	[switch]$ServerOnly,
	[switch]$ClientOnly,
	[switch]$ReuseIfCurrent
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'verify-evidence.ps1')
. (Join-Path $PSScriptRoot 'verify-scope.ps1')

$evidencePath = Join-Path $repoRoot '.verify/evidence.json'
$logFolder = Join-Path $repoRoot '.verify/logs'
$steps = [System.Collections.Generic.List[object]]::new()

if (@($Full, $ServerOnly, $ClientOnly | Where-Object { $_ }).Count -gt 1) {
	Write-Host 'Use only one of -Full, -ServerOnly and -ClientOnly.'
	exit 1
}
if ($ReuseIfCurrent -and ($ServerOnly -or $ClientOnly)) {
	Write-Host '-ReuseIfCurrent cannot be combined with -ServerOnly or -ClientOnly.'
	exit 1
}
$groups = @()
if ($ServerOnly) { $mode = 'server'; $scopeReason = '-ServerOnly' }
elseif ($ClientOnly) { $mode = 'client'; $scopeReason = '-ClientOnly' }
elseif ($Full) { $mode = 'full'; $scopeReason = '-Full' }
else {
	$scope = Get-VerifyScope -RepoRoot $repoRoot
	$mode = $scope.Scope
	$scopeReason = $scope.Reason
	$groups = $scope.Groups
}
$runsServer = $mode -in 'full', 'server'
$runsClient = $mode -in 'full', 'client'

if ($ReuseIfCurrent) {
	$check = Test-VerifyEvidence -Path $evidencePath -Fingerprint (Get-VerifyFingerprint -RepoRoot $repoRoot) -Scope $mode -RepoRoot $repoRoot
	if ($check.Reusable) {
		$evidence = $check.Evidence
		Write-Host "Reusing Verify PASS from $($evidence.finishedAt) ($($evidence.branch) @ $("$($evidence.head)".Substring(0, 7)), scope $($evidence.mode))"
		Write-Host ''
		Write-Host 'Verify summary (reused)'
		foreach ($step in $evidence.steps) {
			$note = if ($step.note) { " ($($step.note))" } else { '' }
			Write-Host "  $($step.result)  $($step.name)$note"
		}
		exit 0
	}
	Write-Host "Not reusing the last Verify: $($check.Reason). Running scope $mode."
}
Write-Host "Scope: $mode ($scopeReason)"

# An interrupted run must leave no evidence behind. The fingerprint is taken
# before any step, so a file edited during the run makes the evidence stale.
Remove-VerifyEvidence -Path $evidencePath
$startIdentity = Get-VerifyIdentity -RepoRoot $repoRoot
$fingerprint = Get-VerifyFingerprint -RepoRoot $repoRoot
if (Test-Path $logFolder) { Remove-Item (Join-Path $logFolder '*.log') -Force }
else { New-Item -ItemType Directory $logFolder | Out-Null }

function Complete-Verify([string]$Result) {
	Write-VerifyEvidence -Path $evidencePath -RepoRoot $repoRoot -Result $Result -Mode $mode -Steps $steps -Fingerprint $fingerprint -Groups $groups -Branch $startIdentity.Branch -Head $startIdentity.Head
	$written = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json
	if ($written.stateError) { Write-Host "Verify could not record a reusable PASS: $($written.stateError)" -ForegroundColor Yellow }
	Write-Host ''
	Write-Host "Verify summary (scope $mode)"
	foreach ($step in $steps) {
		$note = if ($step.note) { " ($($step.note))" } else { '' }
		Write-Host "  $($step.result)  $($step.name)$note"
	}
	if ($written.stateError) { Write-Host "  FAIL  Repository state ($($written.stateError))" }
	# Left out by the scope, so not a SKIP: nothing they check has changed.
	if (-not $runsServer) { Write-Host '  Not needed: server steps (no server files changed)' }
	if (-not $runsClient) { Write-Host '  Not needed: client steps (no client files changed)' }
	$written.result
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

	if ($runsServer) {
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
			$steps.Add([ordered]@{ name = 'Docker'; result = 'PASS'; note = '' })
		}
		else {
			$steps.Add([ordered]@{ name = 'Docker'; result = 'NOT_APPLICABLE'; note = 'VETIFLOW_TEST_POSTGRES is set' })
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

	if ($runsClient) {
		Push-Location vetiflow.client
		try {
			# npm writes node_modules/.package-lock.json on install. If package-lock.json
			# is newer (a pull or branch switch changed it), the installed packages are stale.
			$installed = 'node_modules/.package-lock.json'
			if (-not (Test-Path $installed) -or
				(Get-Item package-lock.json).LastWriteTimeUtc -gt (Get-Item $installed).LastWriteTimeUtc) {
				Invoke-Step 'Client install' { npm ci }
			}
			else {
				$steps.Add([ordered]@{ name = 'Client install'; result = 'NOT_APPLICABLE'; note = 'installed lockfile is current' })
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

$result = Complete-Verify 'PASS'
if ($result -ne 'PASS') { exit 1 }
exit 0
