namespace vetiflow.Server.Models;

// The limits on a case's tags (build plan 3.5a). Validation and the controller
// both read them from here, so they cannot drift apart.
public static class CaseTagRules
{
	public const int MaxTagsPerCase = 5;

	public const int MaxTextLength = 40;
}

// How a tag is coloured on the board (build plan 3.5b).
public enum CaseTagTone
{
	Alert,
	Caution,
	Info,
	Neutral
}

// A short standing label on a case, such as "O2 support". Blocker tasks are a
// separate concept (CaseTask): a tag never changes a task's status.
public class CaseTag
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	public required string Text { get; set; }

	public CaseTagTone Tone { get; set; }

	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

	public Guid? CreatedByStaffId { get; set; }

	public StaffMember? CreatedByStaff { get; set; }
}
