namespace vetiflow.Server.Models;

public enum CaseStage
{
	Incoming,
	Triage,
	Treatment,
	Diagnostics,
	Recheck,
	Discharge
}

public enum CaseStatus
{
	Unassigned,
	Assigned,
	Waiting,
	InProgress,
	Blocked,
	ReadyForNextStep,
	Completed
}

public enum AcuityLevel
{
	Critical,
	Urgent,
	Stable
}

// Whether the owner has been told how this case is going.
public enum OwnerUpdateStatus
{
	NotYetUpdated,
	Updated,
	AwaitingOwnerReply,
	ConsentNeeded
}

public class EmergencyCase
{
	public Guid Id { get; set; } = Guid.NewGuid();

	// The number staff use ("ER-2481"). The database assigns it from the
	// CaseNumbers sequence on insert; leave it 0 for a new case.
	public int CaseNumber { get; set; }

	public Guid PatientId { get; set; }

	public Patient Patient { get; set; } = null!;

	public DateTimeOffset ArrivalTime { get; set; } = DateTimeOffset.UtcNow;

	public required string PresentingComplaint { get; set; }

	public decimal? WeightKg { get; set; }

	public CaseStage Stage { get; set; } = CaseStage.Incoming;

	// When the case entered its current stage; the board counts minutes in the
	// stage from it (build plan 2.11a). Change the stage through MoveToStage
	// so the two stay in step.
	public DateTimeOffset StageEnteredAt { get; set; } = DateTimeOffset.UtcNow;

	public CaseStatus Status { get; set; } = CaseStatus.Unassigned;

	// Current acuity, the single source of truth for the board.
	// Set it through RecordTriage so the assessment history stays in step.
	public AcuityLevel? Acuity { get; set; }

	public Guid? AssignedDoctorId { get; set; }

	public StaffMember? AssignedDoctor { get; set; }

	public Guid? AssignedTechnicianId { get; set; }

	public StaffMember? AssignedTechnician { get; set; }

	public Guid? RoomId { get; set; }

	public Room? Room { get; set; }

	public string? NextAction { get; set; }

	public OwnerUpdateStatus OwnerUpdateStatus { get; set; } = OwnerUpdateStatus.NotYetUpdated;

	// Null until staff first update the owner.
	public DateTimeOffset? LastOwnerUpdateAt { get; set; }

	public DateTimeOffset LastUpdated { get; set; } = DateTimeOffset.UtcNow;

	public DateTimeOffset? DischargedAt { get; set; }

	// What staff confirmed at this visit's intake, so the next visit can check
	// whether the pet is still on the same medicines and doses. Never logged.
	public string? AllergiesAtIntake { get; set; }

	// This visit's own allergy record, kept apart from the patient's history
	// (4.12a). Set it with RecordAllergiesAtIntake.
	public AllergyStatus AllergyStatusAtIntake { get; set; } = AllergyStatus.NotRecorded;

	public string? MedicationsAtIntake { get; set; }

	public TreatmentAuthorization TreatmentAuthorization { get; set; } = TreatmentAuthorization.NotDiscussed;

	public string? ReferringClinic { get; set; }

	public List<TriageAssessment> TriageAssessments { get; } = [];

	public List<VitalsRecord> VitalsRecords { get; } = [];

	public List<PainScore> PainScores { get; } = [];

	public List<CaseTask> Tasks { get; } = [];

	public List<CaseEvent> Events { get; } = [];

	// What this visit's intake recorded about allergies (4.12a): typed text is
	// unverified, whatever it says; no text is not recorded.
	public void RecordAllergiesAtIntake(string? text)
	{
		AllergiesAtIntake = string.IsNullOrWhiteSpace(text) ? null : text.Trim();
		AllergyStatusAtIntake = AllergiesAtIntake is null ? AllergyStatus.NotRecorded : AllergyStatus.UnknownOrUnverified;
	}

	// Moving to the stage it is already in changes nothing, so the minutes in
	// the stage keep counting.
	public void MoveToStage(CaseStage stage)
	{
		if (stage == Stage)
		{
			return;
		}

		Stage = stage;
		StageEnteredAt = DateTimeOffset.UtcNow;
		LastUpdated = StageEnteredAt;
	}

	// Records the discharge time once: a later move to Discharge keeps the first time
	// (build plan 4.21a).
	public void RecordDischarge(DateTimeOffset now)
	{
		DischargedAt ??= now;
	}

	// Why staff may not make this stage and status change, or null when it is
	// allowed. Completed means treatment is over, so it belongs to Discharge only.
	public string? RefuseStageAndStatus(CaseStage stage, CaseStatus status)
	{
		if (DischargedAt is not null)
		{
			return "This case has been discharged.";
		}

		if (!CaseStageTransitions.CanMove(Stage, stage))
		{
			return Stage == CaseStage.Incoming
				? "Complete triage moves a case out of Incoming."
				: $"A case in {Stage} cannot move to {stage}.";
		}

		if (status == CaseStatus.Completed && stage != CaseStage.Discharge)
		{
			return "A case can be marked Completed only in the Discharge stage.";
		}

		return null;
	}

	public void RecordTriage(TriageAssessment assessment)
	{
		TriageAssessments.Add(assessment);
		Acuity = assessment.Acuity;
		LastUpdated = DateTimeOffset.UtcNow;
	}

	// Leaves Acuity alone: a vitals recheck is not a triage decision.
	public void RecordVitals(VitalsRecord vitals)
	{
		VitalsRecords.Add(vitals);
		LastUpdated = DateTimeOffset.UtcNow;
	}

	// Leaves Acuity alone, as vitals do.
	public void RecordPainScore(PainScore painScore)
	{
		PainScores.Add(painScore);
		LastUpdated = DateTimeOffset.UtcNow;
	}
}