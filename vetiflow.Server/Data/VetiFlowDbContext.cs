using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;

namespace vetiflow.Server.Data;

public class VetiFlowDbContext : DbContext
{
	// Numbers cases for staff ("ER-2481"), counting up from 2401 like the
	// prototype's ER-24xx (build plan 3.4a).
	public const string CaseNumberSequence = "CaseNumbers";

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

	public DbSet<PainScore> PainScores => Set<PainScore>();

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
		modelBuilder.HasSequence<int>(CaseNumberSequence).StartsAt(2401);

		modelBuilder.Entity<EmergencyCase>(emergencyCase =>
		{
			emergencyCase
					.Property(c => c.CaseNumber)
					.HasDefaultValueSql($"nextval('\"{CaseNumberSequence}\"')");

			emergencyCase
					.HasIndex(c => c.CaseNumber)
					.IsUnique();

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

			// An intake records allergy text as unverified, or nothing (4.12a).
			emergencyCase.ToTable(table => table.HasCheckConstraint(
					"CK_EmergencyCases_AllergyStatusAtIntake",
					"(\"AllergyStatusAtIntake\" = 'NotRecorded' AND \"AllergiesAtIntake\" IS NULL) OR " +
					"(\"AllergyStatusAtIntake\" = 'UnknownOrUnverified' AND \"AllergiesAtIntake\" IS NOT NULL AND length(btrim(\"AllergiesAtIntake\")) > 0)"));
		});

		// Missing or unverified allergy information is never a verified
		// negative: only the verified statuses carry a verifier and time (4.12a).
		modelBuilder.Entity<Patient>(patient =>
		{
			patient.ToTable(table => table.HasCheckConstraint(
					"CK_Patients_AllergyStatus",
					"(\"AllergyStatus\" = 'NotRecorded' AND \"Allergies\" IS NULL AND \"AllergySource\" IS NULL " +
					"AND \"AllergiesVerifiedAt\" IS NULL AND \"AllergiesVerifiedByStaffId\" IS NULL) OR " +
					"(\"AllergyStatus\" = 'UnknownOrUnverified' " +
					"AND \"AllergiesVerifiedAt\" IS NULL AND \"AllergiesVerifiedByStaffId\" IS NULL) OR " +
					"(\"AllergyStatus\" = 'NoKnownAllergies' AND \"Allergies\" IS NULL " +
					"AND \"AllergiesVerifiedAt\" IS NOT NULL AND \"AllergiesVerifiedByStaffId\" IS NOT NULL) OR " +
					"(\"AllergyStatus\" = 'DocumentedAllergies' AND \"Allergies\" IS NOT NULL AND length(btrim(\"Allergies\")) > 0 " +
					"AND \"AllergiesVerifiedAt\" IS NOT NULL AND \"AllergiesVerifiedByStaffId\" IS NOT NULL)"));
		});

		modelBuilder.Entity<VitalsRecord>(vitals =>
		{
			vitals.ToTable(table => table.HasCheckConstraint(
					"CK_VitalsRecords_SpO2Percent",
					"\"SpO2\" BETWEEN 0 AND 100"));
		});

		modelBuilder.Entity<PainScore>(painScore =>
		{
			painScore.ToTable(table => table.HasCheckConstraint(
					"CK_PainScores_ScoreZeroToTen",
					"\"Score\" BETWEEN 0 AND 10"));

			// The latest score on a case.
			painScore.HasIndex(score => new { score.EmergencyCaseId, score.RecordedAt });
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
