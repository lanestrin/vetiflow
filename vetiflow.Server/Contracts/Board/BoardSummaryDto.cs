using vetiflow.Server.Hosting;

namespace vetiflow.Server.Contracts.Board;

// The numbers behind the board's stat cards (build plan 2.12a). Counts and
// times only: no names, owners or notes. Door to doctor follows in 2.16a.
public class BoardSummaryDto
{
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
}

public class ShiftDto
{
	public ShiftName Name { get; set; }

	public DateTimeOffset StartedAt { get; set; }
}
