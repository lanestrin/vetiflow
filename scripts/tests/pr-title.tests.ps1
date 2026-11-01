<#
.SYNOPSIS
  Regression checks for scripts/check-pr-title.ps1: titles that follow the
  commit subject rules pass, and each broken rule fails.

.DESCRIPTION
  Plain PowerShell, no test framework. Runs every rule case in-process and
  retains child PowerShell checks for the CLI's success/failure output and exits.
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$failures = [System.Collections.Generic.List[string]]::new()
$checkCount = 0

function Assert-True([bool]$Condition, [string]$Name) {
	$script:checkCount++
	if (-not $Condition) { $failures.Add($Name) }
}

$checkScript = Join-Path $repoRoot 'scripts/check-pr-title.ps1'
$powershellExe = (Get-Process -Id $PID).Path

function Test-Title([string]$Title) {
	& $checkScript -Title $Title | Out-Null
	$LASTEXITCODE -eq 0
}

Assert-True (Test-Path $checkScript) 'check-pr-title script exists'

$valid = @(
	'feat: add owners (0.2)',
	'fix!: reject numeric stages',
	'chore: make CI run the Verify script (1.6)',
	'docs: add a README',
	'test: cover the stage endpoint',
	('feat: ' + ('a' * 66))
)
foreach ($title in $valid) {
	Assert-True (Test-Title $title) "passes: $title"
}

$invalid = @(
	@{ Title = 'add owners'; Rule = 'no type' },
	@{ Title = 'feature: add owners'; Rule = 'unknown type' },
	@{ Title = 'Feature/owner'; Rule = 'branch name as title' },
	@{ Title = 'Feat: add owners'; Rule = 'capitalised type' },
	@{ Title = 'feat:add owners'; Rule = 'no space after the colon' },
	@{ Title = 'feat: '; Rule = 'no summary' },
	@{ Title = 'feat: add owners.'; Rule = 'trailing full stop' },
	@{ Title = ('feat: ' + ('a' * 67)); Rule = 'over 72 characters' }
)
foreach ($case in $invalid) {
	Assert-True (-not (Test-Title $case.Title)) "fails: $($case.Rule)"
}

$cliCases = @(
	@{ Title = 'fix!: preserve owner records'; Exit = 0; Output = '^PR title passes\.$' },
	@{ Title = 'fix: preserve owner records.'; Exit = 1; Output = '^PR title fails .*it must not end with a full stop\.$' }
)
foreach ($case in $cliCases) {
	$output = @(& $powershellExe -NoProfile -ExecutionPolicy Bypass -File $checkScript -Title $case.Title)
	$exitCode = $LASTEXITCODE
	Assert-True ($exitCode -eq $case.Exit) "CLI exits $($case.Exit): $($case.Title)"
	Assert-True ($output.Count -eq 1 -and $output[0] -match $case.Output) "CLI reports the result: $($case.Title)"
}

# --- Result --------------------------------------------------------------------

if ($failures.Count -gt 0) {
	Write-Host "PR title: $($failures.Count) of $checkCount checks failed"
	foreach ($name in $failures) { Write-Host "  FAIL  $name" }
	exit 1
}
Write-Host "PR title: all $checkCount checks passed"
exit 0
