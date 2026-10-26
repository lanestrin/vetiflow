<#
.SYNOPSIS
  Checks that the app's database is local, and runs migrations or the app bound
  to exactly the connection string it checked. Never shows the string.

.DESCRIPTION
  Prints one line and never the host, user, database name or password:

    Database target: local           exit 0
    Database target: NOT local       exit 1  (also for a malformed string, a
                                              string with no host, or
                                              configuration that can't be read)
    Database target: not configured  exit 2

  A plain check authorizes nothing: dotnet ef or the app could still pick another
  string from another environment, launch profile or argument. To act on a
  database, use -Migrate or -StartApp. They run the operation only after
  "local", with the checked string bound as its highest-precedence source:

    -Migrate   dotnet ef database update --project vetiflow.Server
    -StartApp  dotnet run --project vetiflow.Server --no-launch-profile

  The string goes to the child in ConnectionStrings__VetiFlowDatabase, never on
  the command line: Windows PowerShell 5.1 strips embedded quotes from native
  arguments, which could turn Password="a;Host=x" into a real Host=x. Environment
  variables beat user secrets and appsettings, and neither command adds a
  command-line override. Competing variables (*CONNSTR_VetiFlowDatabase and the
  ASPNETCORE_ / DOTNET_ prefixed forms) are removed for the child. -StartApp
  loads no launch profile, because a profile's commandLineArgs and
  environmentVariables are applied after ours; it sets ASPNETCORE_ENVIRONMENT
  and ASPNETCORE_URLS itself instead.

  App sources, first found wins, as the app and dotnet ef read them in
  Development: ConnectionStrings__VetiFlowDatabase, user secrets,
  appsettings.Development.json, appsettings.json. With -Tests:
  VETIFLOW_TEST_POSTGRES, or Testcontainers (local) when it is unset.

  Parsing uses System.Data.Common.DbConnectionStringBuilder, the ADO.NET parser
  that Npgsql's builder inherits (Npgsql itself doesn't load in Windows
  PowerShell 5.1). Npgsql treats Server as a synonym of Host; the order of the two
  is lost in parsing, so every Host and Server value must be local.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/db-target.ps1
  powershell -ExecutionPolicy Bypass -File scripts/db-target.ps1 -Migrate
  powershell -ExecutionPolicy Bypass -File scripts/db-target.ps1 -StartApp
#>
param(
	[switch]$Tests,
	[switch]$Migrate,
	[switch]$StartApp,
	# Only for the regression checks, which point these at fixtures.
	[string]$ProjectDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'vetiflow.Server'),
	[string]$Dotnet = 'dotnet'
)

$ErrorActionPreference = 'Stop'
$localHosts = 'localhost', '127.0.0.1', '::1', 'host.docker.internal'

if (@($Tests, $Migrate, $StartApp | Where-Object { $_ }).Count -gt 1) {
	Write-Output 'Use only one of -Tests, -Migrate and -StartApp.'
	exit 3
}

function Read-ConnectionString([string]$JsonPath) {
	if (-not (Test-Path $JsonPath)) { return $null }
	$settings = Get-Content -Raw $JsonPath | ConvertFrom-Json
	# User secrets store flat keys; appsettings files nest them.
	$flat = $settings.'ConnectionStrings:VetiFlowDatabase'
	if ($flat) { return $flat }
	return $settings.ConnectionStrings.VetiFlowDatabase
}

function Find-AppConnectionString {
	if ($env:ConnectionStrings__VetiFlowDatabase) { return $env:ConnectionStrings__VetiFlowDatabase }

	$project = Get-ChildItem $ProjectDir -Filter *.csproj | Select-Object -First 1
	$secretsId = ([xml](Get-Content -Raw $project.FullName)).Project.PropertyGroup.UserSecretsId |
		Where-Object { $_ } | Select-Object -First 1
	if ($secretsId) {
		$secretsRoot = if ($env:APPDATA) { Join-Path $env:APPDATA 'Microsoft/UserSecrets' } else { Join-Path $HOME '.microsoft/usersecrets' }
		$value = Read-ConnectionString (Join-Path $secretsRoot "$secretsId/secrets.json")
		if ($value) { return $value }
	}

	foreach ($file in 'appsettings.Development.json', 'appsettings.json') {
		$value = Read-ConnectionString (Join-Path $ProjectDir $file)
		if ($value) { return $value }
	}
	return $null
}

