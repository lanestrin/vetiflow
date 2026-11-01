using Microsoft.EntityFrameworkCore;
using Npgsql;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Data;

// The case tag rules that the database itself enforces (build plan 3.5a): the
// controller checks the same limits first, but a row that breaks them never
// reaches the table.
public class CaseTagTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task Tag_SavesAndReloadsWithToneAndCreator()
	{
		var emergencyCase = await SaveCaseAsync();
		var staff = TestData.StaffMember(StaffRole.Veterinarian);
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.StaffMembers.Add(staff);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}
		var tag = new CaseTag
		{
			EmergencyCaseId = emergencyCase.Id,
			Text = "O2 support",
			Tone = CaseTagTone.Caution,
			CreatedByStaffId = staff.Id
		};
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.CaseTags.Add(tag);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}

		await using var reloaded = factory.CreateDbContext();
		var saved = await reloaded.CaseTags
			.Include(t => t.CreatedByStaff)
			.SingleAsync(t => t.Id == tag.Id, _cancellationToken);
		Assert.Equal("O2 support", saved.Text);
		Assert.Equal(CaseTagTone.Caution, saved.Tone);
		Assert.Equal("Staff", saved.CreatedByStaff?.FirstName);
	}

	[Fact]
	public async Task Tag_BlankText_IsRefusedByTheDatabase()
	{
		var emergencyCase = await SaveCaseAsync();

		await using var dbContext = factory.CreateDbContext();
		dbContext.CaseTags.Add(new CaseTag { EmergencyCaseId = emergencyCase.Id, Text = "   ", Tone = CaseTagTone.Info });

		await AssertDatabaseErrorAsync(
			() => dbContext.SaveChangesAsync(_cancellationToken),
			PostgresErrorCodes.CheckViolation,
			"CK_CaseTags_TextNotBlank");
	}

	[Fact]
	public async Task Tag_TextLongerThanTheLimit_IsRefusedByTheDatabase()
	{
		var emergencyCase = await SaveCaseAsync();

		await using var dbContext = factory.CreateDbContext();
		dbContext.CaseTags.Add(new CaseTag
		{
			EmergencyCaseId = emergencyCase.Id,
			Text = new string('a', CaseTagRules.MaxTextLength + 1),
			Tone = CaseTagTone.Neutral
		});

		await AssertDatabaseErrorAsync(
			() => dbContext.SaveChangesAsync(_cancellationToken),
			PostgresErrorCodes.StringDataRightTruncation,
			constraintName: null);
	}

	private async Task<EmergencyCase> SaveCaseAsync()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}

	// SaveChanges wraps the database error in a DbUpdateException.
	private static async Task AssertDatabaseErrorAsync(
		Func<Task> action,
		string sqlState,
		string? constraintName)
	{
		var exception = await Record.ExceptionAsync(action);

		var postgresException = Assert.IsType<PostgresException>(
			exception is DbUpdateException ? exception.InnerException : exception);
		Assert.Equal(sqlState, postgresException.SqlState);
		if (constraintName is not null)
		{
			Assert.Equal(constraintName, postgresException.ConstraintName);
		}
	}
}
