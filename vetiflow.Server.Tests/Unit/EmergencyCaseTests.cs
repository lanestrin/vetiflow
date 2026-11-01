using vetiflow.Server.Models;

namespace vetiflow.Server.Tests.Unit;

public class EmergencyCaseTests
{
	private static EmergencyCase NewCase() => new() { PresentingComplaint = "Vomiting" };

	[Fact]
	public void RecordTriage_SetsCurrentAcuityAndAppendsAssessment()
	{
		var emergencyCase = NewCase();
		var assessment = new TriageAssessment { Acuity = AcuityLevel.Urgent };

		emergencyCase.RecordTriage(assessment);

		Assert.Equal(AcuityLevel.Urgent, emergencyCase.Acuity);
		Assert.Same(assessment, Assert.Single(emergencyCase.TriageAssessments));
	}

	[Fact]
	public void RecordTriage_Retriage_KeepsHistoryAndUsesLatestAcuity()
	{
		var emergencyCase = NewCase();
		var first = new TriageAssessment { Acuity = AcuityLevel.Urgent };
		var second = new TriageAssessment { Acuity = AcuityLevel.Critical };

		emergencyCase.RecordTriage(first);
		emergencyCase.RecordTriage(second);

		Assert.Equal(AcuityLevel.Critical, emergencyCase.Acuity);
		Assert.Equal([first, second], emergencyCase.TriageAssessments);
	}

