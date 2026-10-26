<#
.SYNOPSIS
  Regression checks that CI runs Verify itself and stays locked down: both jobs
  call scripts/verify.ps1 and never reuse evidence, every job has a timeout,
  every action is pinned to a commit SHA, and the PR title never reaches a script
  as text.

.DESCRIPTION
  Plain PowerShell, no test framework. Reads the workflow files as text; the
  negative cases use fixture lines.
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$failures = [System.Collections.Generic.List[string]]::new()
$checkCount = 0

function Assert-True([bool]$Condition, [string]$Name) {
	$script:checkCount++
	if (-not $Condition) { $failures.Add($Name) }
}

# 'uses:' lines whose action is not pinned to a full 40-character commit SHA.
function Get-UnpinnedUses([string[]]$Lines) {
	@($Lines | Where-Object { $_ -match '^\s*(-\s*)?uses:' -and $_ -notmatch 'uses:\s*[^@\s]+@[0-9a-f]{40}(\s|$)' })
}

# Lines that put the PR title anywhere but an environment variable's value.
function Get-TitleOutsideEnv([string[]]$Lines) {
	@($Lines | Where-Object { $_ -match 'github\.event\.pull_request\.title' -and $_ -notmatch '^\s*[A-Za-z_][A-Za-z0-9_]*:\s*\$\{\{\s*github\.event\.pull_request\.title\s*\}\}\s*$' })
}

$workflowFolder = Join-Path $repoRoot '.github/workflows'
$workflows = @(Get-ChildItem $workflowFolder -Filter *.yml)
Assert-True ($workflows.Count -gt 0) 'workflow files exist'

foreach ($workflow in $workflows) {
	$lines = @(Get-Content -LiteralPath $workflow.FullName)
	$jobCount = @($lines | Where-Object { $_ -match '^\s*runs-on:' }).Count
	$timeoutCount = @($lines | Where-Object { $_ -match '^\s*timeout-minutes:\s*\d+\s*$' }).Count
	Assert-True ($jobCount -gt 0 -and $timeoutCount -eq $jobCount) "$($workflow.Name): every job has timeout-minutes"
	Assert-True ((Get-UnpinnedUses $lines).Count -eq 0) "$($workflow.Name): every action is pinned to a commit SHA"
	Assert-True ((Get-TitleOutsideEnv $lines).Count -eq 0) "$($workflow.Name): the PR title only reaches scripts through env"
	Assert-True (-not ($lines -match '-ReuseIfCurrent')) "$($workflow.Name): CI never reuses Verify evidence"
	Assert-True (-not ($lines -match 'pull_request_target')) "$($workflow.Name): no pull_request_target trigger"
}

$ciPath = Join-Path $workflowFolder 'ci.yml'
$ci = if (Test-Path $ciPath) { @(Get-Content -LiteralPath $ciPath) } else { @() }
Assert-True (@($ci -match '^\s*name:\s*Server tests\s*$').Count -eq 1) 'ci.yml keeps the "Server tests" job name'
Assert-True (@($ci -match '^\s*name:\s*Client lint, build and tests\s*$').Count -eq 1) 'ci.yml keeps the "Client lint, build and tests" job name'
$verifyRuns = @($ci | Where-Object { $_ -match '^\s*run:.*scripts/verify\.ps1' })
Assert-True ($verifyRuns.Count -eq 2) 'ci.yml runs Verify in two jobs'
Assert-True (@($verifyRuns -match '\s-ServerOnly\s*$').Count -eq 1) 'one CI job runs Verify -ServerOnly'
Assert-True (@($verifyRuns -match '\s-ClientOnly\s*$').Count -eq 1) 'one CI job runs Verify -ClientOnly'

$titlePath = Join-Path $workflowFolder 'pr-title.yml'
$title = if (Test-Path $titlePath) { @(Get-Content -LiteralPath $titlePath) } else { @() }
Assert-True (@($title -match '^\s{4}name:\s*PR title\s*$').Count -eq 1) 'pr-title.yml has the "PR title" job'
Assert-True (@($title -match '^\s*run:.*scripts/check-pr-title\.ps1').Count -eq 1) 'pr-title.yml runs check-pr-title.ps1'

$dependabotPath = Join-Path $repoRoot '.github/dependabot.yml'
Assert-True ((Test-Path $dependabotPath) -and ((Get-Content -LiteralPath $dependabotPath) -match '^\s*-\s*package-ecosystem:\s*github-actions\s*$')) 'Dependabot updates the github-actions ecosystem'

# The checks must catch what they guard against.
Assert-True ((Get-UnpinnedUses @('      - uses: actions/checkout@v5')).Count -eq 1) 'a tag-pinned action is caught'
Assert-True ((Get-UnpinnedUses @('      - uses: actions/checkout@fbc6f399 # short')).Count -eq 1) 'a short SHA is caught'
Assert-True ((Get-UnpinnedUses @('      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0')).Count -eq 0) 'a full SHA passes'
Assert-True ((Get-TitleOutsideEnv @('        run: echo "${{ github.event.pull_request.title }}"')).Count -eq 1) 'a title written into a run command is caught'
Assert-True ((Get-TitleOutsideEnv @('          PR_TITLE: ${{ github.event.pull_request.title }}')).Count -eq 0) 'a title passed through env passes'

# --- Result --------------------------------------------------------------------

if ($failures.Count -gt 0) {
	Write-Host "CI workflow: $($failures.Count) of $checkCount checks failed"
	foreach ($name in $failures) { Write-Host "  FAIL  $name" }
	exit 1
}
Write-Host "CI workflow: all $checkCount checks passed"
exit 0
