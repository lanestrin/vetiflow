using vetiflow.Server.Models;

namespace vetiflow.Server.Tests.Unit;

// The card's wait chip, decided 2026-10-28 (build plan 2.11a): first match wins.
public class WaitChipRuleTests
{
	[Theory]
	[InlineData(AcuityLevel.Critical, CaseStatus.InProgress, CaseStage.Treatment, WaitChip.Stat)]
	[InlineData(AcuityLevel.Urgent, CaseStatus.ReadyForNextStep, CaseStage.Treatment, WaitChip.Ready)]
	[InlineData(AcuityLevel.Stable, CaseStatus.Waiting, CaseStage.Recheck, WaitChip.Recheck)]
	[InlineData(AcuityLevel.Urgent, CaseStatus.Waiting, CaseStage.Diagnostics, WaitChip.Minutes)]
	[InlineData(AcuityLevel.Stable, CaseStatus.Assigned, CaseStage.Incoming, WaitChip.Minutes)]
	public void For_EachOutcome(AcuityLevel acuity, CaseStatus status, CaseStage stage, WaitChip expected)
	{
		Assert.Equal(expected, WaitChipRule.For(acuity, status, stage));
	}

	[Fact]
	public void For_NotTriaged_IsNew()
	{
		Assert.Equal(WaitChip.New, WaitChipRule.For(null, CaseStatus.Unassigned, CaseStage.Incoming));
	}

	[Fact]
	public void For_CriticalComesFirst()
	{
		Assert.Equal(WaitChip.Stat, WaitChipRule.For(AcuityLevel.Critical, CaseStatus.ReadyForNextStep, CaseStage.Recheck));
	}

	[Fact]
	public void For_ReadyComesBeforeRecheck()
	{
		Assert.Equal(WaitChip.Ready, WaitChipRule.For(AcuityLevel.Stable, CaseStatus.ReadyForNextStep, CaseStage.Recheck));
	}

	[Fact]
	public void For_RecheckComesBeforeNotTriaged()
	{
		Assert.Equal(WaitChip.Recheck, WaitChipRule.For(null, CaseStatus.Waiting, CaseStage.Recheck));
	}
}
