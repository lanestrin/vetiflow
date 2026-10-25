<#
.SYNOPSIS
  Regression checks for the secret guardrails: the PreToolUse hook, db-target.ps1,
  the shared Claude settings and the Docker build-context exclusions.

.DESCRIPTION
  Plain PowerShell, no test framework. Nothing here runs a secret-listing command
  or opens a real secret file: command strings only go to the hook as JSON, and
  db-target.ps1 only sees fake connection strings and a fake APPDATA in TEMP.
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$powershellExe = (Get-Process -Id $PID).Path
$failures = [System.Collections.Generic.List[string]]::new()
$checkCount = 0

function Assert-True([bool]$Condition, [string]$Name) {
	$script:checkCount++
	if (-not $Condition) { $failures.Add($Name) }
}

# Runs a child process with captured streams, so a blocked hook's stderr never
# becomes an error record in this process (Windows PowerShell 5.1).
function Invoke-Captured([string]$FileName, [string]$Arguments, [string]$StdIn, [hashtable]$Environment) {
	$startInfo = New-Object System.Diagnostics.ProcessStartInfo
	$startInfo.FileName = $FileName
	$startInfo.Arguments = $Arguments
	$startInfo.UseShellExecute = $false
	$startInfo.RedirectStandardInput = $true
	$startInfo.RedirectStandardOutput = $true
	$startInfo.RedirectStandardError = $true
	# Clear the real configuration sources so only the fixture values are seen.
	foreach ($name in 'ConnectionStrings__VetiFlowDatabase', 'VETIFLOW_TEST_POSTGRES') {
		$startInfo.EnvironmentVariables.Remove($name)
	}
	if ($Environment) {
		foreach ($key in $Environment.Keys) { $startInfo.EnvironmentVariables[$key] = $Environment[$key] }
	}
	$process = [System.Diagnostics.Process]::Start($startInfo)
	if ($StdIn) { $process.StandardInput.Write($StdIn) }
	$process.StandardInput.Close()
	$stdout = $process.StandardOutput.ReadToEnd()
	$stderr = $process.StandardError.ReadToEnd()
	$process.WaitForExit()
	[pscustomobject]@{ ExitCode = $process.ExitCode; Output = "$stdout$stderr" }
}

