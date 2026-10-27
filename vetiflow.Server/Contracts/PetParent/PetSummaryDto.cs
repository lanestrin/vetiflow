namespace vetiflow.Server.Contracts.PetParent;

// What a pet parent may see about one of their own pets: no IDs, no acuity,
// no case or clinical details.
public class PetSummaryDto
{
	public required string Name { get; set; }

	public required string Species { get; set; }

	// The pet has a case that isn't discharged.
	public bool InCare { get; set; }
}
