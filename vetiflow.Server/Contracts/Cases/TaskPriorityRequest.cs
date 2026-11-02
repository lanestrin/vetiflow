using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// Sets or clears a task's priority (build plan 4.13a). Null clears it, so the
// task is shown as "Not prioritized" again. Staff choose it; nothing is defaulted.
public class TaskPriorityRequest
{
	public TaskPriority? Priority { get; set; }
}
