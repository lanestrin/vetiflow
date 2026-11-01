using System.ComponentModel.DataAnnotations;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// A new tag on a case (build plan 3.5a). The text is clinical: never log it, and
// errors name the field, never its value.
public class CaseTagRequest
{
	private string? _text;

	[Required]
	[StringLength(CaseTagRules.MaxTextLength)]
	public string? Text { get => _text; set => _text = TextInput.Clean(value); }

	[Required]
	public CaseTagTone? Tone { get; set; }
}
