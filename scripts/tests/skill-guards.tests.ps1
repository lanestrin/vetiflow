<#
.SYNOPSIS
  Regression checks that Claude cannot start the skills that finish, land or
  loop over work on its own: only the person runs /ready, /complete, /approve
  and /done.

.DESCRIPTION
  Plain PowerShell, no test framework. Checks person-only frontmatter and
  implementation test policy; the negative case uses a copy in TEMP.
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

foreach ($skill in 'ready', 'complete', 'approve', 'done') {
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

$implement = Get-Content -LiteralPath (Join-Path $repoRoot '.claude/skills/implement/SKILL.md') -Raw
$ready = Get-Content -LiteralPath (Join-Path $repoRoot '.claude/skills/ready/SKILL.md') -Raw
$interaction = Get-Content -LiteralPath (Join-Path $repoRoot 'blueprint/context/ai-interaction.md') -Raw
$buildChecks = [regex]::Match($implement, '(?s)5\. Run the narrow check:.*?(?=6\. Tick)').Value
Assert-True ($buildChecks -match 'Defer ordinary whole-suite checks to final Verify') 'ordinary steps defer full suites instead of repeating them'
Assert-True ($buildChecks -notmatch 'Run the whole affected suite\s+instead') 'no blanket whole-suite trigger for shared code, dependencies or config'
foreach ($risk in 'database', 'migrations', 'authorization', 'security', 'clinical-data integrity') {
	Assert-True ($buildChecks -match [regex]::Escape($risk)) "intermediate checks retain $risk coverage"
}
Assert-True ($buildChecks -match 'Run these checks before ticking the step; do not defer them') 'sensitive intermediate checks cannot be deferred'
Assert-True ($buildChecks -match 'explicitly required.*spec' -and $buildChecks -match 'failing regression test.*observed before the fix') 'spec checks and failing-first regressions remain required'
Assert-True ($implement -match 'Standalone `/implement` runs final Verify once' -and $implement -match '`/ready` owns\s+final Verify after all builds and repairs') 'standalone and coordinated work have one final Verify owner'
Assert-True ($ready -match 'Skip its standalone final Verify and report' -and $ready -match 'After all builds and repairs.*?apply' -and $ready -match 'run final Verify\s+once') 'ready avoids nested final verification'
Assert-True ($interaction -match 'focused checks during implementation' -and $interaction -match 'whole affected suites to final Verify') 'shared context policy defers ordinary broad checks'
foreach ($skill in 'complete', 'approve') {
	$content = Get-Content -LiteralPath (Join-Path $repoRoot ".claude/skills/$skill/SKILL.md") -Raw
	Assert-True ($content -match '-ReuseIfCurrent') "/$skill retains script-controlled evidence reuse"
}

# --- Result --------------------------------------------------------------------

if ($failures.Count -gt 0) {
	Write-Host "Skill guards: $($failures.Count) of $checkCount checks failed"
	foreach ($name in $failures) { Write-Host "  FAIL  $name" }
	exit 1
}
Write-Host "Skill guards: all $checkCount checks passed"
exit 0
