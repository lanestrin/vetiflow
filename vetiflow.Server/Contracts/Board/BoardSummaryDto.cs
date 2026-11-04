using vetiflow.Server.Hosting;

namespace vetiflow.Server.Contracts.Board;

// The numbers behind the board's stat cards (build plan 2.12a). Counts and
// times only: no names, owners or notes. Door to doctor follows in 2.16a.
public class BoardSummaryDto
{
	// The heading's eyebrow (2.15a), from the Clinic:Name setting.
	public required string ClinicName { get; set; }

	// The shift chip's "4 clinicians on floor" (2.15a): active veterinarians
	// and technicians not Unavailable, as GET /api/staff/on-floor lists them.
	public int CliniciansOnFloor { get; set; }

	// Active (not discharged) cases.
	public int PatientsInCare { get; set; }

	public required ShiftDto Shift { get; set; }

	// Of the patients in care, those who arrived since the shift began.
	public int ArrivedThisShift { get; set; }

	// Cases still in stage Incoming.
	public int AwaitingTriage { get; set; }

	// The longest wait's arrival; the client counts the minutes. Null when
	// nothing awaits triage.
	public DateTimeOffset? OldestAwaitingTriageArrivedAt { get; set; }

	// Active cases with acuity Critical, provisional ones included.
	public int CriticalPatients { get; set; }

	// Of those, the ones with neither a doctor nor a technician assigned.
	public int CriticalWithoutCareTeam { get; set; }

	// Arrival to the recorded vet assessment (2.16a).
	public required DoorToDoctorDto DoorToDoctor { get; set; }
}

// Door to doctor for this shift and the one before it, and how many patients
// still wait for their first vet assessment. Counts and minutes only.
public class DoorToDoctorDto
{
	public required ShiftDoorToDoctorDto CurrentShift { get; set; }

	public required ShiftDoorToDoctorDto PreviousShift { get; set; }

	// Active cases with no vet assessment yet: Show waiting patients (2.16b).
	public int Waiting { get; set; }
}

// Of the cases that arrived during the shift (discharged ones included), those
// with a vet assessment, and their mean wait in whole minutes. Null when none.
public class ShiftDoorToDoctorDto
{
	public int? AverageMinutes { get; set; }

	public int Assessed { get; set; }
}

public class ShiftDto
{
	public ShiftName Name { get; set; }

	public DateTimeOffset StartedAt { get; set; }
}
