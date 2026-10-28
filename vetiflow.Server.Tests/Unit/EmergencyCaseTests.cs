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
	public void RecordTriage_UpdatesLastUpdated()
	{
		var emergencyCase = NewCase();
		emergencyCase.LastUpdated = DateTimeOffset.UtcNow.AddHours(-1);
		var before = DateTimeOffset.UtcNow;

		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Stable });

		Assert.InRange(emergencyCase.LastUpdated, before, DateTimeOffset.UtcNow);
	}
}
