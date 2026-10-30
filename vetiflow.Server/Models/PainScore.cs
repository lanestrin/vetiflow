namespace vetiflow.Server.Models;

// One pain score on a case, 0 (comfortable) to 10 (severe), on the clinic's
// approved scale (build plan 4.8a). A case gets many over time; recording one
// never changes acuity (that is RecordTriage). Notes are clinical text, never
// logged.
public class PainScore
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	public int Score { get; set; }

	public string? Notes { get; set; }

	public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

	public Guid? RecordedByStaffId { get; set; }

	public StaffMember? RecordedByStaff { get; set; }
}
