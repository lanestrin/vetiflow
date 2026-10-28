using vetiflow.Server.Models;

namespace vetiflow.Server.Tests.Unit;

// The card's wait chip (build plan 2.11a, revised 2026-10-28 for provisional
// intakes): first match wins.
public class WaitChipRuleTests
{
	[Theory]
	[InlineData(AcuityLevel.Critical, CaseStatus.InProgress, CaseStage.Treatment, WaitChip.Stat)]
	[InlineData(AcuityLevel.Urgent, CaseStatus.ReadyForNextStep, CaseStage.Treatment, WaitChip.Ready)]
	[InlineData(AcuityLevel.Stable, CaseStatus.Waiting, CaseStage.Recheck, WaitChip.Recheck)]
	[InlineData(AcuityLevel.Urgent, CaseStatus.Waiting, CaseStage.Diagnostics, WaitChip.Minutes)]
	[InlineData(AcuityLevel.Stable, CaseStatus.Assigned, CaseStage.Triage, WaitChip.Minutes)]
	public void For_EachOutcome(AcuityLevel acuity, CaseStatus status, CaseStage stage, WaitChip expected)
	{
		Assert.Equal(expected, WaitChipRule.For(acuity, status, stage));
	}

	// A new intake's priority is provisional until triage is complete.
	[Theory]
	[InlineData(AcuityLevel.Critical)]
	[InlineData(AcuityLevel.Urgent)]
	[InlineData(AcuityLevel.Stable)]
	[InlineData(null)]
	public void For_AwaitingTriage_IsNewAtAnyAcuity(AcuityLevel? acuity)
	{
		Assert.Equal(WaitChip.New, WaitChipRule.For(acuity, CaseStatus.Unassigned, CaseStage.Incoming));
	}

	[Fact]
	public void For_AwaitingTriage_ComesBeforeReady()
	{
		Assert.Equal(WaitChip.New, WaitChipRule.For(AcuityLevel.Urgent, CaseStatus.ReadyForNextStep, CaseStage.Incoming));
	}

	// Only old data has no acuity outside Incoming; it counts minutes.
	[Fact]
	public void For_NoAcuityAfterIncoming_IsMinutes()
	{
		Assert.Equal(WaitChip.Minutes, WaitChipRule.For(null, CaseStatus.Waiting, CaseStage.Treatment));
	}

	[Fact]
	public void For_CriticalComesBeforeReadyAndRecheck()
	{
		Assert.Equal(WaitChip.Stat, WaitChipRule.For(AcuityLevel.Critical, CaseStatus.ReadyForNextStep, CaseStage.Recheck));
	}

	[Fact]
	public void For_ReadyComesBeforeRecheck()
	{
		Assert.Equal(WaitChip.Ready, WaitChipRule.For(AcuityLevel.Stable, CaseStatus.ReadyForNextStep, CaseStage.Recheck));
	}
}
