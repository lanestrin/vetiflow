using Npgsql;
using Testcontainers.PostgreSql;

namespace vetiflow.Server.Tests.Infrastructure;

// A PostgreSQL server shared by the whole test run. Each caller gets its own
// database, so tests never see each other's schema changes.
//
// By default the server runs in a throwaway Docker container. Set
// VETIFLOW_TEST_POSTGRES to an existing server's connection string (for
// example a local install) to run without Docker; the databases created on
// it are dropped when the run ends.
public sealed class PostgresServer : IAsyncDisposable
{
	public const string ConnectionStringVariable = "VETIFLOW_TEST_POSTGRES";

	private readonly PostgreSqlContainer? _container;
	private readonly string _adminConnectionString;
	private readonly List<string> _databases = [];

	private PostgresServer(PostgreSqlContainer? container, string adminConnectionString)
	{
		_container = container;
		_adminConnectionString = adminConnectionString;
	}

	public static async Task<PostgresServer> StartAsync()
	{
		var external = Environment.GetEnvironmentVariable(ConnectionStringVariable);

		if (!string.IsNullOrWhiteSpace(external))
		{
			return new PostgresServer(null, external);
		}

		var container = new PostgreSqlBuilder("postgres:17-alpine").Build();

		await container.StartAsync();

		return new PostgresServer(container, container.GetConnectionString());
	}

	public async Task<string> CreateDatabaseAsync()
	{
		var name = $"vetiflow_test_{Guid.NewGuid():N}";

		await ExecuteAsync($"CREATE DATABASE \"{name}\"");

		lock (_databases)
		{
			_databases.Add(name);
		}

		return new NpgsqlConnectionStringBuilder(_adminConnectionString)
		{
			Database = name
		}.ConnectionString;
	}

	public async ValueTask DisposeAsync()
	{
		if (_container is not null)
		{
			await _container.DisposeAsync();
			return;
		}

		NpgsqlConnection.ClearAllPools();

		foreach (var name in _databases)
		{
			await ExecuteAsync($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)");
		}
	}

	private async Task ExecuteAsync(string sql)
	{
		await using var dataSource = NpgsqlDataSource.Create(_adminConnectionString);
		await using var command = dataSource.CreateCommand(sql);

		await command.ExecuteNonQueryAsync();
	}
}
