namespace vetiflow.Server.Contracts.Cases;

// One pain score, 0 to 10, for the case detail and the record response.
public class PainScoreDto
{
	public Guid Id { get; set; }

	public int Score { get; set; }

	public string? Notes { get; set; }

	// Reported measurement/event time; null means unknown.
	public DateTimeOffset? OccurredAt { get; set; }

	// Entry time, preserved for existing clients.
	public DateTimeOffset RecordedAt { get; set; }

	public CaseReferenceDto? RecordedBy { get; set; }
}
