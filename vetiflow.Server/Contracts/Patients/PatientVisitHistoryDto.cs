using vetiflow.Server.Contracts.Cases;

namespace vetiflow.Server.Contracts.Patients;

// A patient's profile header and every ER visit, newest first (build plan
// 4.21b). Only what the page shows: no owner, no contact details, no intake
// notes, allergies or medications.
public class PatientVisitHistoryDto
{
	public required PatientHeaderDto Patient { get; set; }

	public required List<PatientVisitDto> Visits { get; set; }
}

public class PatientHeaderDto
{
	public Guid Id { get; set; }

	public required string Name { get; set; }

	public required string Species { get; set; }

	public string? Breed { get; set; }
}

// One ER case. Null DischargedAt means the visit is still active.
public class PatientVisitDto
{
	public Guid CaseId { get; set; }

	public required string CaseNumber { get; set; }

	public DateTimeOffset ArrivalTime { get; set; }

	public required string PresentingComplaint { get; set; }

	public DateTimeOffset? DischargedAt { get; set; }

	public CaseReferenceDto? AttendingDoctor { get; set; }
}
