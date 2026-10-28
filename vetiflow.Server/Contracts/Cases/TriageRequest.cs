using System.ComponentModel.DataAnnotations;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// Complete triage or re-triage (build plan 4.2a). Notes are clinical text:
// never log them, and errors name the field, never its value.
public class TriageRequest
{
	private string? _notes;

	[Required]
	public AcuityLevel? Priority { get; set; }

	[StringLength(2000)]
	public string? Notes { get => _notes; set => _notes = TextInput.Clean(value); }
}
