using Microsoft.EntityFrameworkCore;
using Npgsql;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Data;

// The database, not just the code, decides what a valid account is: the
// experience comes from the link, so a wrong or missing link must not save.
public class AccountConstraintTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task TeamMember_WithStaffLink_IsSaved()
	{
		var account = TestData.TeamMemberAccount(TestData.StaffMember(StaffRole.Veterinarian));

		await SaveAsync(account);

		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.Accounts.SingleAsync(a => a.Id == account.Id, _cancellationToken);
		Assert.Equal(AccountKind.TeamMember, saved.Kind);
		Assert.True(saved.IsActive);
	}

	[Fact]
	public async Task PetParent_WithOwnerLink_IsSaved()
	{
		var account = TestData.PetParentAccount(TestData.Owner());

		await SaveAsync(account);

		await using var dbContext = factory.CreateDbContext();
		Assert.True(await dbContext.Accounts.AnyAsync(a => a.Id == account.Id, _cancellationToken));
	}

	[Theory]
	[InlineData("team member linked to an owner")]
	[InlineData("pet parent linked to a staff member")]
	[InlineData("both links")]
	[InlineData("no link")]
	public async Task Account_WithLinkThatDoesNotMatchKind_IsRejected(string shape)
	{
		var account = shape switch
		{
			"team member linked to an owner" => Relink(
				TestData.TeamMemberAccount(TestData.StaffMember(StaffRole.Technician)), staff: null, owner: TestData.Owner()),
			"pet parent linked to a staff member" => Relink(
				TestData.PetParentAccount(TestData.Owner()), staff: TestData.StaffMember(StaffRole.Technician), owner: null),
			"both links" => Relink(
				TestData.TeamMemberAccount(TestData.StaffMember(StaffRole.Technician)), TestData.StaffMember(StaffRole.Technician), TestData.Owner()),
			_ => Relink(
				TestData.TeamMemberAccount(TestData.StaffMember(StaffRole.Technician)), staff: null, owner: null)
		};

		await AssertRejectedAsync(account, PostgresErrorCodes.CheckViolation, "CK_Accounts_KindMatchesLink");
	}

	[Fact]
	public async Task Account_WithoutEmailOrPhone_IsRejected()
	{
		var account = TestData.TeamMemberAccount(TestData.StaffMember(StaffRole.Technician));
		account.Email = null;
		account.PhoneNumber = null;

		await AssertRejectedAsync(account, PostgresErrorCodes.CheckViolation, "CK_Accounts_HasEmailOrPhone");
	}

	[Fact]
	public async Task Account_WithUpperCaseEmail_IsRejected()
	{
		var account = TestData.TeamMemberAccount(TestData.StaffMember(StaffRole.Technician));
		account.Email = account.Email!.ToUpperInvariant();

		await AssertRejectedAsync(account, PostgresErrorCodes.CheckViolation, "CK_Accounts_EmailLowerCase");
	}

	[Theory]
	[InlineData("3125550101")]
	[InlineData("+1 312-555-0101")]
	[InlineData("+4420795600")]
	[InlineData("+131255501")]
	public async Task Account_WithBadPhoneFormat_IsRejected(string phoneNumber)
	{
		var account = TestData.TeamMemberAccount(TestData.StaffMember(StaffRole.Technician));
		account.PhoneNumber = phoneNumber;

		await AssertRejectedAsync(account, PostgresErrorCodes.CheckViolation, "CK_Accounts_PhoneFormat");
	}

	[Fact]
	public async Task Account_DuplicateEmail_IsRejected()
	{
		var first = TestData.TeamMemberAccount(TestData.StaffMember(StaffRole.Technician));
		await SaveAsync(first);
		var second = TestData.PetParentAccount(TestData.Owner());
		second.Email = first.Email;

		await AssertRejectedAsync(second, PostgresErrorCodes.UniqueViolation, "IX_Accounts_Email");
	}

	[Fact]
	public async Task Account_DuplicatePhone_IsRejected()
	{
		var first = TestData.TeamMemberAccount(TestData.StaffMember(StaffRole.Technician));
		await SaveAsync(first);
		var second = TestData.PetParentAccount(TestData.Owner());
		second.PhoneNumber = first.PhoneNumber;

		await AssertRejectedAsync(second, PostgresErrorCodes.UniqueViolation, "IX_Accounts_PhoneNumber");
	}

	[Fact]
	public async Task Person_CannotHaveTwoAccounts()
	{
		var staffMember = TestData.StaffMember(StaffRole.Veterinarian);
		await SaveAsync(TestData.TeamMemberAccount(staffMember));

		await using var dbContext = factory.CreateDbContext();
		dbContext.Attach(staffMember);
		dbContext.Accounts.Add(TestData.TeamMemberAccount(staffMember));

		await AssertViolatesAsync(
			() => dbContext.SaveChangesAsync(_cancellationToken),
			PostgresErrorCodes.UniqueViolation,
			"IX_Accounts_StaffMemberId");
	}

	private static Account Relink(Account account, StaffMember? staff, Owner? owner)
	{
		account.StaffMember = staff;
		account.Owner = owner;
		return account;
	}

	private async Task SaveAsync(Account account)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.Accounts.Add(account);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	private async Task AssertRejectedAsync(Account account, string sqlState, string constraintName)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.Accounts.Add(account);

		await AssertViolatesAsync(() => dbContext.SaveChangesAsync(_cancellationToken), sqlState, constraintName);
	}

	private static async Task AssertViolatesAsync(Func<Task> action, string sqlState, string constraintName)
	{
		var exception = await Record.ExceptionAsync(action);

		var postgresException = Assert.IsType<PostgresException>(
			Assert.IsType<DbUpdateException>(exception).InnerException);
		Assert.Equal(sqlState, postgresException.SqlState);
		Assert.Equal(constraintName, postgresException.ConstraintName);
	}
}
