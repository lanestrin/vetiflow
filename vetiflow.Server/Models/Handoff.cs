namespace vetiflow.Server.Models;

public class Handoff
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	public Guid? FromStaffId { get; set; }

	public Guid? ToStaffId { get; set; }

	public required string Summary { get; set; }

	public string? PendingItems { get; set; }

	public string? NextSteps { get; set; }

	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

	public DateTimeOffset? AcknowledgedAt { get; set; }
}