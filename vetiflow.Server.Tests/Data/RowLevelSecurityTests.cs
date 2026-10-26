using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Data;

// Supabase serves every table in "public" to its anon and authenticated roles
// through the REST and GraphQL APIs. Row level security with no policies
// leaves those roles nothing, while the API (the tables' owner) is unaffected.
public class RowLevelSecurityTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	// Fails when a migration adds a table without enabling row level security.
	[Fact]
	public async Task EveryPublicTable_HasRowLevelSecurity()
	{
		await using var dbContext = factory.CreateDbContext();

		var unprotected = await dbContext.Database
			.SqlQueryRaw<string>("""
				SELECT c.relname AS "Value"
				FROM pg_class c
				JOIN pg_namespace n ON n.oid = c.relnamespace
				WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
				""")
			.ToListAsync(_cancellationToken);

		Assert.Empty(unprotected);
	}

	// A role granted SELECT, as Supabase grants anon, must still read nothing.
	[Fact]
	public async Task NonOwnerRole_ReadsNoRows()
	{
		await using (var setup = factory.CreateDbContext())
		{
			setup.EmergencyCases.Add(TestData.Case(TestData.Patient()));
			await setup.SaveChangesAsync(_cancellationToken);
		}

		await using var dbContext = factory.CreateDbContext();
		// Everything below rolls back, the role included: CREATE ROLE is
		// transactional in Postgres, so nothing outlives the test.
		await using var transaction = await dbContext.Database.BeginTransactionAsync(_cancellationToken);
		// Role names cannot be SQL parameters; this one is generated hex only.
		var role = $"rls_probe_{Guid.NewGuid():N}";
		var createRole = $"""
			CREATE ROLE {role} NOLOGIN;
			GRANT USAGE ON SCHEMA public TO {role};
			GRANT SELECT ON "EmergencyCases" TO {role};
			""";
		var switchToRole = $"SET LOCAL ROLE {role};";

		await dbContext.Database.ExecuteSqlRawAsync(createRole, _cancellationToken);
		var ownerCount = await CountCasesAsync(dbContext);

		await dbContext.Database.ExecuteSqlRawAsync(switchToRole, _cancellationToken);
		var roleCount = await CountCasesAsync(dbContext);

		Assert.True(ownerCount > 0, "The owner should see the case just saved.");
		Assert.Equal(0, roleCount);
	}

	private Task<int> CountCasesAsync(VetiFlowDbContext dbContext) =>
		dbContext.Database
			.SqlQueryRaw<int>("""SELECT count(*)::int AS "Value" FROM "EmergencyCases" """)
			.SingleAsync(_cancellationToken);
}
