using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// Stage, status and next action change together (build plan 4.9a). Stage and
// status are required, so a body without them is a 400 instead of a silent
// default such as moving the case to Incoming.
public class UpdateCaseStatusRequest
{
	public required CaseStage Stage { get; set; }

	public required CaseStatus Status { get; set; }

	// Null clears the next action.
	public string? NextAction { get; set; }
}
