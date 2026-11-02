namespace vetiflow.Server.Models;

public enum CaseEventType
{
	Arrived,
	Triaged,
	Assigned,
	StageChanged,
	StatusChanged,
	RoomChanged,
	NoteAdded,
	DiagnosticOrdered,
	DiagnosticCompleted,
	TreatmentStarted,
	TreatmentCompleted,
	Discharged,
	// Tags were removed (build plan 3.5c); these keep past timeline entries readable.
	TagAdded,
	TagRemoved
}

public class CaseEvent
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	public CaseEventType Type { get; set; }

	public required string Description { get; set; }

	public Guid? CreatedByStaffId { get; set; }

	public StaffMember? CreatedByStaff { get; set; }

	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}