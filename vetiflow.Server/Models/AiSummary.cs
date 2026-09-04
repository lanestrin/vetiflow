namespace vetiflow.Server.Models;

public enum AiSummaryType
{
	Intake,
	Handoff
}

public enum AiSummaryStatus
{
	Draft,
	Reviewed,
	Confirmed
}

public class AiSummary
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	public AiSummaryType Type { get; set; }

	public required string SourceText { get; set; }

	public required string SummaryText { get; set; }

	public AiSummaryStatus Status { get; set; } = AiSummaryStatus.Draft;

	public DateTimeOffset GeneratedAt { get; set; } = DateTimeOffset.UtcNow;

	public Guid? ReviewedByStaffId { get; set; }

	public DateTimeOffset? ReviewedAt { get; set; }
}