namespace vetiflow.Server.Models;

// The stage moves staff may make through Update status (build plan 4.9a).
// Complete triage is the only way out of Incoming, and Discharge is final.
public static class CaseStageTransitions
{
	private static readonly Dictionary<CaseStage, CaseStage[]> AllowedMoves = new()
	{
		[CaseStage.Incoming] = [],
		[CaseStage.Triage] = [CaseStage.Treatment, CaseStage.Diagnostics, CaseStage.Recheck, CaseStage.Discharge],
		[CaseStage.Treatment] = [CaseStage.Diagnostics, CaseStage.Recheck, CaseStage.Discharge],
		[CaseStage.Diagnostics] = [CaseStage.Treatment, CaseStage.Recheck, CaseStage.Discharge],
		[CaseStage.Recheck] = [CaseStage.Treatment, CaseStage.Diagnostics, CaseStage.Discharge],
		[CaseStage.Discharge] = [],
	};

	// Staying in the current stage is always allowed: it is how status and next
	// action change without moving the case.
	public static bool CanMove(CaseStage from, CaseStage to) =>
		from == to || AllowedMoves[from].Contains(to);
}
