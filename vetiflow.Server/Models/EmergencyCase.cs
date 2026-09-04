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

	public AcuityLevel? Acuity { get; set; }

	public Guid? AssignedDoctorId { get; set; }

	public Guid? AssignedTechnicianId { get; set; }

	public Guid? RoomId { get; set; }

	public string? NextAction { get; set; }

	public DateTimeOffset LastUpdated { get; set; } = DateTimeOffset.UtcNow;

	public DateTimeOffset? DischargedAt { get; set; }
}