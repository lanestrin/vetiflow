using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

public class UpdateCaseStageRequest
{
	// Required, so a body without it is a 400 instead of moving the case to
	// Incoming (the enum's default).
	public required CaseStage Stage { get; set; }
}