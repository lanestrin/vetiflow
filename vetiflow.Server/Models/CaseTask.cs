namespace vetiflow.Server.Models;

// Reassessment and ClientUpdate are due items with a due time (decided
// 2026-10-28: due items are tasks, build plan 4.4a).
public enum CaseTaskType
{
	Task,
	Blocker,
	Reassessment,
	ClientUpdate
}

public enum CaseTaskStatus
{
	Open,
	Done,
	Cancelled
}

// Set only by staff (build plan 4.13a). Nothing in the server ranks or chooses
// a task's priority: null means "Not prioritized".
public enum TaskPriority
{
	Urgent,
	High,
	Routine
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

	public TaskPriority? Priority { get; set; }

	// The case's documented Next Care Action, designated by staff (4.13a). At
	// most one task per case has this set; completing, cancelling or discharging
	// clears it in the same transaction.
	public bool IsNextAction { get; set; }

	public DateTimeOffset? NextActionDesignatedAt { get; set; }

	public Guid? NextActionDesignatedByStaffId { get; set; }

	public StaffMember? NextActionDesignatedByStaff { get; set; }
}
