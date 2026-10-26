<#
.SYNOPSIS
  Regression checks that Claude cannot start the skills that finish, land or
  loop over work on its own: only the person runs /ready, /complete and /approve.

.DESCRIPTION
  Plain PowerShell, no test framework. Reads skill frontmatter only; the
  negative case uses a copy in TEMP.
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$failures = [System.Collections.Generic.List[string]]::new()
$checkCount = 0

function Assert-True([bool]$Condition, [string]$Name) {
	$script:checkCount++
	if (-not $Condition) { $failures.Add($Name) }
}

# True when the file's frontmatter (between the first two '---' lines) has
# 'disable-model-invocation: true'.
function Test-PersonOnlySkill([string]$Path) {
	$lines = @(Get-Content -LiteralPath $Path)
	if ($lines.Count -eq 0 -or $lines[0].Trim() -ne '---') { return $false }
	for ($i = 1; $i -lt $lines.Count; $i++) {
		$line = $lines[$i].Trim()
		if ($line -eq '---') { return $false }
		if ($line -match '^disable-model-invocation:\s*true$') { return $true }
	}
	$false
}

foreach ($skill in 'ready', 'complete', 'approve') {
	$path = Join-Path $repoRoot ".claude/skills/$skill/SKILL.md"
	Assert-True ((Test-Path $path) -and (Test-PersonOnlySkill $path)) "/$skill keeps disable-model-invocation: true"
}

# The check must catch a removed flag, and must not accept one outside the frontmatter.
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) "vetiflow-skill-guards-$PID.md"
try {
	$approve = Get-Content -LiteralPath (Join-Path $repoRoot '.claude/skills/approve/SKILL.md')
	Set-Content -LiteralPath $fixture -Value ($approve | Where-Object { $_ -notmatch '^disable-model-invocation:' })
	Assert-True (-not (Test-PersonOnlySkill $fixture)) 'a skill without the flag is caught'

	Set-Content -LiteralPath $fixture -Value @('---', 'name: x', '---', 'disable-model-invocation: true')
	Assert-True (-not (Test-PersonOnlySkill $fixture)) 'the flag only counts inside the frontmatter'
}
finally {
	if (Test-Path $fixture) { Remove-Item -Force $fixture }
}

# --- Result --------------------------------------------------------------------

if ($failures.Count -gt 0) {
	Write-Host "Skill guards: $($failures.Count) of $checkCount checks failed"
	foreach ($name in $failures) { Write-Host "  FAIL  $name" }
	exit 1
}
Write-Host "Skill guards: all $checkCount checks passed"
exit 0
