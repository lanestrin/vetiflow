using System.ComponentModel.DataAnnotations;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// A new task, blocker or due item on a case (build plan 4.4a). The description
// is clinical text: never log it, and errors name the field, never its value.
public class CaseTaskRequest
{
	private string? _description;

	[Required]
	public CaseTaskType? Type { get; set; }

	[Required]
	[StringLength(200)]
	public string? Description { get => _description; set => _description = TextInput.Clean(value); }

	// Required for Reassessment and ClientUpdate.
	public DateTimeOffset? DueAt { get; set; }

	public Guid? AssignedToStaffId { get; set; }

	public static bool NeedsDueAt(CaseTaskType type) =>
		type is CaseTaskType.Reassessment or CaseTaskType.ClientUpdate;
}
