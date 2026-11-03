import { describe, expect, it } from "vitest";
import { buildBoardSummary, buildCase } from "../../test/builders";
import {
  ageLabel,
  caseStatusLabel,
  isCriticalWithoutVet,
  matchesMenuFilters,
  matchesSearch,
  matchesUnassigned,
  minutesSince,
  noMenuFilters,
  noTechnician,
  noVeterinarian,
  shiftChipLabel,
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
  const reed = { id: "staff-reed", name: "Jordan Reed" };
  const cruz = { id: "staff-cruz", name: "Sam Cruz" };
  const reedsCat = buildCase({ acuity: "critical", assignedDoctor: reed, assignedTechnician: cruz, species: "Cat", status: "waiting" });
  const unassignedDog = buildCase({ acuity: "stable", assignedDoctor: null, assignedTechnician: null, species: "Dog", status: "unassigned" });
  const cruzOnly = buildCase({ acuity: "urgent", assignedDoctor: null, assignedTechnician: cruz });

  it("matches every case with no filters in use", () => {
    expect(matchesMenuFilters(reedsCat, noMenuFilters)).toBe(true);
    expect(matchesMenuFilters(unassignedDog, noMenuFilters)).toBe(true);
  });

  it("matches a chosen acuity", () => {
    const filters = { ...noMenuFilters, acuity: "critical" as const };

    expect(matchesMenuFilters(reedsCat, filters)).toBe(true);
    expect(matchesMenuFilters(unassignedDog, filters)).toBe(false);
  });

  it("matches staff as either the technician or the veterinarian", () => {
    const asTechnician = { ...noMenuFilters, staff: "staff-cruz" };
    const asVeterinarian = { ...noMenuFilters, staff: "staff-reed" };

    expect(matchesMenuFilters(reedsCat, asTechnician)).toBe(true);
    expect(matchesMenuFilters(cruzOnly, asTechnician)).toBe(true);
    expect(matchesMenuFilters(reedsCat, asVeterinarian)).toBe(true);
    expect(matchesMenuFilters(cruzOnly, asVeterinarian)).toBe(false);
    expect(matchesMenuFilters(unassignedDog, asTechnician)).toBe(false);
  });

  it("matches cases with no technician or no veterinarian", () => {
    const missingTechnician = { ...noMenuFilters, staff: noTechnician };
    const missingVeterinarian = { ...noMenuFilters, staff: noVeterinarian };

    expect(matchesMenuFilters(unassignedDog, missingTechnician)).toBe(true);
    expect(matchesMenuFilters(cruzOnly, missingTechnician)).toBe(false);
    expect(matchesMenuFilters(cruzOnly, missingVeterinarian)).toBe(true);
    expect(matchesMenuFilters(reedsCat, missingVeterinarian)).toBe(false);
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

  it("needs every chosen filter to match", () => {
    expect(matchesMenuFilters(reedsCat, { acuity: "critical", staff: "staff-reed", species: "Cat", status: "waiting" })).toBe(true);
    expect(matchesMenuFilters(reedsCat, { acuity: "critical", staff: "staff-reed", species: "Cat", status: "blocked" })).toBe(false);
    expect(matchesMenuFilters(reedsCat, { acuity: "urgent", staff: "staff-reed", species: "Cat", status: "waiting" })).toBe(false);
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

describe("shiftChipLabel", () => {
  it.each([
    ["day", 4, "Day shift · 4 clinicians on floor"],
    ["night", 1, "Night shift · 1 clinician on floor"],
    ["day", 0, "Day shift · 0 clinicians on floor"]
  ] as const)("shows the %s shift with %i on the floor", (name, cliniciansOnFloor, label) => {
    const summary = buildBoardSummary({ shift: { name, startedAt: now.toISOString() }, cliniciansOnFloor });

    expect(shiftChipLabel(summary)).toBe(label);
  });
});

describe("isCriticalWithoutVet", () => {
  it("counts critical cases with no attending veterinarian, whether or not a technician is assigned", () => {
    const technician = { id: "t1", name: "Sam Cruz" };
    const veterinarian = { id: "v1", name: "Jordan Lee" };

    expect(isCriticalWithoutVet(buildCase({ acuity: "critical", assignedDoctor: null, assignedTechnician: null }))).toBe(true);
    expect(isCriticalWithoutVet(buildCase({ acuity: "critical", assignedDoctor: null, assignedTechnician: technician }))).toBe(true);
    expect(isCriticalWithoutVet(buildCase({ acuity: "critical", assignedDoctor: veterinarian }))).toBe(false);
    expect(isCriticalWithoutVet(buildCase({ acuity: "urgent", assignedDoctor: null }))).toBe(false);
  });
});

describe("matchesUnassigned", () => {
  it("treats a case missing either assignment as unassigned", () => {
    const tech = { id: "t1", name: "Sam Cruz" };
    const vet = { id: "v1", name: "Jordan Lee" };

    expect(matchesUnassigned(buildCase({ assignedTechnician: tech, assignedDoctor: vet }))).toBe(false);
    expect(matchesUnassigned(buildCase({ assignedTechnician: null, assignedDoctor: vet }))).toBe(true);
    expect(matchesUnassigned(buildCase({ assignedTechnician: tech, assignedDoctor: null }))).toBe(true);
    expect(matchesUnassigned(buildCase({ assignedTechnician: null, assignedDoctor: null }))).toBe(true);
  });
});
