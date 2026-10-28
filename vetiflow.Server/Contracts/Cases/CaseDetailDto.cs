using vetiflow.Server.Contracts.Owners;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// Everything about one case, for the case detail drawer (build plan 3.1).
// Team members only: it carries owner contact details and raw intake notes.
// Later items add AI summaries, handoffs and the discharge outcome here.
public class CaseDetailDto
{
	public Guid Id { get; set; }

	// "ER-2481".
	public required string CaseNumber { get; set; }

	public required CasePatientDto Patient { get; set; }

	// Null for a stray, or when the owner isn't known yet.
	public OwnerDto? Owner { get; set; }

	public required string PresentingComplaint { get; set; }

	public decimal? WeightKg { get; set; }

	public CaseStage Stage { get; set; }

	public CaseStatus Status { get; set; }

	public AcuityLevel? Acuity { get; set; }

	public DateTimeOffset ArrivalTime { get; set; }

	public DateTimeOffset LastUpdated { get; set; }

	public DateTimeOffset? DischargedAt { get; set; }

	public string? NextAction { get; set; }

	public CaseReferenceDto? AssignedDoctor { get; set; }

	public CaseReferenceDto? AssignedTechnician { get; set; }

	public CaseReferenceDto? Room { get; set; }

	public OwnerUpdateStatus OwnerUpdateStatus { get; set; }

	public DateTimeOffset? LastOwnerUpdateAt { get; set; }

	// Newest first.
	public required List<TriageAssessmentDto> TriageAssessments { get; set; }

	// Newest first.
	public required List<VitalsRecordDto> Vitals { get; set; }

	// Open first, then oldest first.
	public required List<CaseTaskDto> Tasks { get; set; }

	// Oldest first, so it reads as the case's story.
	public required List<CaseEventDto> Timeline { get; set; }
}
