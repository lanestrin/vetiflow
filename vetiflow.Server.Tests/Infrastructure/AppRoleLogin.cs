using Npgsql;

namespace vetiflow.Server.Tests.Infrastructure;

// A login that is a member of vetiflow_app, as production's API user is, for
// starting a host that runs as the app role. Roles are server-wide, so the
// name and password are generated and the role is dropped on dispose.
public sealed class AppRoleLogin : IAsyncDisposable
{
	private readonly string _adminConnectionString;
	private readonly string _role;

	private AppRoleLogin(string adminConnectionString, string role, string connectionString)
	{
		_adminConnectionString = adminConnectionString;
		_role = role;
		ConnectionString = connectionString;
	}

	public string ConnectionString { get; }

	// vetiflow_app itself comes from the AddAppRole migration, which the shared
	// VetiFlowApiFactory has already run on this server.
	public static async Task<AppRoleLogin> CreateAsync(string adminConnectionString)
	{
		// Generated hex only: role names and passwords can't be SQL parameters.
		var role = $"app_login_{Guid.NewGuid():N}";
		var password = Guid.NewGuid().ToString("N");
		await ExecuteAsync(adminConnectionString, $"CREATE ROLE {role} LOGIN PASSWORD '{password}' IN ROLE vetiflow_app;");

		var connectionString = new NpgsqlConnectionStringBuilder(adminConnectionString)
		{
			Username = role,
			Password = password
		}.ConnectionString;

		return new AppRoleLogin(adminConnectionString, role, connectionString);
	}

	public async ValueTask DisposeAsync()
	{
		// Close the login's pooled connections first, so nothing holds the role.
		await using (var connection = new NpgsqlConnection(ConnectionString))
		{
			NpgsqlConnection.ClearPool(connection);
		}

		await ExecuteAsync(_adminConnectionString, $"DROP ROLE IF EXISTS {_role};");
	}

	private static async Task ExecuteAsync(string connectionString, string sql)
	{
		await using var dataSource = NpgsqlDataSource.Create(connectionString);
		await using var command = dataSource.CreateCommand(sql);
		await command.ExecuteNonQueryAsync();
	}
}
