namespace vetiflow.Server.Models;

// Whether the owner has authorized initial treatment, from the intake form.
public enum TreatmentAuthorization
{
	NotDiscussed,
	Pending,
	Authorized,
	Declined
}
