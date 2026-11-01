namespace vetiflow.Server.Models;

// Legacy 0-10 pain records retained for history and API compatibility, not an
// endorsed species-specific assessment scale. Recording one never changes
// acuity (that is RecordTriage). Notes are clinical text, never logged.
public class PainScore
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	public int Score { get; set; }

	public string? Notes { get; set; }

	// The reported measurement/event time; null when unknown. Entry time stays separate.
	public DateTimeOffset? OccurredAt { get; set; }

	// Server entry time, never backdated from OccurredAt.
	public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

	public Guid? RecordedByStaffId { get; set; }

	public StaffMember? RecordedByStaff { get; set; }
}