	// A technician's recheck is not an acuity decision.
	[Fact]
	public void RecordVitals_AddsRecordWithoutChangingAcuity()
	{
		var emergencyCase = NewCase();
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Urgent });
		emergencyCase.LastUpdated = DateTimeOffset.UtcNow.AddHours(-1);
		var before = DateTimeOffset.UtcNow;
		var vitals = new VitalsRecord { HeartRate = 120 };

		emergencyCase.RecordVitals(vitals);

		Assert.Same(vitals, Assert.Single(emergencyCase.VitalsRecords));
		Assert.Equal(AcuityLevel.Urgent, emergencyCase.Acuity);
		Assert.Single(emergencyCase.TriageAssessments);
		Assert.InRange(emergencyCase.LastUpdated, before, DateTimeOffset.UtcNow);
	}

	[Fact]
	public void RecordPainScore_AddsScoreWithoutChangingAcuity()
	{
		var emergencyCase = NewCase();
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Stable });
		emergencyCase.LastUpdated = DateTimeOffset.UtcNow.AddHours(-1);
		var before = DateTimeOffset.UtcNow;
		var painScore = new PainScore { Score = 9 };

		emergencyCase.RecordPainScore(painScore);

		Assert.Same(painScore, Assert.Single(emergencyCase.PainScores));
		Assert.Equal(AcuityLevel.Stable, emergencyCase.Acuity);
		Assert.Single(emergencyCase.TriageAssessments);
		Assert.InRange(emergencyCase.LastUpdated, before, DateTimeOffset.UtcNow);
	}

	[Fact]
	public void RecordTriage_UpdatesLastUpdated()
	{
		var emergencyCase = NewCase();
		emergencyCase.LastUpdated = DateTimeOffset.UtcNow.AddHours(-1);
		var before = DateTimeOffset.UtcNow;

		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Stable });

		Assert.InRange(emergencyCase.LastUpdated, before, DateTimeOffset.UtcNow);
	}

	// Stage time (build plan 2.11a): the card counts minutes in the stage from it.
	[Fact]
	public void MoveToStage_NewStage_SetsStageEnteredAt()
	{
		var emergencyCase = NewCase();
		emergencyCase.StageEnteredAt = DateTimeOffset.UtcNow.AddHours(-1);
		emergencyCase.LastUpdated = DateTimeOffset.UtcNow.AddHours(-1);
		var before = DateTimeOffset.UtcNow;

		emergencyCase.MoveToStage(CaseStage.Treatment);

		Assert.Equal(CaseStage.Treatment, emergencyCase.Stage);
		Assert.InRange(emergencyCase.StageEnteredAt, before, DateTimeOffset.UtcNow);
		Assert.InRange(emergencyCase.LastUpdated, before, DateTimeOffset.UtcNow);
	}

	[Fact]
	public void MoveToStage_SameStage_KeepsStageEnteredAt()
	{
		var emergencyCase = NewCase();
		var enteredAt = DateTimeOffset.UtcNow.AddHours(-1);
		emergencyCase.StageEnteredAt = enteredAt;
		emergencyCase.LastUpdated = enteredAt;

		emergencyCase.MoveToStage(emergencyCase.Stage);

		Assert.Equal(enteredAt, emergencyCase.StageEnteredAt);
		Assert.Equal(enteredAt, emergencyCase.LastUpdated);
	}

	[Theory]
	[InlineData(CaseStage.Triage, CaseStage.Treatment)]
	[InlineData(CaseStage.Triage, CaseStage.Diagnostics)]
	[InlineData(CaseStage.Triage, CaseStage.Recheck)]
	[InlineData(CaseStage.Triage, CaseStage.Discharge)]
	[InlineData(CaseStage.Treatment, CaseStage.Diagnostics)]
	[InlineData(CaseStage.Treatment, CaseStage.Recheck)]
	[InlineData(CaseStage.Treatment, CaseStage.Discharge)]
	[InlineData(CaseStage.Diagnostics, CaseStage.Treatment)]
	[InlineData(CaseStage.Diagnostics, CaseStage.Recheck)]
	[InlineData(CaseStage.Diagnostics, CaseStage.Discharge)]
	[InlineData(CaseStage.Recheck, CaseStage.Treatment)]
	[InlineData(CaseStage.Recheck, CaseStage.Diagnostics)]
	[InlineData(CaseStage.Recheck, CaseStage.Discharge)]
	[InlineData(CaseStage.Treatment, CaseStage.Treatment)]
	[InlineData(CaseStage.Discharge, CaseStage.Discharge)]
	public void RefuseStageAndStatus_AllowsListedMoves(CaseStage from, CaseStage to)
	{
		var emergencyCase = NewCase();
		emergencyCase.Stage = from;

		Assert.Null(emergencyCase.RefuseStageAndStatus(to, CaseStatus.InProgress));
	}

	[Theory]
	[InlineData(CaseStage.Incoming, CaseStage.Triage)]
	[InlineData(CaseStage.Incoming, CaseStage.Treatment)]
	[InlineData(CaseStage.Incoming, CaseStage.Diagnostics)]
	[InlineData(CaseStage.Incoming, CaseStage.Recheck)]
	[InlineData(CaseStage.Incoming, CaseStage.Discharge)]
	[InlineData(CaseStage.Triage, CaseStage.Incoming)]
	[InlineData(CaseStage.Treatment, CaseStage.Incoming)]
	[InlineData(CaseStage.Treatment, CaseStage.Triage)]
	[InlineData(CaseStage.Diagnostics, CaseStage.Incoming)]
	[InlineData(CaseStage.Diagnostics, CaseStage.Triage)]
	[InlineData(CaseStage.Recheck, CaseStage.Incoming)]
	[InlineData(CaseStage.Recheck, CaseStage.Triage)]
	[InlineData(CaseStage.Discharge, CaseStage.Incoming)]
	[InlineData(CaseStage.Discharge, CaseStage.Triage)]
	[InlineData(CaseStage.Discharge, CaseStage.Treatment)]
	[InlineData(CaseStage.Discharge, CaseStage.Diagnostics)]
	[InlineData(CaseStage.Discharge, CaseStage.Recheck)]
	public void RefuseStageAndStatus_RefusesMovesOutsideTheTable(CaseStage from, CaseStage to)
	{
		var emergencyCase = NewCase();
		emergencyCase.Stage = from;

		Assert.NotNull(emergencyCase.RefuseStageAndStatus(to, CaseStatus.InProgress));
	}

	[Fact]
	public void RefuseStageAndStatus_IncomingToTreatment_PointsToCompleteTriage()
	{
		var emergencyCase = NewCase();

		Assert.Equal(
			"Complete triage moves a case out of Incoming.",
			emergencyCase.RefuseStageAndStatus(CaseStage.Treatment, CaseStatus.InProgress));
	}

	[Theory]
	[InlineData(CaseStage.Treatment)]
	[InlineData(CaseStage.Recheck)]
	public void RefuseStageAndStatus_CompletedOutsideDischarge_IsRefused(CaseStage stage)
	{
		var emergencyCase = NewCase();
		emergencyCase.Stage = CaseStage.Treatment;

		Assert.NotNull(emergencyCase.RefuseStageAndStatus(stage, CaseStatus.Completed));
	}

	[Fact]
	public void RefuseStageAndStatus_CompletedInDischarge_IsAllowed()
	{
		var emergencyCase = NewCase();
		emergencyCase.Stage = CaseStage.Recheck;

		Assert.Null(emergencyCase.RefuseStageAndStatus(CaseStage.Discharge, CaseStatus.Completed));
	}

	[Fact]
	public void RecordDischarge_SetsTheTimeOnceAndKeepsTheFirst()
	{
		var emergencyCase = NewCase();
		var first = DateTimeOffset.UtcNow.AddMinutes(-5);

		emergencyCase.RecordDischarge(first);
		emergencyCase.RecordDischarge(DateTimeOffset.UtcNow);

		Assert.Equal(first, emergencyCase.DischargedAt);
	}

	[Theory]
	[InlineData(CaseStatus.Waiting)]
	[InlineData(CaseStatus.Completed)]
	public void RefuseStageAndStatus_RefusesAnyChangeOnADischargedCase(CaseStatus status)
	{
		var emergencyCase = NewCase();
		emergencyCase.Stage = CaseStage.Discharge;
		emergencyCase.DischargedAt = DateTimeOffset.UtcNow;

		Assert.Equal("This case has been discharged.", emergencyCase.RefuseStageAndStatus(CaseStage.Discharge, status));
	}

	[Fact]
	public void RefuseStageAndStatus_LeavesAcuityAlone()
	{
		var emergencyCase = NewCase();
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Urgent });
		emergencyCase.Stage = CaseStage.Triage;

		emergencyCase.MoveToStage(CaseStage.Treatment);

		Assert.Equal(AcuityLevel.Urgent, emergencyCase.Acuity);
	}
}
