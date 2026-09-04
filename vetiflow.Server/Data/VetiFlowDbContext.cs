using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;

namespace vetiflow.Server.Data;

public class VetiFlowDbContext : DbContext
{
	public VetiFlowDbContext(DbContextOptions<VetiFlowDbContext> options)
			: base(options)
	{
	}

	public DbSet<Patient> Patients => Set<Patient>();

	public DbSet<EmergencyCase> EmergencyCases => Set<EmergencyCase>();

	public DbSet<TriageAssessment> TriageAssessments => Set<TriageAssessment>();

	public DbSet<StaffMember> StaffMembers => Set<StaffMember>();

	public DbSet<Room> Rooms => Set<Room>();

	public DbSet<CaseEvent> CaseEvents => Set<CaseEvent>();

	public DbSet<AiSummary> AiSummaries => Set<AiSummary>();

	public DbSet<Handoff> Handoffs => Set<Handoff>();
}