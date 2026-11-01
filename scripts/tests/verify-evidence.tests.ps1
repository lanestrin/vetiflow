<#
.SYNOPSIS
  Regression checks for Verify's evidence: the file fingerprint and the rule that
  decides when an earlier run can be reused.

.DESCRIPTION
  Plain PowerShell, no test framework. Everything runs in a throwaway git repo in
  TEMP; the real repo's .verify/ folder is never read or written.
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$failures = [System.Collections.Generic.List[string]]::new()
$checkCount = 0

function Assert-True([bool]$Condition, [string]$Name) {
	$script:checkCount++
	if (-not $Condition) { $failures.Add($Name) }
}

$evidenceScript = Join-Path $repoRoot 'scripts/verify-evidence.ps1'
Assert-True (Test-Path $evidenceScript) 'verify-evidence script exists'

if (Test-Path $evidenceScript) {
	. $evidenceScript

	$fixtureRepo = Join-Path ([System.IO.Path]::GetTempPath()) "vetiflow-verify-evidence-$PID"
	if (Test-Path $fixtureRepo) { Remove-Item -Recurse -Force $fixtureRepo }
	New-Item -ItemType Directory $fixtureRepo | Out-Null

	function Set-FixtureFile([string]$RelativePath, [string]$Content) {
		$fullPath = Join-Path $fixtureRepo $RelativePath
		$folder = Split-Path -Parent $fullPath
		if (-not (Test-Path $folder)) { New-Item -ItemType Directory $folder | Out-Null }
		[System.IO.File]::WriteAllText($fullPath, $Content)
	}

	try {
		Set-FixtureFile '.gitignore' "ignored/`n.verify/`n"
		Set-FixtureFile 'src/app.ts' 'export const answer = 42;'
		Set-FixtureFile 'scripts/verify.ps1' 'exit 0'
		Set-FixtureFile 'blueprint/build-plan.md' '- [ ] 1.1'
		Set-FixtureFile 'blueprint/context/current-feature.md' '# Fix'
		Set-FixtureFile 'blueprint/context/findings.md' '_No findings._'
		Set-FixtureFile 'blueprint/context/coding-standards.md' '# Standards'
		Set-FixtureFile 'blueprint/history/fixes/old.md' '# Old fix'
		git -C $fixtureRepo init -q
		git -C $fixtureRepo -c core.autocrlf=false add -A
		git -C $fixtureRepo -c user.name=fixture -c user.email=fixture@example.invalid -c core.autocrlf=false commit -q -m fixture

		# --- Fingerprint ---------------------------------------------------------

		$baseline = Get-VerifyFingerprint -RepoRoot $fixtureRepo
		Assert-True ($baseline -match '^[0-9a-f]{64}$') 'fingerprint is a SHA-256 hex string'
		Assert-True ((Get-VerifyFingerprint -RepoRoot $fixtureRepo) -eq $baseline) 'fingerprint is stable'

		# Workflow bookkeeping that no Verify step reads.
		foreach ($path in 'blueprint/context/findings.md', 'blueprint/context/current-feature.md',
			'blueprint/history/fixes/old.md', 'blueprint/history/fixes/new.md', 'blueprint/build-plan.md') {
			Set-FixtureFile $path 'changed by the workflow'
			Assert-True ((Get-VerifyFingerprint -RepoRoot $fixtureRepo) -eq $baseline) "fingerprint ignores $path"
		}

		Set-FixtureFile 'ignored/output.log' 'build output'
		Assert-True ((Get-VerifyFingerprint -RepoRoot $fixtureRepo) -eq $baseline) 'fingerprint ignores git-ignored files'

		Set-FixtureFile '.verify/evidence.json' '{}'
		Assert-True ((Get-VerifyFingerprint -RepoRoot $fixtureRepo) -eq $baseline) 'fingerprint ignores the evidence file'

		$changes = @(
			@{ Name = 'a tracked file'; Change = { Set-FixtureFile 'src/app.ts' 'export const answer = 43;' } },
			@{ Name = 'the Verify script'; Change = { Set-FixtureFile 'scripts/verify.ps1' 'exit 1' } },
			@{ Name = 'other blueprint/context guidance'; Change = { Set-FixtureFile 'blueprint/context/coding-standards.md' '# Changed' } },
			@{ Name = 'a new untracked file'; Change = { Set-FixtureFile 'src/new.ts' 'export {};' } },
			@{ Name = 'a deleted tracked file'; Change = { Remove-Item (Join-Path $fixtureRepo 'src/app.ts') } }
		)
		foreach ($case in $changes) {
			$before = Get-VerifyFingerprint -RepoRoot $fixtureRepo
			& $case.Change
			Assert-True ((Get-VerifyFingerprint -RepoRoot $fixtureRepo) -ne $before) "fingerprint changes for $($case.Name)"
		}

		# --- Evidence and the reuse rule ----------------------------------------

		$evidencePath = Join-Path $fixtureRepo '.verify/evidence.json'
		$fingerprint = Get-VerifyFingerprint -RepoRoot $fixtureRepo
		$stepsByMode = @{
			workflow = @(
				[ordered]@{ name = 'Workflow tests'; result = 'PASS' }
			)
			server = @(
				[ordered]@{ name = 'Workflow tests'; result = 'PASS' },
				[ordered]@{ name = 'Docker'; result = 'PASS' },
				[ordered]@{ name = 'Server build'; result = 'PASS' },
				[ordered]@{ name = 'Server tests'; result = 'PASS' }
			)
			client = @(
				[ordered]@{ name = 'Workflow tests'; result = 'PASS' },
				[ordered]@{ name = 'Client install'; result = 'PASS' },
				[ordered]@{ name = 'Client lint'; result = 'PASS' },
				[ordered]@{ name = 'Client build'; result = 'PASS' },
				[ordered]@{ name = 'Client tests'; result = 'PASS' }
			)
			full = @(
				[ordered]@{ name = 'Workflow tests'; result = 'PASS' },
				[ordered]@{ name = 'Docker'; result = 'PASS' },
				[ordered]@{ name = 'Server build'; result = 'PASS' },
				[ordered]@{ name = 'Server tests'; result = 'PASS' },
				[ordered]@{ name = 'Client install'; result = 'PASS' },
				[ordered]@{ name = 'Client lint'; result = 'PASS' },
				[ordered]@{ name = 'Client build'; result = 'PASS' },
				[ordered]@{ name = 'Client tests'; result = 'PASS' }
			)
		}

		Remove-VerifyEvidence -Path $evidencePath
		Assert-True (-not (Test-Path $evidencePath)) 'Remove-VerifyEvidence deletes the file'
		Remove-VerifyEvidence -Path $evidencePath
		$check = Test-VerifyEvidence -Path $evidencePath -Fingerprint $fingerprint -Scope full
		Assert-True ((-not $check.Reusable) -and $check.Reason -eq 'no evidence') 'missing evidence is not reused'

		Set-FixtureFile '.verify/evidence.json' '{ not json'
		$check = Test-VerifyEvidence -Path $evidencePath -Fingerprint $fingerprint -Scope full
		Assert-True ((-not $check.Reusable) -and $check.Reason -eq 'evidence unreadable') 'unreadable evidence is not reused'

		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'full' -Steps $stepsByMode.full -Fingerprint $fingerprint
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope full
		Assert-True $check.Reusable 'a full PASS with a matching fingerprint is reused'
		Assert-True ($check.Evidence.branch -eq (git -C $fixtureRepo rev-parse --abbrev-ref HEAD)) 'evidence records the branch'
		Assert-True ($check.Evidence.head -eq (git -C $fixtureRepo rev-parse HEAD)) 'evidence records the commit'
		Assert-True (@($check.Evidence.steps).Count -eq 8) 'evidence records every step'
		Assert-True ([bool]$check.Evidence.finishedAt) 'evidence records when the run finished'

		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint ('0' * 64) -Scope full
		Assert-True ((-not $check.Reusable) -and $check.Reason -eq 'files changed since') 'a different fingerprint is not reused'

		$oneStep = @([ordered]@{ name = 'Workflow tests'; result = 'PASS' })
		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'full' -Steps $oneStep -Fingerprint $fingerprint
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope full
		Assert-True ((-not $check.Reusable) -and $check.Reason -eq 'a required step is missing') 'a single-step full PASS is rejected'

		$rejected = @(
			@{ Name = 'a failed run'; Result = 'FAIL'; Mode = 'full'; Steps = @([ordered]@{ name = 'Client lint'; result = 'FAIL' }); Reason = 'last run failed' },
			@{ Name = 'a server run when full is needed'; Result = 'PASS'; Mode = 'server'; Steps = $stepsByMode.server; Reason = 'last run was scope server, this needs full' },
			@{ Name = 'a client run when full is needed'; Result = 'PASS'; Mode = 'client'; Steps = $stepsByMode.client; Reason = 'last run was scope client, this needs full' },
			@{ Name = 'a run with an unknown mode'; Result = 'PASS'; Mode = 'partial'; Steps = $stepsByMode.workflow; Reason = 'last run had an unknown scope' },
			@{ Name = 'a failed step'; Result = 'PASS'; Mode = 'full'; Steps = @($stepsByMode.full | Where-Object { $_.name -ne 'Server tests' }) + [ordered]@{ name = 'Server tests'; result = 'FAIL' }; Reason = 'a step did not pass' },
			@{ Name = 'a skipped mandatory step'; Result = 'PASS'; Mode = 'full'; Steps = @($stepsByMode.full | Where-Object { $_.name -ne 'Client tests' }) + [ordered]@{ name = 'Client tests'; result = 'SKIP' }; Reason = 'a step did not pass' },
			@{ Name = 'a missing step'; Result = 'PASS'; Mode = 'full'; Steps = @($stepsByMode.full | Where-Object { $_.name -ne 'Server tests' }); Reason = 'a required step is missing' },
			@{ Name = 'a null step'; Result = 'PASS'; Mode = 'full'; Steps = @($stepsByMode.full) + $null; Reason = 'unknown step' },
			@{ Name = 'a duplicate step'; Result = 'PASS'; Mode = 'full'; Steps = @($stepsByMode.full) + [ordered]@{ name = 'Server tests'; result = 'PASS' }; Reason = 'duplicate steps' },
			@{ Name = 'an unknown step'; Result = 'PASS'; Mode = 'full'; Steps = @($stepsByMode.full) + [ordered]@{ name = 'Unrecognized step'; result = 'PASS' }; Reason = 'unknown step' },
			@{ Name = 'a run with no steps'; Result = 'PASS'; Mode = 'full'; Steps = @(); Reason = 'a required step is missing' }
		)
		foreach ($case in $rejected) {
			Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result $case.Result -Mode $case.Mode -Steps $case.Steps -Fingerprint $fingerprint
			$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope full
			Assert-True ((-not $check.Reusable) -and $check.Reason -eq $case.Reason) "$($case.Name) is not reused ('$($case.Reason)')"
		}

		# --- Conditional steps --------------------------------------------------

		$serverStepsWithPostgres = @($stepsByMode.server)
		$serverStepsWithPostgres[1] = [ordered]@{ name = 'Docker'; result = 'NOT_APPLICABLE'; note = 'VETIFLOW_TEST_POSTGRES is set' }
		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'server' -Steps $serverStepsWithPostgres -Fingerprint $fingerprint
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope server
		Assert-True $check.Reusable 'a server PASS records Docker as not applicable when using local Postgres'

		$clientStepsInstalled = @($stepsByMode.client)
		$clientStepsInstalled[1] = [ordered]@{ name = 'Client install'; result = 'NOT_APPLICABLE'; note = 'installed lockfile is current' }
		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'client' -Steps $clientStepsInstalled -Fingerprint $fingerprint
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope client
		Assert-True $check.Reusable 'a client PASS records install as not applicable when dependencies are current'

		$invalidConditional = @($stepsByMode.server)
		$invalidConditional[2] = [ordered]@{ name = 'Server build'; result = 'NOT_APPLICABLE' }
		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'server' -Steps $invalidConditional -Fingerprint $fingerprint
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope server
		Assert-True (-not $check.Reusable) 'a mandatory step cannot be not applicable'

		$invalidConditional = @($stepsByMode.server)
		$invalidConditional[1] = [ordered]@{ name = 'Docker'; result = 'NOT_APPLICABLE'; note = 'unspecified' }
		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'server' -Steps $invalidConditional -Fingerprint $fingerprint
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope server
		Assert-True (-not $check.Reusable) 'a conditional step requires its specific not-applicable reason'

		# --- Branch and commit identity ----------------------------------------

		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'full' -Steps $stepsByMode.full -Fingerprint $fingerprint
		$evidence = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json
		$evidence.branch = 'another-branch'
		[System.IO.File]::WriteAllText($evidencePath, (ConvertTo-Json -InputObject $evidence -Depth 5))
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope full
		Assert-True ((-not $check.Reusable) -and $check.Reason -eq 'branch changed since') 'evidence from another branch is not reused'

		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'full' -Steps $stepsByMode.full -Fingerprint $fingerprint
		$evidence = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json
		$evidence.head = '0' * 40
		[System.IO.File]::WriteAllText($evidencePath, (ConvertTo-Json -InputObject $evidence -Depth 5))
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope full
		Assert-True ((-not $check.Reusable) -and $check.Reason -eq 'commit changed since') 'evidence from another commit is not reused'

		# A PASS is reused only for the scopes its mode covers.
		$coverage = @(
			@{ Mode = 'full'; Reused = @('full', 'server', 'client', 'workflow'); NotReused = @(); Steps = $stepsByMode.full },
			@{ Mode = 'server'; Reused = @('server', 'workflow'); NotReused = @('client', 'full'); Steps = $stepsByMode.server },
			@{ Mode = 'client'; Reused = @('client', 'workflow'); NotReused = @('server', 'full'); Steps = $stepsByMode.client },
			@{ Mode = 'workflow'; Reused = @('workflow'); NotReused = @('server', 'client', 'full'); Steps = $stepsByMode.workflow }
		)
		foreach ($case in $coverage) {
			Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode $case.Mode -Steps $case.Steps -Fingerprint $fingerprint
			foreach ($scope in $case.Reused) {
				Assert-True (Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope $scope).Reusable "a $($case.Mode) PASS is reused when $scope is needed"
			}
			foreach ($scope in $case.NotReused) {
				Assert-True (-not (Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope $scope).Reusable) "a $($case.Mode) PASS is not reused when $scope is needed"
			}
			Assert-True (-not (Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint ('0' * 64) -Scope 'workflow').Reusable) "a $($case.Mode) PASS with changed files is not reused"
		}

		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'client' -Steps $stepsByMode.client -Fingerprint $fingerprint -Groups @('client', 'workflow')
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint $fingerprint -Scope 'client'
		Assert-True ((@($check.Evidence.groups) -join ',') -eq 'client,workflow') 'evidence records the changed-file groups'

		# --- State changes during verification ---------------------------------

		$startBranch = git -C $fixtureRepo rev-parse --abbrev-ref HEAD
		$startHead = git -C $fixtureRepo rev-parse HEAD
		$startFingerprint = Get-VerifyFingerprint -RepoRoot $fixtureRepo
		Set-FixtureFile 'src/app.ts' 'changed while verification is running'
		Write-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Result 'PASS' -Mode 'full' -Steps $stepsByMode.full -Fingerprint $startFingerprint -Branch $startBranch -Head $startHead
		$changedStateEvidence = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json
		$check = Test-VerifyEvidence -Path $evidencePath -RepoRoot $fixtureRepo -Fingerprint (Get-VerifyFingerprint -RepoRoot $fixtureRepo) -Scope full
		Assert-True ($changedStateEvidence.result -eq 'FAIL') 'a state change during the run converts the requested PASS to FAIL'
		Assert-True ($changedStateEvidence.stateError -eq 'files changed during Verify') 'the state-change evidence records why the PASS was rejected'
		Assert-True (-not $check.Reusable) 'evidence after a state change during the run is not reusable'

		# --- Running a step -----------------------------------------------------

		$stepLog = Join-Path $fixtureRepo 'step.log'
		$hasRunner = [bool](Get-Command Invoke-VerifyCommand -ErrorAction SilentlyContinue)
		Assert-True $hasRunner 'Invoke-VerifyCommand exists'
		if ($hasRunner) {
			# A command that cannot start must never pass. Inside a try block, as in
			# verify.ps1, PowerShell throws; outside one, the -1 exit code is left.
			try {
				$exitCode = Invoke-VerifyCommand -Command { vetiflow-no-such-command run lint } -LogPath $stepLog
			}
			catch {
				$exitCode = 'threw'
			}
			Assert-True ($exitCode -ne 0) 'a command that cannot start fails the step (inside a try block)'
			$powershellExe = (Get-Process -Id $PID).Path
			& $powershellExe -NoProfile -ExecutionPolicy Bypass -Command ". '$evidenceScript'; exit (Invoke-VerifyCommand -Command { vetiflow-no-such-command run lint } -LogPath '$stepLog')"
			Assert-True ($LASTEXITCODE -ne 0) 'a command that cannot start fails the step (outside a try block)'
			Assert-True ((Get-Content $stepLog -Raw) -match 'vetiflow-no-such-command') 'the log names the command that could not start'

			$exitCode = Invoke-VerifyCommand -Command { & $powershellExe -NoProfile -Command 'exit 3' } -LogPath $stepLog
			Assert-True ($exitCode -eq 3) 'a failing command returns its exit code'

			$exitCode = Invoke-VerifyCommand -Command { & $powershellExe -NoProfile -Command "[Console]::Error.WriteLine('step warning'); exit 0" } -LogPath $stepLog
			Assert-True ($exitCode -eq 0) 'stderr from a command that exits 0 does not fail the step'
			Assert-True ((Get-Content $stepLog -Raw) -match 'step warning') 'stderr is logged'
		}
	}
	finally {
		if (Test-Path $fixtureRepo) { Remove-Item -Recurse -Force $fixtureRepo }
	}
}

# --- Result --------------------------------------------------------------------

if ($failures.Count -gt 0) {
	Write-Host "Verify evidence: $($failures.Count) of $checkCount checks failed"
	foreach ($name in $failures) { Write-Host "  FAIL  $name" }
	exit 1
}
Write-Host "Verify evidence: all $checkCount checks passed"
exit 0
