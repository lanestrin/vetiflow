namespace vetiflow.Server.Models;

// One set of vitals taken on a case. A case gets many over time; recording
// them never changes acuity (that is RecordTriage).
public class VitalsRecord
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	public int? HeartRate { get; set; }

	public int? RespiratoryRate { get; set; }

	public decimal? TemperatureF { get; set; }

	// Oxygen saturation, in percent.
	public int? SpO2 { get; set; }

	public string? MucousMembraneColor { get; set; }

	public string? CapillaryRefillTime { get; set; }

	public string? Mentation { get; set; }

	public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

	public Guid? RecordedByStaffId { get; set; }

	public StaffMember? RecordedByStaff { get; set; }
}
