import { describe, expect, it } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import type { AllergyStatus, CaseDetail } from "../../types/CaseDetail";
import { allergySummary, intakeAllergyLabel } from "./allergyStatus";

function detailWith(
  allergyStatus: AllergyStatus,
  allergies: string | null,
  atIntake: { status: AllergyStatus; text: string | null } = { status: "unknownOrUnverified", text: allergies }
): CaseDetail {
  const base = buildCaseDetail();
  return {
    ...base,
    allergyStatusAtIntake: atIntake.status,
    allergiesAtIntake: atIntake.text,
    patient: { ...base.patient, allergyStatus, allergies }
  };
}

describe("allergySummary", () => {
  it.each([
    ["notRecorded", null, "Not recorded"],
    ["unknownOrUnverified", "Penicillin", "Penicillin · not verified"],
    ["unknownOrUnverified", null, "Unknown · not verified"],
    ["noKnownAllergies", null, "No known allergies · verified"],
    ["documentedAllergies", "Penicillin", "Penicillin · verified"]
  ] as const)("shows %s with text %s as %s", (status, text, expected) => {
    const atIntake = status === "notRecorded" ? { status: "notRecorded" as const, text: null } : undefined;
    expect(allergySummary(detailWith(status, text, atIntake))).toBe(expected);
  });

  it.each(["None", "NKA", "no known allergies"])("never reads unverified text %s as no known allergies", (text) => {
    expect(allergySummary(detailWith("unknownOrUnverified", text))).toBe(`${text} · not verified`);
  });

  it("notes an earlier record that this visit's intake did not recheck", () => {
    const detail = detailWith("unknownOrUnverified", "Chicken", { status: "notRecorded", text: null });

    expect(allergySummary(detail)).toBe("Chicken · not verified · not rechecked at this visit's intake");
  });

  it("adds no note when nothing is recorded anywhere", () => {
    expect(allergySummary(detailWith("notRecorded", null, { status: "notRecorded", text: null }))).toBe("Not recorded");
  });
});

describe("intakeAllergyLabel", () => {
  it("shows what this visit's intake recorded, never as verified", () => {
    expect(intakeAllergyLabel(detailWith("unknownOrUnverified", "Penicillin"))).toBe("Penicillin · not verified");
    expect(intakeAllergyLabel(detailWith("noKnownAllergies", null, { status: "notRecorded", text: null })))
      .toBe("Not recorded at this visit's intake");
  });
});
