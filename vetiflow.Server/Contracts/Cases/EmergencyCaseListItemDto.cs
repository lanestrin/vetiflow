using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

public class EmergencyCaseListItemDto
{
	public Guid Id { get; set; }

	// "ER-2481".
	public required string CaseNumber { get; set; }

	public Guid PatientId { get; set; }

	public required string PatientName { get; set; }

	public required string Species { get; set; }

	public string? Breed { get; set; }

	// The card shows the age from it ("8y"); null when not recorded.
	public DateOnly? PatientDateOfBirth { get; set; }

	// "Avery Chen"; null when the patient has no owner. Never contact details.
	public string? OwnerName { get; set; }

	public decimal? WeightKg { get; set; }

	public required string PresentingComplaint { get; set; }

	public CaseStage Stage { get; set; }

	// The card counts minutes in the stage from it.
	public DateTimeOffset StageEnteredAt { get; set; }

	public CaseStatus Status { get; set; }

	public AcuityLevel? Acuity { get; set; }

	public DateTimeOffset ArrivalTime { get; set; }

	public string? NextAction { get; set; }

	public CaseReferenceDto? AssignedDoctor { get; set; }

	public CaseReferenceDto? AssignedTechnician { get; set; }

	public CaseRoomDto? Room { get; set; }

	// The doctor, or the technician when no doctor is assigned.
	public CaseClinicianDto? Clinician { get; set; }

	// What the card's wait chip shows (WaitChipRule).
	public WaitChip WaitChip { get; set; }

	// Open blockers only, oldest first; empty when nothing blocks the case.
	public required List<CaseBlockerDto> Blockers { get; set; }

	// The case's tags, oldest first; empty when none (build plan 3.5b).
	public required List<CaseTagDto> Tags { get; set; }

	// The earliest due open Reassessment and ClientUpdate tasks (4.4a).
	public CaseDueItemDto? NextReassessment { get; set; }

	public CaseDueItemDto? NextClientUpdate { get; set; }

	// The newest pain score (4.8a), without its notes; null when none.
	public PainScoreSummaryDto? LatestPainScore { get; set; }

	public DateTimeOffset LastUpdated { get; set; }
}