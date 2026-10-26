<#
.SYNOPSIS
  Evidence for scripts/verify.ps1: how a step's result is decided, what a run
  proved, and whether it still holds.

.DESCRIPTION
  Dot-sourced by verify.ps1 and scripts/tests/verify-evidence.tests.ps1.

  The fingerprint covers every file git does not ignore, tracked or not, except
  the workflow bookkeeping that no Verify step reads and that /complete rewrites
  after its Verify. A run is reused only when it was a full PASS with every step
  passing and the fingerprint still matches.
#>

$script:fingerprintExcludedFiles = @(
	'blueprint/build-plan.md',
	'blueprint/context/current-feature.md',
	'blueprint/context/findings.md'
)
$script:fingerprintExcludedFolders = @('blueprint/history/')

# Runs one step's command with all its output in $LogPath and returns the exit code.
function Invoke-VerifyCommand([scriptblock]$Command, [string]$LogPath) {
	# Native stderr is logged as text, not thrown (Windows PowerShell 5.1); the exit
	# code is the only pass/fail signal.
	$ErrorActionPreference = 'Continue'
	# Not 0: a command that never starts (not on PATH) logs an error and leaves the
	# exit code alone, which must not count as a pass.
	$global:LASTEXITCODE = -1
	& $Command *>&1 | ForEach-Object {
		if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { "$_" }
	} | Out-File -FilePath $LogPath -Encoding utf8
	$global:LASTEXITCODE
}

function Get-VerifyFingerprint([string]$RepoRoot) {
	# Git may warn on stderr (line endings); only its exit code matters here.
	$ErrorActionPreference = 'Continue'
	# git prints paths as UTF-8, so non-ASCII names read the same in Windows
	# PowerShell 5.1 and pwsh.
	$consoleEncoding = [Console]::OutputEncoding
	[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
	try {
		$listing = git -C $RepoRoot ls-files --cached --others --exclude-standard -z
		if ($LASTEXITCODE -ne 0) { throw "git ls-files failed in $RepoRoot" }

		$included = @((($listing -join '') -split "`0") |
			Where-Object { $_ } |
			Where-Object { $script:fingerprintExcludedFiles -notcontains $_ } |
			Where-Object { $path = $_; -not ($script:fingerprintExcludedFolders | Where-Object { $path.StartsWith($_) }) } |
			# A tracked file deleted from disk drops out, which changes the hash.
			Where-Object { Test-Path -LiteralPath (Join-Path $RepoRoot $_) -PathType Leaf })
		# Ordinal, not Sort-Object's culture-aware order, so the hash is the same everywhere.
		$paths = [string[]]@([System.Collections.Generic.HashSet[string]]::new([string[]]$included, [StringComparer]::Ordinal))
		[Array]::Sort($paths, [StringComparer]::Ordinal)

		# Paths go as arguments, not through stdin, because Windows PowerShell 5.1
		# prefixes piped text with a BOM. Batches keep each command line short.
		$hashes = [System.Collections.Generic.List[string]]::new()
		for ($start = 0; $start -lt $paths.Count; $start += 100) {
			$batch = $paths[$start..([Math]::Min($start + 99, $paths.Count - 1))]
			foreach ($hash in (git -C $RepoRoot hash-object -- $batch)) { $hashes.Add($hash) }
			if ($LASTEXITCODE -ne 0) { throw "git hash-object failed in $RepoRoot" }
		}
		if ($hashes.Count -ne $paths.Count) { throw "git hash-object failed in $RepoRoot" }
	}
	finally {
		[Console]::OutputEncoding = $consoleEncoding
	}

	$lines = for ($i = 0; $i -lt $paths.Count; $i++) { "$($hashes[$i]) $($paths[$i])" }
	$bytes = [System.Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
	$sha = [System.Security.Cryptography.SHA256]::Create()
	try {
		-join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
	}
	finally {
		$sha.Dispose()
	}
}

function Remove-VerifyEvidence([string]$Path) {
	if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Force }
}

# $Steps: one @{ name; result } per step, in run order.
function Write-VerifyEvidence([string]$Path, [string]$RepoRoot, [string]$Result, [string]$Mode, [object[]]$Steps, [string]$Fingerprint) {
	$ErrorActionPreference = 'Continue'
	$branch = git -C $RepoRoot rev-parse --abbrev-ref HEAD
	$head = git -C $RepoRoot rev-parse HEAD
	$evidence = [ordered]@{
		result      = $Result
		mode        = $Mode
		steps       = @($Steps)
		fingerprint = $Fingerprint
		branch      = "$branch"
		head        = "$head"
		finishedAt  = [DateTime]::UtcNow.ToString('o')
		powershell  = $PSVersionTable.PSVersion.ToString()
	}
	$folder = Split-Path -Parent $Path
	if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory $folder | Out-Null }
	$json = ConvertTo-Json -InputObject $evidence -Depth 5
	[System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding $false))
}

function Test-VerifyEvidence([string]$Path, [string]$Fingerprint) {
	function New-Decision([bool]$Reusable, [string]$Reason, $Evidence) {
		[pscustomobject]@{ Reusable = $Reusable; Reason = $Reason; Evidence = $Evidence }
	}

	if (-not (Test-Path -LiteralPath $Path)) { return New-Decision $false 'no evidence' $null }
	try {
		$evidence = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
	}
	catch {
		$evidence = $null
	}
	if (-not $evidence) { return New-Decision $false 'evidence unreadable' $null }

	if ($evidence.result -ne 'PASS') { return New-Decision $false 'last run failed' $evidence }
	if ($evidence.mode -eq 'server') { return New-Decision $false 'last run was server-only' $evidence }
	if ($evidence.mode -eq 'client') { return New-Decision $false 'last run was client-only' $evidence }
	if ($evidence.mode -ne 'full') { return New-Decision $false 'last run was not full' $evidence }
	$steps = @($evidence.steps | Where-Object { $_ })
	if ($steps.Count -eq 0 -or ($steps | Where-Object { $_.result -ne 'PASS' })) {
		return New-Decision $false 'a step did not pass' $evidence
	}
	if ($evidence.fingerprint -ne $Fingerprint) { return New-Decision $false 'files changed since' $evidence }
	New-Decision $true '' $evidence
}
