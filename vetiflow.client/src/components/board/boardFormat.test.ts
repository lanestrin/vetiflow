import { describe, expect, it } from "vitest";
import { buildCase } from "../../test/builders";
import { ageLabel, matchesSearch, minutesSince, stageLabel, waitChipLabel } from "./boardFormat";

const now = new Date("2026-10-28T12:00:00Z");

describe("minutesSince", () => {
  it("counts whole minutes and never goes below zero", () => {
    expect(minutesSince("2026-10-28T11:41:30Z", now)).toBe(18);
    expect(minutesSince("2026-10-28T12:05:00Z", now)).toBe(0);
  });
});

describe("ageLabel", () => {
  it.each([
    ["2018-07-01", "8y"],
    ["2018-10-28", "8y"],
    ["2018-10-29", "7y"],
    ["2026-04-10", "6mo"],
    ["2026-10-20", "<1mo"]
  ])("shows a pet born %s as %s", (dateOfBirth, label) => {
    expect(ageLabel(dateOfBirth, now)).toBe(label);
  });

  it("shows nothing when the date of birth is not recorded", () => {
    expect(ageLabel(null, now)).toBeNull();
  });
});

describe("waitChipLabel", () => {
  it.each([
    ["stat", "STAT"],
    ["ready", "Ready"],
    ["recheck", "Recheck"],
    ["new", "New"]
  ] as const)("labels %s as %s", (chip, label) => {
    expect(waitChipLabel(chip, "2026-10-28T11:00:00Z", now)).toBe(label);
  });

  it("counts minutes since arrival", () => {
    expect(waitChipLabel("minutes", "2026-10-28T11:42:00Z", now)).toBe("18 min");
  });
});

describe("stageLabel", () => {
  it.each([
    ["incoming", "Awaiting triage"],
    ["triage", "Triage"],
    ["treatment", "In treatment"],
    ["diagnostics", "Diagnostics"],
    ["recheck", "Recheck"],
    ["discharge", "Discharge"]
  ] as const)("labels %s as %s", (stage, label) => {
    expect(stageLabel(stage)).toBe(label);
  });
});

describe("matchesSearch", () => {
  const milo = buildCase({
    patientName: "Milo",
    caseNumber: "ER-2481",
    ownerName: "Avery Chen",
    species: "Dog",
    breed: "Golden Retriever",
    presentingComplaint: "Hit by vehicle"
  });

  it.each(["Milo", "ER-2481", "Avery", "dog", "retriever", "vehicle"])("matches on \"%s\"", (search) => {
    expect(matchesSearch(milo, search)).toBe(true);
  });

  it("ignores case and surrounding spaces", () => {
    expect(matchesSearch(milo, "  gOLDEN  ")).toBe(true);
  });

  it("matches every case when the search is empty", () => {
    expect(matchesSearch(milo, "")).toBe(true);
    expect(matchesSearch(milo, "   ")).toBe(true);
  });

  it("skips a missing owner name", () => {
    expect(matchesSearch(buildCase({ patientName: "Rex", ownerName: null }), "rex")).toBe(true);
    expect(matchesSearch(buildCase({ patientName: "Rex", ownerName: null }), "chen")).toBe(false);
  });

  it("does not match text found in no field", () => {
    expect(matchesSearch(milo, "cat")).toBe(false);
  });
});
