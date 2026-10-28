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

// Decided 2026-10-28, as in the prototype; the first match wins.
public static class WaitChipRule
{
	public static WaitChip For(AcuityLevel? acuity, CaseStatus status, CaseStage stage)
	{
		if (acuity == AcuityLevel.Critical)
		{
			return WaitChip.Stat;
		}

		if (status == CaseStatus.ReadyForNextStep)
		{
			return WaitChip.Ready;
		}

		if (stage == CaseStage.Recheck)
		{
			return WaitChip.Recheck;
		}

		return acuity is null ? WaitChip.New : WaitChip.Minutes;
	}
}
