namespace vetiflow.Server.Models;

// What the board card's wait chip shows (build plan 2.11a). Minutes counts
// from arrival on screen, so it never goes stale.
public enum WaitChip
{
	Stat,
	Ready,
	Recheck,
	New,
	Minutes
}

// Decided 2026-10-28 and revised for provisional intakes; the first match
// wins. A new intake's priority is provisional until triage is complete, so
// it shows New even when Critical.
public static class WaitChipRule
{
	public static WaitChip For(AcuityLevel? acuity, CaseStatus status, CaseStage stage)
	{
		if (stage == CaseStage.Incoming)
		{
			return WaitChip.New;
		}

		if (acuity == AcuityLevel.Critical)
		{
			return WaitChip.Stat;
		}

		if (status == CaseStatus.ReadyForNextStep)
		{
			return WaitChip.Ready;
		}

		return stage == CaseStage.Recheck ? WaitChip.Recheck : WaitChip.Minutes;
	}
}
