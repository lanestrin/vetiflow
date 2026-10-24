namespace vetiflow.Server.Models;

public enum CaseStage
{
	Incoming,
	Triage,
	Treatment,
	Diagnostics,
	Recheck,
	Discharge
}

public enum CaseStatus
{
	Unassigned,
	Assigned,
	Waiting,
	InProgress,
	Blocked,
	ReadyForNextStep,
	Completed
}

public enum AcuityLevel
{
	Critical,
	Urgent,
	Stable,
	Low
}

public class EmergencyCase
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid PatientId { get; set; }

	public Patient Patient { get; set; } = null!;

	public DateTimeOffset ArrivalTime { get; set; } = DateTimeOffset.UtcNow;

	public required string PresentingComplaint { get; set; }

	public decimal? WeightKg { get; set; }

	public CaseStage Stage { get; set; } = CaseStage.Incoming;

	public CaseStatus Status { get; set; } = CaseStatus.Unassigned;

	// Current acuity, the single source of truth for the board.
	// Set it through RecordTriage so the assessment history stays in step.
	public AcuityLevel? Acuity { get; set; }

	public Guid? AssignedDoctorId { get; set; }

	public StaffMember? AssignedDoctor { get; set; }

	public Guid? AssignedTechnicianId { get; set; }

	public StaffMember? AssignedTechnician { get; set; }

	public Guid? RoomId { get; set; }

	public Room? Room { get; set; }

	public string? NextAction { get; set; }

	public DateTimeOffset LastUpdated { get; set; } = DateTimeOffset.UtcNow;

	public DateTimeOffset? DischargedAt { get; set; }

	public List<TriageAssessment> TriageAssessments { get; } = [];

	public List<CaseTask> Tasks { get; } = [];

	public List<CaseEvent> Events { get; } = [];

	public void RecordTriage(TriageAssessment assessment)
	{
		TriageAssessments.Add(assessment);
		Acuity = assessment.Acuity;
		LastUpdated = DateTimeOffset.UtcNow;
	}
}