namespace vetiflow.Server.Contracts.Cases;

// The latest pain score on a board card: the score and when, never the notes.
public class PainScoreSummaryDto
{
	public int Score { get; set; }

	// Reported measurement/event time; null means unknown.
	public DateTimeOffset? OccurredAt { get; set; }

	// Entry time, preserved for existing clients.
	public DateTimeOffset RecordedAt { get; set; }
}
