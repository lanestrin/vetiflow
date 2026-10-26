using Microsoft.EntityFrameworkCore;
using Npgsql;
using vetiflow.Server.Data;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Data;

// In production the API connects as vetiflow_app: it reads and writes rows but
// owns no table, so it cannot change the schema. Each test switches to the role
// inside a transaction that rolls back, so nothing it does outlives the test.
public class AppRoleTests(VetiFlowApiFactory factory)
{
	private const string AppRole = "vetiflow_app";
	private const string InsufficientPrivilege = "42501";

	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	// Fails when a migration adds a table without AppRoleAccess.Grant.
	[Fact]
	public async Task EveryPublicTable_HasAppRolePolicy()
	{
		await using var dbContext = factory.CreateDbContext();

		var withoutAccess = await dbContext.Database
			.SqlQueryRaw<string>($"""
				SELECT c.relname AS "Value"
				FROM pg_class c
				JOIN pg_namespace n ON n.oid = c.relnamespace
				WHERE n.nspname = 'public' AND c.relkind = 'r'
				  AND (NOT has_table_privilege('{AppRole}', c.oid, 'SELECT')
				    OR NOT EXISTS (
				      SELECT 1 FROM pg_policies p
				      WHERE p.schemaname = 'public' AND p.tablename = c.relname
				        AND '{AppRole}' = ANY (p.roles)))
				""")
			.ToListAsync(_cancellationToken);

		Assert.Empty(withoutAccess);
	}

	[Fact]
	public async Task AppRole_ReadsAndWritesCases()
	{
		await AsAppRoleAsync(async dbContext =>
		{
			var emergencyCase = TestData.Case(TestData.Patient());
			dbContext.EmergencyCases.Add(emergencyCase);
			await dbContext.SaveChangesAsync(_cancellationToken);

			emergencyCase.Stage = CaseStage.Treatment;
			await dbContext.SaveChangesAsync(_cancellationToken);

			var saved = await dbContext.EmergencyCases
				.AsNoTracking()
				.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);
			Assert.Equal(CaseStage.Treatment, saved.Stage);
		});
	}

	// Granted for now; build plan 8.13 revokes it once the schema is final.
	[Fact]
	public async Task AppRole_CanDeleteRows()
	{
		await AsAppRoleAsync(async dbContext =>
		{
			var room = new Room { Name = $"Probe {Guid.NewGuid():N}", Type = RoomType.Exam };
			dbContext.Rooms.Add(room);
			await dbContext.SaveChangesAsync(_cancellationToken);

			dbContext.Rooms.Remove(room);
			await dbContext.SaveChangesAsync(_cancellationToken);

			Assert.False(await dbContext.Rooms.AnyAsync(r => r.Id == room.Id, _cancellationToken));
		});
	}

	// Startup reads the history to refuse a schema with pending migrations.
	[Fact]
	public async Task AppRole_CanReadMigrationHistory()
	{
		await AsAppRoleAsync(async dbContext =>
		{
			var applied = await dbContext.Database.GetAppliedMigrationsAsync(_cancellationToken);

			Assert.NotEmpty(applied);
		});
	}

	[Fact]
	public async Task AppRole_CannotWriteMigrationHistory()
	{
		await AsAppRoleAsync(async dbContext =>
		{
			var exception = await Assert.ThrowsAsync<PostgresException>(() =>
				dbContext.Database.ExecuteSqlRawAsync(
					"""INSERT INTO "__EFMigrationsHistory" VALUES ('99999999999999_Probe', '10.0.0')""",
					_cancellationToken));

			Assert.Equal(InsufficientPrivilege, exception.SqlState);
		});
	}

	[Theory]
	[InlineData("""CREATE TABLE "Probe" ("Id" uuid PRIMARY KEY)""")]
	[InlineData("""ALTER TABLE "EmergencyCases" ADD COLUMN "Probe" text""")]
	[InlineData("""DROP TABLE "Rooms" """)]
	public async Task AppRole_CannotChangeSchema(string statement)
	{
		await AsAppRoleAsync(async dbContext =>
		{
			var exception = await Assert.ThrowsAsync<PostgresException>(() =>
				dbContext.Database.ExecuteSqlRawAsync(statement, _cancellationToken));

			Assert.Equal(InsufficientPrivilege, exception.SqlState);
		});
	}

	private async Task AsAppRoleAsync(Func<VetiFlowDbContext, Task> test)
	{
		await using var dbContext = factory.CreateDbContext();
		await using var transaction = await dbContext.Database.BeginTransactionAsync(_cancellationToken);
		await dbContext.Database.ExecuteSqlRawAsync($"SET LOCAL ROLE {AppRole};", _cancellationToken);

		await test(dbContext);
	}
}
