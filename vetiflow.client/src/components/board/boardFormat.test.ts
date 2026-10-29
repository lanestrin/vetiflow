import { describe, expect, it } from "vitest";
import { buildCase } from "../../test/builders";
import {
  ageLabel,
  caseStatusLabel,
  matchesMenuFilters,
  matchesSearch,
  minutesSince,
  noMenuFilters,
  sortByLongestInStage,
  stageLabel,
  waitChipLabel
} from "./boardFormat";

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

describe("caseStatusLabel", () => {
  it.each([
    ["unassigned", "Unassigned"],
    ["assigned", "Assigned"],
    ["waiting", "Waiting"],
    ["inProgress", "In progress"],
    ["blocked", "Blocked"],
    ["readyForNextStep", "Ready for next step"],
    ["completed", "Completed"]
  ] as const)("labels %s as %s", (status, label) => {
    expect(caseStatusLabel(status)).toBe(label);
  });
});

describe("matchesMenuFilters", () => {
  const reed = { id: "staff-reed", shortName: "Reed", initials: "JR" };
  const reedsCat = buildCase({ clinician: reed, species: "Cat", status: "waiting" });
  const unassignedDog = buildCase({ clinician: null, species: "Dog", status: "unassigned" });

  it("matches every case with no filters in use", () => {
    expect(matchesMenuFilters(reedsCat, noMenuFilters)).toBe(true);
    expect(matchesMenuFilters(unassignedDog, noMenuFilters)).toBe(true);
  });

  it("filters by clinician", () => {
    const filters = { ...noMenuFilters, clinicianId: "staff-reed" };

    expect(matchesMenuFilters(reedsCat, filters)).toBe(true);
    expect(matchesMenuFilters(unassignedDog, filters)).toBe(false);
  });

  it("filters to cases with no clinician", () => {
    const filters = { ...noMenuFilters, clinicianId: "unassigned" };

    expect(matchesMenuFilters(unassignedDog, filters)).toBe(true);
    expect(matchesMenuFilters(reedsCat, filters)).toBe(false);
  });

  it("filters by species", () => {
    const filters = { ...noMenuFilters, species: "Dog" };

    expect(matchesMenuFilters(unassignedDog, filters)).toBe(true);
    expect(matchesMenuFilters(reedsCat, filters)).toBe(false);
  });

  it("filters by case status", () => {
    const filters = { ...noMenuFilters, status: "waiting" as const };

    expect(matchesMenuFilters(reedsCat, filters)).toBe(true);
    expect(matchesMenuFilters(unassignedDog, filters)).toBe(false);
  });

  it("needs every filter in use to match", () => {
    expect(matchesMenuFilters(reedsCat, { clinicianId: "staff-reed", species: "Cat", status: "waiting" })).toBe(true);
    expect(matchesMenuFilters(reedsCat, { clinicianId: "staff-reed", species: "Cat", status: "blocked" })).toBe(false);
  });
});

describe("sortByLongestInStage", () => {
  const recent = buildCase({ id: "recent", stageEnteredAt: "2026-10-28T11:55:00Z" });
  const longest = buildCase({ id: "longest", stageEnteredAt: "2026-10-28T11:20:00Z" });
  const tiedFirst = buildCase({ id: "tied-first", stageEnteredAt: "2026-10-28T11:40:00Z" });
  const tiedSecond = buildCase({ id: "tied-second", stageEnteredAt: "2026-10-28T11:40:00Z" });

  it("puts the case longest in its stage first", () => {
    const sorted = sortByLongestInStage([recent, longest]);

    expect(sorted.map((emergencyCase) => emergencyCase.id)).toEqual(["longest", "recent"]);
  });

  it("keeps the given order for equal stage times", () => {
    const sorted = sortByLongestInStage([recent, tiedFirst, tiedSecond]);

    expect(sorted.map((emergencyCase) => emergencyCase.id)).toEqual(["tied-first", "tied-second", "recent"]);
  });

  it("leaves the given cases unchanged", () => {
    const cases = [recent, longest];

    sortByLongestInStage(cases);

    expect(cases).toEqual([recent, longest]);
  });
});
