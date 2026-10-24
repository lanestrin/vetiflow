namespace vetiflow.Server.Models;

public enum CaseTaskType
{
	Task,
	Blocker
}

public enum CaseTaskStatus
{
	Open,
	Done,
	Cancelled
}

public class CaseTask
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	public CaseTaskType Type { get; set; } = CaseTaskType.Task;

	public required string Description { get; set; }

	public CaseTaskStatus Status { get; set; } = CaseTaskStatus.Open;

	public DateTimeOffset? DueAt { get; set; }

	public Guid? AssignedToStaffId { get; set; }

	public StaffMember? AssignedToStaff { get; set; }

	public Guid? CreatedByStaffId { get; set; }

	public StaffMember? CreatedByStaff { get; set; }

	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

	public Guid? ResolvedByStaffId { get; set; }

	public StaffMember? ResolvedByStaff { get; set; }

	public DateTimeOffset? ResolvedAt { get; set; }
}
