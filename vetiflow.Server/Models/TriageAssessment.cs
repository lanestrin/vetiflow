namespace vetiflow.Server.Models;

public class TriageAssessment
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	// The acuity assessed at this point in time. The case's current
	// acuity lives on EmergencyCase and is set through RecordTriage.
	public AcuityLevel Acuity { get; set; }

	// Vitals live in VitalsRecord, so a recheck is not an acuity decision.

	public string? RawIntakeNotes { get; set; }

	// The reported measurement/event time; null when unknown. Entry time stays separate.
	public DateTimeOffset? OccurredAt { get; set; }

	// Server entry time, never backdated from OccurredAt.
	public DateTimeOffset AssessedAt { get; set; } = DateTimeOffset.UtcNow;

	public Guid? AssessedByStaffId { get; set; }

	public StaffMember? AssessedByStaff { get; set; }
}
