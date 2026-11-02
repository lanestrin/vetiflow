using vetiflow.Server.Models;

namespace vetiflow.Server.Data;

// Writes one entry to a case's timeline as part of the current change, so the
// entry and the change it records are saved together (build plan 4.13a).
public static class CaseTimeline
{
	public static void Add(
		VetiFlowDbContext dbContext,
		EmergencyCase emergencyCase,
		CaseEventType type,
		string description,
		DateTimeOffset now,
		Guid? staffMemberId)
	{
		var caseEvent = new CaseEvent
		{
			Type = type,
			Description = description,
			CreatedAt = now,
			CreatedByStaffId = staffMemberId
		};
		emergencyCase.Events.Add(caseEvent);

		// A new row carries its own Guid, so EF would otherwise treat it as an
		// existing row on a tracked case; add it explicitly.
		dbContext.CaseEvents.Add(caseEvent);
	}
}
