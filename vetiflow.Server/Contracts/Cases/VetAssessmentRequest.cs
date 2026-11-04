namespace vetiflow.Server.Contracts.Cases;

// The initial veterinarian assessment (build plan 2.16a). OccurredAt is when it
// happened, with an explicit offset; null means now. Parsed by
// AssessmentEventTime so it is never in the future.
public class VetAssessmentRequest
{
	public string? OccurredAt { get; set; }
}
