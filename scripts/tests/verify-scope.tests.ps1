<#
.SYNOPSIS
  Regression checks for Verify's scope rule: which checks a branch needs, from
  the files it changed since it left main.

.DESCRIPTION
  Plain PowerShell, no test framework. Everything runs in throwaway git repos in
  TEMP; the real repo is never read or written.
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$failures = [System.Collections.Generic.List[string]]::new()
$checkCount = 0

function Assert-True([bool]$Condition, [string]$Name) {
	$script:checkCount++
	if (-not $Condition) { $failures.Add($Name) }
}

$scopeScript = Join-Path $repoRoot 'scripts/verify-scope.ps1'
Assert-True (Test-Path $scopeScript) 'verify-scope script exists'

if (Test-Path $scopeScript) {
	. $scopeScript

	$fixtureRepo = Join-Path ([System.IO.Path]::GetTempPath()) "vetiflow-verify-scope-$PID"

	function Invoke-FixtureGit {
		# Git may write progress to stderr; only its exit code matters here.
		$ErrorActionPreference = 'Continue'
		git -C $fixtureRepo -c user.name=fixture -c user.email=fixture@example.invalid -c core.autocrlf=false @args *> $null
		if ($LASTEXITCODE -ne 0) { throw "git $args failed in the fixture repo" }
	}

	function Set-FixtureFile([string]$RelativePath, [string]$Content) {
		$fullPath = Join-Path $fixtureRepo $RelativePath
		$folder = Split-Path -Parent $fullPath
		if (-not (Test-Path $folder)) { New-Item -ItemType Directory $folder | Out-Null }
		[System.IO.File]::WriteAllText($fullPath, $Content)
	}

	# A repo whose first branch is $Trunk, holding one file per area, with a work
	# branch checked out at the same commit.
	function New-FixtureRepo([string]$Trunk) {
		if (Test-Path $fixtureRepo) { Remove-Item -Recurse -Force $fixtureRepo }
		New-Item -ItemType Directory $fixtureRepo | Out-Null
		Set-FixtureFile '.gitignore' "ignored/`n"
		Set-FixtureFile 'README.md' '# App'
		Set-FixtureFile 'global.json' '{}'
		Set-FixtureFile '.claude/skills/verify/SKILL.md' '# verify'
		Set-FixtureFile 'blueprint/context/coding-standards.md' '# Standards'
		Set-FixtureFile 'scripts/verify.ps1' 'exit 0'
		Set-FixtureFile 'scripts/db-target.ps1' 'exit 0'
		Set-FixtureFile 'vetiflow.client/src/App.tsx' 'export {};'
		Set-FixtureFile 'vetiflow.Server/Program.cs' '// server'
		Set-FixtureFile 'vetiflow.Server.Tests/AppTests.cs' '// tests'
		Invoke-FixtureGit init -q -b $Trunk
		Invoke-FixtureGit add -A
		Invoke-FixtureGit commit -q -m fixture
		Invoke-FixtureGit switch -q -c work
	}

	function Get-FixtureScope { (Get-VerifyScope -RepoRoot $fixtureRepo).Scope }

	try {
		# Each case starts from a fresh repo, makes its change on the work branch
		# (committed unless it says otherwise) and expects one scope.
		$cases = @(
			@{ Name = 'nothing changed'; Expected = 'workflow'; Change = {} },
			@{ Name = 'only a skill changed'; Expected = 'workflow'; Change = {
					Set-FixtureFile '.claude/skills/verify/SKILL.md' '# verify, changed'; Invoke-FixtureGit commit -q -am skill } },
			@{ Name = 'only blueprint, a workflow script and the readme changed'; Expected = 'workflow'; Change = {
					Set-FixtureFile 'blueprint/context/coding-standards.md' '# Changed'
					Set-FixtureFile 'scripts/db-target.ps1' 'exit 1'
					Set-FixtureFile 'README.md' '# App, changed'
					Invoke-FixtureGit commit -q -am docs } },
			@{ Name = 'only a client file changed'; Expected = 'client'; Change = {
					Set-FixtureFile 'vetiflow.client/src/App.tsx' 'export const x = 1;'; Invoke-FixtureGit commit -q -am client } },
			@{ Name = 'an untracked client file'; Expected = 'client'; Change = {
					Set-FixtureFile 'vetiflow.client/src/New.tsx' 'export {};' } },
			@{ Name = 'only a server file changed'; Expected = 'server'; Change = {
					Set-FixtureFile 'vetiflow.Server/Program.cs' '// changed'; Invoke-FixtureGit commit -q -am server } },
			@{ Name = 'only a server test changed'; Expected = 'server'; Change = {
					Set-FixtureFile 'vetiflow.Server.Tests/AppTests.cs' '// changed'; Invoke-FixtureGit commit -q -am tests } },
			@{ Name = 'a deleted server file'; Expected = 'server'; Change = {
					Invoke-FixtureGit rm -q vetiflow.Server/Program.cs; Invoke-FixtureGit commit -q -m delete } },
			@{ Name = 'a staged, uncommitted server change'; Expected = 'server'; Change = {
					Set-FixtureFile 'vetiflow.Server/Program.cs' '// staged'; Invoke-FixtureGit add vetiflow.Server/Program.cs } },
			@{ Name = 'an unstaged server change'; Expected = 'server'; Change = {
					Set-FixtureFile 'vetiflow.Server/Program.cs' '// unstaged' } },
			@{ Name = 'a server and a workflow change'; Expected = 'server'; Change = {
					Set-FixtureFile 'vetiflow.Server/Program.cs' '// changed'
					Set-FixtureFile '.claude/skills/verify/SKILL.md' '# changed'
					Invoke-FixtureGit commit -q -am mixed } },
			@{ Name = 'a client and a server change'; Expected = 'full'; Change = {
					Set-FixtureFile 'vetiflow.client/src/App.tsx' 'export const x = 1;'
					Set-FixtureFile 'vetiflow.Server/Program.cs' '// changed'
					Invoke-FixtureGit commit -q -am both } },
			@{ Name = 'the Verify script changed'; Expected = 'full'; Change = {
					Set-FixtureFile 'scripts/verify.ps1' 'exit 1'; Invoke-FixtureGit commit -q -am verify } },
			@{ Name = 'the scope script added'; Expected = 'full'; Change = {
					Set-FixtureFile 'scripts/verify-scope.ps1' '# scope' } },
			@{ Name = 'the evidence script added'; Expected = 'full'; Change = {
					Set-FixtureFile 'scripts/verify-evidence.ps1' '# evidence' } },
			@{ Name = 'an unknown root file changed'; Expected = 'full'; Change = {
					Set-FixtureFile 'global.json' '{ "sdk": {} }'; Invoke-FixtureGit commit -q -am root } },
			@{ Name = 'a new top folder'; Expected = 'full'; Change = {
					Set-FixtureFile 'tools/build.ps1' 'exit 0' } },
			@{ Name = 'a git-ignored file'; Expected = 'workflow'; Change = {
					Set-FixtureFile 'ignored/output.log' 'build output' } }
		)
		foreach ($case in $cases) {
			New-FixtureRepo 'main'
			& $case.Change
			$scope = Get-FixtureScope
			Assert-True ($scope -eq $case.Expected) "$($case.Name): scope $($case.Expected) (got '$scope')"
		}

		# The result names the groups it found and says why.
		New-FixtureRepo 'main'
		Set-FixtureFile 'vetiflow.client/src/App.tsx' 'export const x = 1;'
		$result = Get-VerifyScope -RepoRoot $fixtureRepo
		Assert-True (@($result.Groups) -contains 'client') 'the result lists the client group'
		Assert-True ($result.Reason -match 'vetiflow\.client/') 'the reason names the changed area'

		# origin/main wins over main: only changes since origin/main count.
		New-FixtureRepo 'main'
		Set-FixtureFile 'vetiflow.Server/Program.cs' '// merged already'
		Invoke-FixtureGit commit -q -am merged
		Invoke-FixtureGit update-ref refs/remotes/origin/main HEAD
		Set-FixtureFile 'vetiflow.client/src/App.tsx' 'export const x = 1;'
		Invoke-FixtureGit commit -q -am client
		Assert-True ((Get-FixtureScope) -eq 'client') 'the base is origin/main when it exists'

		# No main to compare with: run everything.
		New-FixtureRepo 'trunk'
		Set-FixtureFile '.claude/skills/verify/SKILL.md' '# changed'
		$result = Get-VerifyScope -RepoRoot $fixtureRepo
		Assert-True ($result.Scope -eq 'full') "no main or origin/main: scope full (got '$($result.Scope)')"
		Assert-True ($result.Reason -match 'main') 'the reason says main was not found'
	}
	finally {
		if (Test-Path $fixtureRepo) { Remove-Item -Recurse -Force $fixtureRepo }
	}
}

# --- Result --------------------------------------------------------------------

if ($failures.Count -gt 0) {
	Write-Host "Verify scope: $($failures.Count) of $checkCount checks failed"
	foreach ($name in $failures) { Write-Host "  FAIL  $name" }
	exit 1
}
Write-Host "Verify scope: all $checkCount checks passed"
exit 0
