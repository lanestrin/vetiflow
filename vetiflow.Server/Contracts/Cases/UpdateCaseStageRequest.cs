using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

public class UpdateCaseStageRequest
{
	public CaseStage Stage { get; set; }
}