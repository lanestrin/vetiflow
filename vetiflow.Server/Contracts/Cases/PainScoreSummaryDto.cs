namespace vetiflow.Server.Contracts.Cases;

// The latest pain score on a board card: the score and when, never the notes.
public class PainScoreSummaryDto
{
	public int Score { get; set; }

	public DateTimeOffset RecordedAt { get; set; }
}
