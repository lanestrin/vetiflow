using System.ComponentModel.DataAnnotations;

namespace vetiflow.Server.Contracts.Cases;

// A new pain score on a case (build plan 4.8a). Notes are clinical text: never
// log them, and errors name the field, never its value.
public class PainScoreRequest
{
	// Optional reported event time with an explicit offset; never entry time.
	[StringLength(33)]
	public string? OccurredAt { get; set; }

	private string? _notes;

	[Required]
	[Range(0, 10)]
	public int? Score { get; set; }

	[StringLength(500)]
	public string? Notes { get => _notes; set => _notes = TextInput.Clean(value); }
}