function Invoke-DbTarget([string]$Arguments, [hashtable]$Environment) {
	Invoke-Captured $powershellExe "-NoProfile -ExecutionPolicy Bypass -File `"$dbTarget`" $Arguments" '' $Environment
}

# --- PreToolUse hook -----------------------------------------------------------

$hook = Join-Path $repoRoot '.claude/hooks/block-secret-commands.mjs'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
Assert-True (Test-Path $hook) 'hook script exists'
Assert-True ([bool]$node) 'node is installed (the hook runs on it)'

if ((Test-Path $hook) -and $node) {
	function Invoke-Hook([string]$Tool, [string]$Command) {
		$json = @{ hook_event_name = 'PreToolUse'; tool_name = $Tool; tool_input = @{ command = $Command } } | ConvertTo-Json -Compress
		Invoke-Captured $node "`"$hook`"" $json
	}

	$blocked = @(
		@{ Tool = 'Bash'; Command = 'dotnet user-secrets list --project vetiflow.Server' },
		@{ Tool = 'Bash'; Command = 'dotnet user-secrets --project vetiflow.Server list' },
		@{ Tool = 'Bash'; Command = 'dotnet user-secrets -p vetiflow.Server list | sed s/x/y/' },
		@{ Tool = 'Bash'; Command = 'printenv' },
		@{ Tool = 'Bash'; Command = 'env' },
		@{ Tool = 'Bash'; Command = 'cd vetiflow.client && env | sort' },
		@{ Tool = 'Bash'; Command = 'env -0' },
		@{ Tool = 'Bash'; Command = 'env > out.txt' },
		@{ Tool = 'Bash'; Command = '{ env; }' },
		@{ Tool = 'Bash'; Command = 'echo `env`' },
		@{ Tool = 'Bash'; Command = 'echo $(env)' },
		@{ Tool = 'Bash'; Command = '/usr/bin/env' },
		@{ Tool = 'Bash'; Command = 'sh -c "printenv"' },
		@{ Tool = 'Bash'; Command = 'bash -c ''env''' },
		@{ Tool = 'Bash'; Command = 'set' },
		@{ Tool = 'Bash'; Command = 'set | grep KEY' },
		@{ Tool = 'Bash'; Command = 'export' },
		@{ Tool = 'Bash'; Command = 'export -p' },
		@{ Tool = 'Bash'; Command = 'declare -x' },
		@{ Tool = 'Bash'; Command = 'declare -p' },
		@{ Tool = 'Bash'; Command = 'compgen -e' },
		@{ Tool = 'Bash'; Command = 'cmd /c set' },
		@{ Tool = 'Bash'; Command = 'cat vetiflow.client/.env.local' },
		@{ Tool = 'Bash'; Command = 'cat vetiflow.client/.env*' },
		@{ Tool = 'Bash'; Command = 'cat vetiflow.client/{.env.local,x}' },
		@{ Tool = 'Bash'; Command = 'cat .env.example.bak' },
		@{ Tool = 'Bash'; Command = 'node -e "require(''fs'').readFileSync(''.env'')"' },
		@{ Tool = 'PowerShell'; Command = 'gci env:' },
		@{ Tool = 'PowerShell'; Command = 'Get-ChildItem Env:\' },
		@{ Tool = 'PowerShell'; Command = 'Get-ChildItem -Path Env:' },
		@{ Tool = 'PowerShell'; Command = 'Get-Item -Path Env:*' },
		@{ Tool = 'PowerShell'; Command = '[Environment]::GetEnvironmentVariables()' },
		@{ Tool = 'PowerShell'; Command = '[System.Environment]::GetEnvironmentVariables()' },
		@{ Tool = 'PowerShell'; Command = 'Get-Content vetiflow.client\.env.production' },
		# env with only assignments after it, and commands after a prefix word.
		@{ Tool = 'Bash'; Command = 'env FOO=1' },
		@{ Tool = 'Bash'; Command = 'env FOO=1 | sort' },
		@{ Tool = 'Bash'; Command = 'env FOO="a b"' },
		@{ Tool = 'Bash'; Command = 'nohup env' },
		@{ Tool = 'Bash'; Command = 'command env' },
		@{ Tool = 'Bash'; Command = 'builtin export' },
		@{ Tool = 'Bash'; Command = 'timeout 5 env' },
		@{ Tool = 'Bash'; Command = '! env' },
		@{ Tool = 'Bash'; Command = 'if env; then :; fi' },
		# Variables known to hold a connection string, and /proc environments.
		@{ Tool = 'PowerShell'; Command = 'Write-Output $env:ConnectionStrings__VetiFlowDatabase' },
		@{ Tool = 'Bash'; Command = 'echo $VETIFLOW_TEST_POSTGRES' },
		@{ Tool = 'Bash'; Command = 'echo $POSTGRESQLCONNSTR_VetiFlowDatabase' },
		@{ Tool = 'Bash'; Command = 'cat /proc/self/environ' }
	)
	$allowed = @(
		@{ Tool = 'Bash'; Command = 'git status --short' },
		@{ Tool = 'Bash'; Command = 'git commit -F blueprint/context/landing-commit.txt' },
		@{ Tool = 'Bash'; Command = 'cat vetiflow.client/.env.example' },
		@{ Tool = 'Bash'; Command = 'cat .envrc && ls .venv' },
		@{ Tool = 'Bash'; Command = 'dotnet test --project vetiflow.Server.Tests' },
		@{ Tool = 'Bash'; Command = 'dotnet user-secrets init --project vetiflow.Server' },
		@{ Tool = 'Bash'; Command = 'env NODE_ENV=test npm run build' },
		@{ Tool = 'Bash'; Command = 'set -euo pipefail; npm ci' },
		@{ Tool = 'Bash'; Command = 'export NODE_ENV=test' },
		@{ Tool = 'Bash'; Command = 'declare -a steps' },
		@{ Tool = 'Bash'; Command = 'grep -rn "import.meta.env" vetiflow.client/src' },
		@{ Tool = 'PowerShell'; Command = 'Write-Host $env:PATH' },
		@{ Tool = 'PowerShell'; Command = 'Write-Host ${env:ProgramFiles}' },
		@{ Tool = 'PowerShell'; Command = 'npm run lint' },
		@{ Tool = 'Bash'; Command = 'nohup npm run dev' },
		@{ Tool = 'Bash'; Command = 'command -v node' },
		@{ Tool = 'Bash'; Command = 'timeout 5 npm test' },
		@{ Tool = 'Bash'; Command = 'if true; then echo ok; fi' }
	)
	foreach ($case in $blocked) {
		$result = Invoke-Hook $case.Tool $case.Command
		Assert-True ($result.ExitCode -eq 2) "hook blocks: $($case.Command)"
		# One fixed line, so nothing from the command (which may hold a value) is echoed.
		$lines = @($result.Output.Trim() -split "`r?`n")
		Assert-True ($lines.Count -eq 1 -and $lines[0].StartsWith('Blocked by .claude/hooks/block-secret-commands.mjs:')) "hook prints only its fixed reason: $($case.Command)"
	}
	foreach ($case in $allowed) {
		$result = Invoke-Hook $case.Tool $case.Command
		Assert-True ($result.ExitCode -eq 0) "hook allows: $($case.Command)"
	}

	# Input it can't read, or a matching event without a string command, is blocked.
	$malformed = @(
		@{ Name = 'unreadable input'; Json = 'not json' },
		@{ Name = 'missing command'; Json = '{"tool_name":"Bash","tool_input":{}}' },
		@{ Name = 'missing tool_input'; Json = '{"tool_name":"Bash"}' },
		@{ Name = 'null command'; Json = '{"tool_name":"Bash","tool_input":{"command":null}}' },
		@{ Name = 'number command'; Json = '{"tool_name":"PowerShell","tool_input":{"command":42}}' },
		@{ Name = 'object command'; Json = '{"tool_name":"Bash","tool_input":{"command":{"text":"git status"}}}' }
	)
	foreach ($case in $malformed) {
		$result = Invoke-Captured $node "`"$hook`"" $case.Json
		Assert-True ($result.ExitCode -eq 2) "hook blocks a malformed event: $($case.Name)"
	}
}

# --- db-target.ps1 -------------------------------------------------------------

$dbTarget = Join-Path $repoRoot 'scripts/db-target.ps1'
Assert-True (Test-Path $dbTarget) 'db-target script exists'

if (Test-Path $dbTarget) {
	$secretMarkers = 'example.invalid', 'fixture-pw', 'fixture_user', 'fixture_db', 'marker'
	$cases = @(
		@{ Name = 'Host inside a quoted value'; Value = 'Host=db.example.invalid;Password="fixture;Host=localhost;marker";Database=fixture_db'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'remote Host inside a quoted value is ignored'; Value = 'Host=localhost;Password="fixture-pw;Host=db.example.invalid;marker"'; Exit = 0; Line = 'Database target: local' },
		@{ Name = 'earlier Server key is checked too'; Value = 'Server=db.example.invalid;Host=localhost;Password=fixture-pw'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'several local hosts'; Value = 'Host=localhost,127.0.0.1:5433,[::1]:5432,::1;Password=fixture-pw'; Exit = 0; Line = 'Database target: local' },
		@{ Name = 'empty host in a list'; Value = 'Host=localhost,;Password=fixture-pw'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'malformed: key without value'; Value = 'Host=localhost;fixture-pw'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'malformed: unterminated quote'; Value = 'Host=localhost;Password="fixture-pw'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'local host'; Value = 'Host=localhost;Port=5432;Database=fixture_db;Username=fixture_user;Password=fixture-pw'; Exit = 0; Line = 'Database target: local' },
		@{ Name = 'loopback with port'; Value = 'Server=127.0.0.1:5433;Database=fixture_db;Password=fixture-pw'; Exit = 0; Line = 'Database target: local' },
		@{ Name = 'remote host'; Value = 'Host=db.example.invalid;Database=fixture_db;Username=fixture_user;Password=fixture-pw'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'one remote host in a list'; Value = 'Host=localhost,db.example.invalid;Password=fixture-pw'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'later Server key wins'; Value = 'Host=localhost;Server=db.example.invalid;Password=fixture-pw'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'later Host key wins'; Value = 'Host=localhost;Database=fixture_db;Host=db.example.invalid'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'later local key wins'; Value = 'Host=db.example.invalid;Host=localhost;Password=fixture-pw'; Exit = 0; Line = 'Database target: local' },
		@{ Name = 'no host'; Value = 'Database=fixture_db;Password=fixture-pw'; Exit = 1; Line = 'Database target: NOT local' },
		@{ Name = 'URI form'; Value = 'postgres://fixture_user:fixture-pw@localhost/fixture_db'; Exit = 1; Line = 'Database target: NOT local' }
	)
	foreach ($case in $cases) {
		$result = Invoke-DbTarget '' @{ ConnectionStrings__VetiFlowDatabase = $case.Value }
		Assert-True ($result.ExitCode -eq $case.Exit) "db-target exit code: $($case.Name)"
		Assert-True ($result.Output.Trim() -eq $case.Line) "db-target prints only '$($case.Line)': $($case.Name)"
		foreach ($marker in $secretMarkers) {
			Assert-True ($result.Output -notmatch [regex]::Escape($marker)) "db-target hides '$marker': $($case.Name)"
		}
	}

	# -Migrate and -StartApp run a fake dotnet that only records what it was given,
	# so no database is touched. The checked string must reach it unchanged, in the
	# environment and never on the command line, with competing variables removed.
	$fakeRoot = Join-Path ([System.IO.Path]::GetTempPath()) "vetiflow-fake-dotnet-$PID"
	New-Item -ItemType Directory -Force $fakeRoot | Out-Null
	$fakeDotnet = Join-Path $fakeRoot 'dotnet.ps1'
	$fakeLog = Join-Path $fakeRoot 'received.json'
	Set-Content $fakeDotnet @'
@{
	Arguments = @($args)
	Bound = $env:ConnectionStrings__VetiFlowDatabase
	Environment = $env:ASPNETCORE_ENVIRONMENT
	Urls = $env:ASPNETCORE_URLS
	Competing = @(@([Environment]::GetEnvironmentVariables().Keys) | Where-Object { $_ -match 'CONNSTR_|^(ASPNETCORE|DOTNET)_ConnectionStrings' })
} | ConvertTo-Json | Set-Content $env:VETIFLOW_FAKE_DOTNET_LOG
exit 0
'@
	# The quoted value would become a real Host=db.example.invalid if it went
	# through Windows PowerShell 5.1's native argument passing.
	$localValue = 'Host=localhost;Password="fixture-pw;Host=db.example.invalid;marker"'
	$competing = @{ POSTGRESQLCONNSTR_VetiFlowDatabase = 'Host=db.example.invalid'; ASPNETCORE_ConnectionStrings__VetiFlowDatabase = 'Host=db.example.invalid' }
	try {
		$operations = @(
			@{ Switch = '-Migrate'; Expected = @('ef', 'database', 'update', '--project', $fakeRoot) },
			@{ Switch = '-StartApp'; Expected = @('run', '--project', $fakeRoot, '--no-launch-profile') }
		)
		foreach ($operation in $operations) {
			$operationArgs = "$($operation.Switch) -Dotnet `"$fakeDotnet`" -ProjectDir `"$fakeRoot`""
			Remove-Item $fakeLog -ErrorAction SilentlyContinue
			$result = Invoke-DbTarget $operationArgs ($competing + @{ ConnectionStrings__VetiFlowDatabase = $localValue; VETIFLOW_FAKE_DOTNET_LOG = $fakeLog; ASPNETCORE_ENVIRONMENT = 'Production' })
			Assert-True ($result.ExitCode -eq 0 -and $result.Output.Trim() -eq 'Database target: local') "db-target $($operation.Switch) checks, then runs"
			$received = if (Test-Path $fakeLog) { Get-Content -Raw $fakeLog | ConvertFrom-Json }
			Assert-True ($received -and $received.Bound -ceq $localValue) "db-target $($operation.Switch) binds exactly the checked string"
			Assert-True ($received -and -not (Compare-Object @($received.Arguments) $operation.Expected -SyncWindow 0 -CaseSensitive)) "db-target $($operation.Switch) puts no connection string on the command line"
			Assert-True ($received -and @($received.Competing).Count -eq 0) "db-target $($operation.Switch) removes competing variables"
			Assert-True ($result.Output -notmatch 'fixture-pw') "db-target $($operation.Switch) does not print the string"

			Remove-Item $fakeLog -ErrorAction SilentlyContinue
			$result = Invoke-DbTarget $operationArgs @{ ConnectionStrings__VetiFlowDatabase = 'Host=db.example.invalid;Password=fixture-pw'; VETIFLOW_FAKE_DOTNET_LOG = $fakeLog }
			Assert-True ($result.ExitCode -eq 1 -and -not (Test-Path $fakeLog)) "db-target $($operation.Switch) runs nothing for a remote target"
		}

		# -StartApp loads no launch profile, so the profile's settings come from the
		# script instead, and remote commandLineArgs or environmentVariables in the
		# profile are never applied (dotnet run applies both after ours).
		Assert-True ($received.Environment -eq 'Development' -and $received.Urls -eq 'https://localhost:7274;http://localhost:5112') 'db-target -StartApp sets the Development environment and https URLs itself'
		New-Item -ItemType Directory -Force (Join-Path $fakeRoot 'Properties') | Out-Null
		Set-Content (Join-Path $fakeRoot 'Properties/launchSettings.json') '{ "profiles": { "https": { "commandName": "Project", "commandLineArgs": "--ConnectionStrings:VetiFlowDatabase=Host=db.example.invalid", "environmentVariables": { "ConnectionStrings__VetiFlowDatabase": "Host=db.example.invalid" } } } }'
		Remove-Item $fakeLog -ErrorAction SilentlyContinue
		$result = Invoke-DbTarget "-StartApp -Dotnet `"$fakeDotnet`" -ProjectDir `"$fakeRoot`"" @{ ConnectionStrings__VetiFlowDatabase = $localValue; VETIFLOW_FAKE_DOTNET_LOG = $fakeLog }
		$received = if (Test-Path $fakeLog) { Get-Content -Raw $fakeLog | ConvertFrom-Json }
		Assert-True ($result.ExitCode -eq 0 -and $received -and $received.Bound -ceq $localValue -and @($received.Arguments) -contains '--no-launch-profile' -and @($received.Arguments) -notcontains '--launch-profile') 'db-target -StartApp ignores a launch profile that names another database'
		Assert-True ($result.Output -notmatch 'example\.invalid') 'db-target -StartApp does not print the profile values'

		# A caller that runs the script with & (not -File) shares its process, so the
		# script must undo every variable it set or removed for the child. The
		# string comes from a fixture appsettings.Development.json, so the caller
		# starts without the bound variable and must end without it.
		$callerProject = Join-Path $fakeRoot 'caller-project'
		New-Item -ItemType Directory -Force $callerProject | Out-Null
		Set-Content (Join-Path $callerProject 'fixture.csproj') '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>'
		Set-Content (Join-Path $callerProject 'appsettings.Development.json') '{ "ConnectionStrings": { "VetiFlowDatabase": "Host=localhost;Password=fixture-pw" } }'
		$caller = Join-Path $fakeRoot 'caller.ps1'
		$callerLog = Join-Path $fakeRoot 'caller.json'
		Set-Content $caller @'
param($DbTarget, $Dotnet, $ProjectDir, $Operation, $Log)
$names = 'ConnectionStrings__VetiFlowDatabase', 'ASPNETCORE_ConnectionStrings__VetiFlowDatabase', 'ASPNETCORE_ENVIRONMENT', 'ASPNETCORE_URLS'
function Get-Snapshot { $names | ForEach-Object { "$_=$([Environment]::GetEnvironmentVariable($_))" } }
$before = @(Get-Snapshot)
$parameters = @{ Dotnet = $Dotnet; ProjectDir = $ProjectDir; $Operation = $true }
& $DbTarget @parameters | Out-Null
@{ Exit = $LASTEXITCODE; Before = $before; After = @(Get-Snapshot) } | ConvertTo-Json | Set-Content $Log
'@
		foreach ($operation in 'Migrate', 'StartApp') {
			Remove-Item $fakeLog, $callerLog -ErrorAction SilentlyContinue
			$result = Invoke-Captured $powershellExe "-NoProfile -ExecutionPolicy Bypass -File `"$caller`" -DbTarget `"$dbTarget`" -Dotnet `"$fakeDotnet`" -ProjectDir `"$callerProject`" -Operation $operation -Log `"$callerLog`"" '' @{ ASPNETCORE_ConnectionStrings__VetiFlowDatabase = 'Host=db.example.invalid'; ASPNETCORE_ENVIRONMENT = 'Production'; VETIFLOW_FAKE_DOTNET_LOG = $fakeLog }
			$received = if (Test-Path $fakeLog) { Get-Content -Raw $fakeLog | ConvertFrom-Json }
			$callerState = if (Test-Path $callerLog) { Get-Content -Raw $callerLog | ConvertFrom-Json }
			Assert-True ($callerState -and $callerState.Exit -eq 0 -and $received -and $received.Bound -ceq 'Host=localhost;Password=fixture-pw') "db-target -$operation run with & binds the checked string for the child"
			Assert-True ($callerState -and -not (Compare-Object @($callerState.Before) @($callerState.After) -SyncWindow 0 -CaseSensitive)) "db-target -$operation run with & gives the caller its environment back"
		}

		$result = Invoke-DbTarget "-Migrate -StartApp -Dotnet `"$fakeDotnet`"" @{ ConnectionStrings__VetiFlowDatabase = $localValue; VETIFLOW_FAKE_DOTNET_LOG = $fakeLog }
		Assert-True ($result.ExitCode -eq 3) 'db-target refuses two operations at once'
	}
	finally {
		Remove-Item -Recurse -Force $fakeRoot
	}

	$result = Invoke-DbTarget '-Tests' @{ VETIFLOW_TEST_POSTGRES = 'Host=db.example.invalid;Password=fixture-pw' }
	Assert-True ($result.ExitCode -eq 1 -and $result.Output.Trim() -eq 'Database target: NOT local') 'db-target -Tests reads VETIFLOW_TEST_POSTGRES'
	$result = Invoke-DbTarget '-Tests' @{}
	Assert-True ($result.ExitCode -eq 0 -and $result.Output.Trim() -eq 'Database target: local') 'db-target -Tests without the variable means Testcontainers (local)'

	# Source precedence, with a fixture project and a fake APPDATA holding fake user
	# secrets. All of it lives in TEMP, so the real user secrets are never opened.
	$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) "vetiflow-db-target-$PID"
	$projectDir = Join-Path $fixtureRoot 'project'
	$appData = Join-Path $fixtureRoot 'appdata'
	$secretsDir = Join-Path $appData 'Microsoft/UserSecrets/fixture-secrets-id'
	New-Item -ItemType Directory -Force $projectDir, $secretsDir | Out-Null
	$fakeAppData = @{ APPDATA = $appData }
	$localJson = '{ "ConnectionStrings": { "VetiFlowDatabase": "Host=localhost;Password=fixture-pw" } }'
	$remoteJson = '{ "ConnectionStrings": { "VetiFlowDatabase": "Host=db.example.invalid;Password=fixture-pw" } }'
	try {
		Set-Content (Join-Path $projectDir 'fixture.csproj') '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><UserSecretsId>fixture-secrets-id</UserSecretsId></PropertyGroup></Project>'
		$result = Invoke-DbTarget "-ProjectDir `"$projectDir`"" $fakeAppData
		Assert-True ($result.ExitCode -eq 2 -and $result.Output.Trim() -eq 'Database target: not configured') 'db-target reports not configured'

		Set-Content (Join-Path $projectDir 'appsettings.json') $remoteJson
		$result = Invoke-DbTarget "-ProjectDir `"$projectDir`"" $fakeAppData
		Assert-True ($result.ExitCode -eq 1) 'db-target reads appsettings.json last'

		Set-Content (Join-Path $projectDir 'appsettings.Development.json') $localJson
		$result = Invoke-DbTarget "-ProjectDir `"$projectDir`"" $fakeAppData
		Assert-True ($result.ExitCode -eq 0) 'db-target prefers appsettings.Development.json over appsettings.json'

		Set-Content (Join-Path $secretsDir 'secrets.json') '{ "ConnectionStrings:VetiFlowDatabase": "Host=db.example.invalid;Password=fixture-pw" }'
		$result = Invoke-DbTarget "-ProjectDir `"$projectDir`"" $fakeAppData
		Assert-True ($result.ExitCode -eq 1) 'db-target prefers user secrets over appsettings files'

		$result = Invoke-DbTarget "-ProjectDir `"$projectDir`"" @{ APPDATA = $appData; ConnectionStrings__VetiFlowDatabase = 'Host=localhost' }
		Assert-True ($result.ExitCode -eq 0) 'db-target prefers the environment variable over user secrets'

		Set-Content (Join-Path $secretsDir 'secrets.json') '{ not json fixture-pw'
		$result = Invoke-DbTarget "-ProjectDir `"$projectDir`"" $fakeAppData
		Assert-True ($result.ExitCode -eq 1 -and $result.Output.Trim() -eq 'Database target: NOT local') 'db-target fails safe on unreadable configuration'
		Assert-True ($result.Output -notmatch 'fixture-pw') 'db-target does not quote unreadable configuration'
	}
	finally {
		Remove-Item -Recurse -Force $fixtureRoot
	}
}

# --- Shared Claude settings ----------------------------------------------------

$settingsPath = Join-Path $repoRoot '.claude/settings.json'
Assert-True (Test-Path $settingsPath) '.claude/settings.json exists'

if (Test-Path $settingsPath) {
	$settings = Get-Content -Raw $settingsPath | ConvertFrom-Json
	$deny = @($settings.permissions.deny)
	$requiredDeny = @(
		'Read(.env)', 'Read(.env.*)', 'Edit(.env)', 'Edit(.env.*)',
		'Read(~/AppData/Roaming/Microsoft/UserSecrets/**)', 'Edit(~/AppData/Roaming/Microsoft/UserSecrets/**)',
		'Read(~/.microsoft/usersecrets/**)', 'Edit(~/.microsoft/usersecrets/**)',
		'Bash(dotnet user-secrets list*)', 'PowerShell(dotnet user-secrets list*)',
		'Bash(printenv*)', 'Bash(env)', 'PowerShell(Get-ChildItem env:*)'
	)
	foreach ($rule in $requiredDeny) { Assert-True ($deny -contains $rule) "settings deny rule: $rule" }

	# A carve-out only works after the rule it reopens, in the same list.
	foreach ($tool in 'Read', 'Edit') {
		$carveOut = [array]::IndexOf($deny, "$tool(!.env.example)")
		Assert-True ($carveOut -gt [array]::IndexOf($deny, "$tool(.env.*)")) "settings keep .env.example open to $tool"
	}

	$hookEntries = @($settings.hooks.PreToolUse | Where-Object { $_.matcher -eq 'Bash|PowerShell' })
	$hookCommands = @($hookEntries | ForEach-Object { $_.hooks })
	$secretHook = @($hookCommands | Where-Object { $_.command -eq 'node' -and ($_.args -join ' ') -match 'block-secret-commands\.mjs' })
	Assert-True ($secretHook.Count -eq 1) 'settings run the hook with node for Bash and PowerShell'
	# These only show the settings say so. That Claude Code then blocks a hook that
	# can't run is checked through the real engine in /check (the probe hooks).
	Assert-True ($secretHook.Count -eq 1 -and $secretHook[0].onFailure -eq 'block') 'settings block the call when the hook fails'
	Assert-True ($secretHook.Count -eq 1 -and $secretHook[0].timeout -gt 0 -and $secretHook[0].timeout -le 30) 'settings give the hook a short timeout'
}

# --- Integration fixture scripts -----------------------------------------------

$newFixture = Join-Path $repoRoot 'scripts/tests/integration/new-fixture.ps1'
$removeFixture = Join-Path $repoRoot 'scripts/tests/integration/remove-fixture.ps1'
Assert-True ((Test-Path $newFixture) -and (Test-Path $removeFixture)) 'integration fixture scripts exist'

if ((Test-Path $newFixture) -and (Test-Path $removeFixture)) {
	# Copies of the scripts in a fake repo layout in TEMP, run with no root
	# argument: this checks the default root they find from their own folder,
	# and the real .claude/settings.local.json is never touched.
	$fakeRepo = Join-Path ([System.IO.Path]::GetTempPath()) "vetiflow-fixture-repo-$PID"
	$fakeTemp = Join-Path ([System.IO.Path]::GetTempPath()) "vetiflow-fixture-temp-$PID"
	$fakeIntegration = Join-Path $fakeRepo 'scripts/tests/integration'
	function Invoke-Fixture([string]$Script) {
		$copy = Join-Path $fakeIntegration (Split-Path -Leaf $Script)
		Invoke-Captured $powershellExe "-NoProfile -ExecutionPolicy Bypass -File `"$copy`" -TempRoot `"$fakeTemp`"" ''
	}
	try {
		New-Item -ItemType Directory -Force $fakeIntegration | Out-Null
		Copy-Item $newFixture, $removeFixture $fakeIntegration
		$first = Invoke-Fixture $newFixture
		$second = Invoke-Fixture $newFixture
		Assert-True ($first.ExitCode -eq 0 -and $second.ExitCode -eq 0) 'new-fixture runs twice'
		Assert-True ((Test-Path (Join-Path $fakeRepo 'scripts/tests/fixtures')) -and (Test-Path (Join-Path $fakeRepo '.claude/settings.local.json'))) 'new-fixture finds the repo root by default'
		Assert-True (-not (Test-Path (Join-Path $fakeRepo 'scripts/scripts')) -and -not (Test-Path (Join-Path $fakeRepo 'scripts/.claude'))) 'new-fixture writes nothing under scripts/ by default'

		$fixtureFiles = @(Get-ChildItem -Force (Join-Path $fakeRepo 'scripts/tests/fixtures') -Filter '.env*' -ErrorAction SilentlyContinue)
		Assert-True ($fixtureFiles.Count -eq 2) 'new-fixture writes the two dotenv-style fixtures'
		foreach ($file in $fixtureFiles) {
			Assert-True ((Get-Content -Raw $file.FullName) -match 'FIXTURE_ONLY=not-a-secret' -and (Get-Content $file.FullName).Count -eq 2) "fixture holds only fake content: $($file.Name)"
		}
		$projectPath = Join-Path $fakeTemp 'synthetic-project/Synthetic.csproj'
		$project = if (Test-Path $projectPath) { Get-Content -Raw $projectPath } else { '' }
		Assert-True ($project -match '<UserSecretsId>vetiflow-fixture-[0-9a-f-]{36}</UserSecretsId>' -and $project -notmatch '3764f154') 'synthetic project has its own random UserSecretsId'

		$probeSettings = Join-Path $fakeRepo '.claude/settings.local.json'
		$probes = if (Test-Path $probeSettings) { @((Get-Content -Raw $probeSettings | ConvertFrom-Json).hooks.PreToolUse[0].hooks) } else { @() }
		Assert-True ($probes.Count -eq 4 -and @($probes | Where-Object { $_.onFailure -eq 'block' -and $_.if -match '^Bash\(echo onfailure-' }).Count -eq 4) 'probe hooks block on failure and only match echo probes'

		$removed = Invoke-Fixture $removeFixture
		$removedAgain = Invoke-Fixture $removeFixture
		Assert-True ($removed.ExitCode -eq 0 -and $removedAgain.ExitCode -eq 0) 'remove-fixture runs twice'
		Assert-True (-not (Test-Path (Join-Path $fakeRepo 'scripts/tests/fixtures')) -and -not (Test-Path $fakeTemp) -and -not (Test-Path (Join-Path $fakeRepo '.claude/settings.local.json'))) 'remove-fixture removes what it created'

		# An existing settings.local.json belongs to the person: never changed or removed.
		New-Item -ItemType Directory -Force (Join-Path $fakeRepo '.claude') | Out-Null
		Set-Content (Join-Path $fakeRepo '.claude/settings.local.json') '{ "theirs": true }'
		Invoke-Fixture $newFixture | Out-Null
		Invoke-Fixture $removeFixture | Out-Null
		Assert-True ((Get-Content -Raw (Join-Path $fakeRepo '.claude/settings.local.json')).Trim() -eq '{ "theirs": true }') 'fixture scripts leave an existing settings.local.json alone'
	}
	finally {
		foreach ($path in $fakeRepo, $fakeTemp) { if (Test-Path $path) { Remove-Item -Recurse -Force $path } }
	}
}

# --- Docker build context ------------------------------------------------------

$dockerIgnorePath = Join-Path $repoRoot 'vetiflow.Server/.dockerignore'
Assert-True (Test-Path $dockerIgnorePath) 'vetiflow.Server/.dockerignore exists'

if (Test-Path $dockerIgnorePath) {
	$ignored = Get-Content $dockerIgnorePath | ForEach-Object { $_.Trim() }
	foreach ($entry in 'bin/', 'obj/', '*.user', '.env', '.env.*', 'appsettings.*.local.json', '**/secrets.json') {
		Assert-True ($ignored -contains $entry) ".dockerignore excludes $entry"
	}
}

# --- Result --------------------------------------------------------------------

if ($failures.Count -gt 0) {
	Write-Host "Secret guardrails: $($failures.Count) of $checkCount checks failed"
	foreach ($name in $failures) { Write-Host "  FAIL  $name" }
	exit 1
}
Write-Host "Secret guardrails: all $checkCount checks passed"
exit 0