function Test-LocalTarget([string]$ConnectionString) {
	# Throws on a malformed string; the caller treats that as NOT local.
	$builder = New-Object System.Data.Common.DbConnectionStringBuilder
	# The setter, not "$builder.ConnectionString = ...": PowerShell treats the
	# builder as a dictionary and would store a key named ConnectionString.
	$builder.set_ConnectionString($ConnectionString)

	$hostValues = @('host', 'server' | Where-Object { $builder.ContainsKey($_) } | ForEach-Object { [string]$builder[$_] })
	if ($hostValues.Count -eq 0) { return $false }

	foreach ($hostName in ($hostValues -join ',') -split ',') {
		$name = $hostName.Trim()
		# [::1]:5432 or [::1]; host:port; but a bare IPv6 address such as ::1 has no port.
		if ($name -match '^\[(.*)\](:\d+)?$') { $name = $Matches[1] }
		elseif (($name.ToCharArray() | Where-Object { $_ -eq ':' }).Count -eq 1) { $name = $name.Split(':')[0] }
		if ($localHosts -notcontains $name.ToLowerInvariant()) { return $false }
	}
	return $true
}

# Any error message could quote a configuration file, so every failure path
# prints a fixed line instead.
try {
	if ($Tests) {
		if (-not $env:VETIFLOW_TEST_POSTGRES) {
			Write-Output 'Database target: local'
			exit 0
		}
		$connectionString = $env:VETIFLOW_TEST_POSTGRES
	}
	else {
		$connectionString = Find-AppConnectionString
	}

	if (-not $connectionString) {
		Write-Output 'Database target: not configured'
		exit 2
	}
	$isLocal = Test-LocalTarget $connectionString
}
catch {
	$isLocal = $false
}

if (-not $isLocal) {
	Write-Output 'Database target: NOT local'
	exit 1
}
Write-Output 'Database target: local'
if (-not ($Migrate -or $StartApp)) { exit 0 }

# Bind the checked string for the child: only this name, nothing that competes.
# Each change is undone afterwards, so a caller that ran this script with & (not
# -File) gets its own environment back and no connection string stays in it.
$saved = @{}
# PowerShell passes $null to a .NET string parameter as "". Windows treats ""
# as remove, but Linux keeps an empty variable, so a removal passes a real null.
function Set-ProcessVariable([string]$Name, $Value) {
	if ($null -eq $Value) { [Environment]::SetEnvironmentVariable($Name, [NullString]::Value) }
	else { [Environment]::SetEnvironmentVariable($Name, $Value) }
}
function Set-ChildVariable([string]$Name, $Value) {
	if (-not $saved.ContainsKey($Name)) { $saved[$Name] = [Environment]::GetEnvironmentVariable($Name) }
	Set-ProcessVariable $Name $Value
}
try {
	foreach ($name in @([Environment]::GetEnvironmentVariables().Keys)) {
		if ($name -match '(?i)^((ASPNETCORE|DOTNET)_)?ConnectionStrings(__|:)VetiFlowDatabase$|CONNSTR_VetiFlowDatabase$') {
			Set-ChildVariable $name $null
		}
	}
	Set-ChildVariable 'ConnectionStrings__VetiFlowDatabase' $connectionString

	if ($Migrate) { & $Dotnet ef database update --project $ProjectDir }
	else {
		# No launch profile: dotnet run applies a profile's commandLineArgs and
		# environmentVariables after ours, and either could name another database.
		# These are the two settings the https profile supplied.
		Set-ChildVariable 'ASPNETCORE_ENVIRONMENT' 'Development'
		Set-ChildVariable 'ASPNETCORE_URLS' 'https://localhost:7274;http://localhost:5112'
		& $Dotnet run --project $ProjectDir --no-launch-profile
	}
	$exitCode = $LASTEXITCODE
}
finally {
	foreach ($name in $saved.Keys) { Set-ProcessVariable $name $saved[$name] }
}
exit $exitCode
