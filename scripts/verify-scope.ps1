<#
.SYNOPSIS
  Scope for scripts/verify.ps1: which checks a branch needs, from the files it
  changed since it left main.

.DESCRIPTION
  Dot-sourced by verify.ps1 and scripts/tests/verify-scope.tests.ps1.

  Changed files are everything that differs from the merge base with origin/main
  (or main): committed, staged, unstaged and untracked, deletions included.
  Each path is client, server, workflow or full. A path the rule does not know
  is full, so the rule can only narrow what it recognises.

  Scopes: workflow (workflow tests only), server, client, full (everything).
#>

# Verify's own scripts change how every step runs.
$script:fullScopeFiles = @('scripts/verify.ps1', 'scripts/verify-evidence.ps1', 'scripts/verify-scope.ps1')
$script:workflowFolders = @('.claude/', 'blueprint/', '.github/', 'scripts/')

function Get-VerifyPathGroup([string]$Path) {
	if ($script:fullScopeFiles -contains $Path) { return 'full' }
	if ($Path.StartsWith('vetiflow.client/')) { return 'client' }
	if ($Path.StartsWith('vetiflow.Server/') -or $Path.StartsWith('vetiflow.Server.Tests/')) { return 'server' }
	if ($script:workflowFolders | Where-Object { $Path.StartsWith($_) }) { return 'workflow' }
	if ($Path -notmatch '/' -and $Path.EndsWith('.md')) { return 'workflow' }
	'full'
}

# Returns @{ Scope; Reason; Groups }.
function Get-VerifyScope([string]$RepoRoot) {
	function New-Scope([string]$Scope, [string]$Reason, [string[]]$Groups) {
		[pscustomobject]@{ Scope = $Scope; Reason = $Reason; Groups = @($Groups) }
	}

	# Git writes to stderr when a ref is missing; only its exit code matters here.
	$ErrorActionPreference = 'Continue'
	# git prints paths as UTF-8, so non-ASCII names read the same in Windows
	# PowerShell 5.1 and pwsh.
	$consoleEncoding = [Console]::OutputEncoding
	[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
	try {
		$baseName = $null
		foreach ($candidate in 'origin/main', 'main') {
			git -C $RepoRoot rev-parse --verify --quiet "$candidate^{commit}" *> $null
			if ($LASTEXITCODE -eq 0) { $baseName = $candidate; break }
		}
		if (-not $baseName) { return New-Scope 'full' 'no main or origin/main to compare with' @() }
		$base = git -C $RepoRoot merge-base HEAD $baseName 2> $null
		if ($LASTEXITCODE -ne 0 -or -not $base) { return New-Scope 'full' "no common commit with $baseName" @() }

		# --no-renames lists both sides of a rename, so a file moved out of an area counts too.
		$diff = git -C $RepoRoot diff --name-only --no-renames -z $base 2> $null
		if ($LASTEXITCODE -ne 0) { throw "git diff failed in $RepoRoot" }
		$untracked = git -C $RepoRoot ls-files --others --exclude-standard -z 2> $null
		if ($LASTEXITCODE -ne 0) { throw "git ls-files failed in $RepoRoot" }
	}
	finally {
		[Console]::OutputEncoding = $consoleEncoding
	}

	$paths = @(((@($diff) + @($untracked)) -join "`0") -split "`0" | Where-Object { $_ } | Sort-Object -Unique)
	if ($paths.Count -eq 0) { return New-Scope 'workflow' "no changes since $baseName" @() }

	$groups = @($paths | ForEach-Object { Get-VerifyPathGroup $_ } | Sort-Object -Unique)
	$count = "$($paths.Count) changed file$(if ($paths.Count -ne 1) { 's' }) since $baseName"
	if ($groups -contains 'full') {
		$examples = @($paths | Where-Object { (Get-VerifyPathGroup $_) -eq 'full' } | Select-Object -First 3) -join ', '
		return New-Scope 'full' "$count, including $examples" $groups
	}
	if (($groups -contains 'client') -and ($groups -contains 'server')) {
		return New-Scope 'full' "$count, in both vetiflow.client/ and vetiflow.Server*/" $groups
	}
	if ($groups -contains 'client') { return New-Scope 'client' "$count, app changes only under vetiflow.client/" $groups }
	if ($groups -contains 'server') { return New-Scope 'server' "$count, app changes only under vetiflow.Server*/" $groups }
	New-Scope 'workflow' "$count, all workflow files and docs" $groups
}
