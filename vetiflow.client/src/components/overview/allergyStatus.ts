import type { AllergySource, AllergyStatus, CaseDetail } from "../../types/CaseDetail";

// Staff wording for the stored allergy status (build plan 4.12b). It comes
// from the status only, never from the text: "None" typed at intake is still
// not verified. Only the verified statuses say "verified".

export const allergyStatusLabels: Record<AllergyStatus, string> = {
  notRecorded: "Not recorded",
  unknownOrUnverified: "Unknown or not verified",
  noKnownAllergies: "No known allergies · verified",
  documentedAllergies: "Documented allergies · verified"
};

export const allergySourceLabels: Record<AllergySource, string> = {
  ownerReported: "Owner reported",
  referringClinic: "Referring clinic records",
  clinicRecord: "This clinic's record"
};

function reported(text: string | null): string | null {
  return text?.trim() || null;
}

// The patient's carried record in one line, noting when this visit's intake
// recorded nothing so an earlier record is not read as freshly checked.
export function allergySummary(detail: CaseDetail): string {
  const { allergyStatus, allergies } = detail.patient;
  const text = reported(allergies);
  const summaries: Record<AllergyStatus, string> = {
    notRecorded: "Not recorded",
    unknownOrUnverified: `${text ?? "Unknown"} · not verified`,
    noKnownAllergies: "No known allergies · verified",
    documentedAllergies: `${text ?? "Documented allergies"} · verified`
  };
  const summary = summaries[allergyStatus];

  return detail.allergyStatusAtIntake === "notRecorded" && allergyStatus !== "notRecorded"
    ? `${summary} · not rechecked at this visit's intake`
    : summary;
}

// What this visit's intake recorded: an intake never verifies.
export function intakeAllergyLabel(detail: CaseDetail): string {
  const text = reported(detail.allergiesAtIntake);
  return detail.allergyStatusAtIntake === "notRecorded" || text === null
    ? "Not recorded at this visit's intake"
    : `${text} · not verified`;
}
