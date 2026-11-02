namespace vetiflow.Server.Models;

// What is known about a patient's allergies (build plan 4.12a). Missing or
// unverified text is never a verified negative: only NoKnownAllergies and
// DocumentedAllergies carry a verifier and a verified time.
public enum AllergyStatus
{
	NotRecorded,
	UnknownOrUnverified,
	NoKnownAllergies,
	DocumentedAllergies
}

// Where the allergy information came from, when that is known.
public enum AllergySource
{
	OwnerReported,
	ReferringClinic,
	ClinicRecord
}
