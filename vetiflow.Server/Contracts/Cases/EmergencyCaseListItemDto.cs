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

	public decimal? WeightKg { get; set; }

	public required string PresentingComplaint { get; set; }

	public CaseStage Stage { get; set; }

	public CaseStatus Status { get; set; }

	public AcuityLevel? Acuity { get; set; }

	public DateTimeOffset ArrivalTime { get; set; }

	public string? NextAction { get; set; }

	public CaseReferenceDto? AssignedDoctor { get; set; }

	public CaseReferenceDto? AssignedTechnician { get; set; }

	public CaseReferenceDto? Room { get; set; }

	// Open blockers only, oldest first; empty when nothing blocks the case.
	public required List<CaseBlockerDto> Blockers { get; set; }

	public DateTimeOffset LastUpdated { get; set; }
}