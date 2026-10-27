using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;

namespace vetiflow.Server.Data;

public class VetiFlowDbContext : DbContext
{
	public VetiFlowDbContext(DbContextOptions<VetiFlowDbContext> options)
			: base(options)
	{
	}

	public DbSet<Account> Accounts => Set<Account>();

	public DbSet<Owner> Owners => Set<Owner>();

	public DbSet<Patient> Patients => Set<Patient>();

	public DbSet<EmergencyCase> EmergencyCases => Set<EmergencyCase>();

	public DbSet<TriageAssessment> TriageAssessments => Set<TriageAssessment>();

	public DbSet<VitalsRecord> VitalsRecords => Set<VitalsRecord>();

	public DbSet<StaffMember> StaffMembers => Set<StaffMember>();

	public DbSet<Room> Rooms => Set<Room>();

	public DbSet<CaseEvent> CaseEvents => Set<CaseEvent>();

	public DbSet<CaseTask> CaseTasks => Set<CaseTask>();

	public DbSet<AiSummary> AiSummaries => Set<AiSummary>();

	public DbSet<Handoff> Handoffs => Set<Handoff>();

	protected override void ConfigureConventions(
		ModelConfigurationBuilder configurationBuilder)
	{
		// Store enums by name so reordering or inserting a value
		// can never silently change the meaning of existing rows.
		configurationBuilder
				.Properties<Enum>()
				.HaveConversion<string>();
	}

	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		modelBuilder.Entity<EmergencyCase>(emergencyCase =>
		{
			// A patient can have at most one active (not discharged) case.
			emergencyCase
					.HasIndex(c => c.PatientId)
					.IsUnique()
					.HasFilter("\"DischargedAt\" IS NULL")
					.HasDatabaseName("IX_EmergencyCases_PatientId_Active");

			// A room can hold at most one active case.
			emergencyCase
					.HasIndex(c => c.RoomId)
					.IsUnique()
					.HasFilter("\"DischargedAt\" IS NULL AND \"RoomId\" IS NOT NULL")
					.HasDatabaseName("IX_EmergencyCases_RoomId_Active");
		});

		modelBuilder.Entity<Account>(account =>
		{
			account.ToTable(table =>
			{
				// A team member links to a staff member only, a pet parent to an
				// owner only: the experience comes from this record.
				table.HasCheckConstraint(
						"CK_Accounts_KindMatchesLink",
						"(\"Kind\" = 'TeamMember' AND \"StaffMemberId\" IS NOT NULL AND \"OwnerId\" IS NULL) OR " +
						"(\"Kind\" = 'PetParent' AND \"OwnerId\" IS NOT NULL AND \"StaffMemberId\" IS NULL)");
				table.HasCheckConstraint(
						"CK_Accounts_HasEmailOrPhone",
						"\"Email\" IS NOT NULL OR \"PhoneNumber\" IS NOT NULL");
				table.HasCheckConstraint(
						"CK_Accounts_EmailLowerCase",
						"\"Email\" = lower(\"Email\")");
				table.HasCheckConstraint(
						"CK_Accounts_PhoneFormat",
						"\"PhoneNumber\" ~ '^\\+1[0-9]{10}$'");
			});

			// One sign-in per email, per phone and per person.
			account.HasIndex(a => a.Email).IsUnique();
			account.HasIndex(a => a.PhoneNumber).IsUnique();
			account.HasIndex(a => a.StaffMemberId).IsUnique();
			account.HasIndex(a => a.OwnerId).IsUnique();
		});

		// Never cascade deletes: case history, assessments, AI output and
		// handoffs are the audit trail and must not disappear with a parent.
		foreach (var foreignKey in modelBuilder.Model
				.GetEntityTypes()
				.SelectMany(entityType => entityType.GetForeignKeys()))
		{
			foreignKey.DeleteBehavior = DeleteBehavior.Restrict;
		}
	}
}
