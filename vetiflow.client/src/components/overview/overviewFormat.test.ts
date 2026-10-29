import { describe, expect, it } from "vitest";
import { buildCaseTask } from "../../test/builders";
import type { CaseEventType } from "../../types/CaseDetail";
import {
  checkInLabel,
  dueLabel,
  eventDetail,
  eventLabel,
  isOverdue,
  locationLabel,
  longAgeLabel,
  speciesKind,
  taskMeta,
  temperatureLabel,
  timeLabel,
  weightLabel
} from "./overviewFormat";

// Local times, so the labels read the same in any test time zone.
const now = new Date(2026, 9, 28, 12, 0);

describe("checkInLabel", () => {
  it("shows the time for a check-in today", () => {
    expect(checkInLabel(new Date(2026, 9, 28, 10, 42).toISOString(), now)).toBe("Checked in 10:42 AM");
  });

  it("adds the day for a check-in before today", () => {
    expect(checkInLabel(new Date(2026, 9, 27, 22, 42).toISOString(), now)).toBe("Checked in 27 Oct, 10:42 PM");
  });
});

describe("longAgeLabel", () => {
  it.each([
    ["2018-07-01", "8 years"],
    ["2025-07-01", "1 year"],
    ["2026-04-10", "6 months"],
    ["2026-09-01", "1 month"],
    ["2026-10-20", "Under 1 month"]
  ])("shows a pet born %s as %s", (dateOfBirth, label) => {
    expect(longAgeLabel(dateOfBirth, new Date("2026-10-28T12:00:00Z"))).toBe(label);
  });

  it("shows nothing when the date of birth is not recorded", () => {
    expect(longAgeLabel(null, now)).toBeNull();
  });
});

describe("weightLabel and temperatureLabel", () => {
  it("show kilograms and °C from the stored °F", () => {
    expect(weightLabel(31.4)).toBe("31.4 kg");
    expect(temperatureLabel(102)).toBe("38.9 °C");
    expect(temperatureLabel(101.5)).toBe("38.6 °C");
  });

  it("show nothing for a missing reading", () => {
    expect(weightLabel(null)).toBeNull();
    expect(temperatureLabel(null)).toBeNull();
  });
});

describe("locationLabel", () => {
  it.each([
    ["exam", "Exam"],
    ["treatment", "Treatment"],
    ["icu", "ICU"],
    ["oxygen", "Oxygen"],
    ["isolation", "Isolation"],
    ["surgery", "Surgery"],
    ["imaging", "Imaging"]
  ] as const)("names the %s area before the room", (type, area) => {
    expect(locationLabel({ id: "room-1", name: "Bay 2", type })).toBe(`${area} · Bay 2`);
  });

  it("says when no room is assigned", () => {
    expect(locationLabel(null)).toBe("No room assigned");
  });
});

describe("eventLabel", () => {
  it.each([
    ["arrived", "Arrived"],
    ["triaged", "Triage completed"],
    ["assigned", "Care team assigned"],
    ["stageChanged", "Stage changed"],
    ["statusChanged", "Status changed"],
    ["roomChanged", "Room changed"],
    ["noteAdded", "Note added"],
    ["diagnosticOrdered", "Diagnostic ordered"],
    ["diagnosticCompleted", "Diagnostic completed"],
    ["treatmentStarted", "Treatment started"],
    ["treatmentCompleted", "Treatment completed"],
    ["discharged", "Discharged"]
  ] satisfies [CaseEventType, string][])("labels %s as %s", (type, label) => {
    expect(eventLabel(type)).toBe(label);
  });
});

describe("eventDetail", () => {
  it("adds who did it when known", () => {
    const caseEvent = { id: "e1", type: "triaged" as const, description: "Critical", createdAt: now.toISOString(), createdBy: null };

    expect(eventDetail(caseEvent)).toBe("Critical");
    expect(eventDetail({ ...caseEvent, createdBy: { id: "s1", name: "Jordan Reed" } })).toBe("Critical · Jordan Reed");
  });
});

describe("taskMeta", () => {
  const task = buildCaseTask({ id: "t1", description: "Place IV catheter", createdAt: now.toISOString() });

  it("names the assignee, or says the task is pending", () => {
    expect(taskMeta({ ...task, assignedTo: { id: "s1", name: "Jordan Reed" } })).toBe("Jordan Reed");
    expect(taskMeta(task)).toBe("Pending");
  });

  it("names who completed a done task, or says it is done", () => {
    const done = { ...task, status: "done" as const, assignedTo: { id: "s1", name: "Jordan Reed" } };

    expect(taskMeta({ ...done, resolvedBy: { id: "s2", name: "Sam Cruz" } })).toBe("Sam Cruz");
    expect(taskMeta({ ...done, assignedTo: null })).toBe("Done");
  });
});

describe("dueLabel", () => {
  const due = (minutesFromNow: number) => new Date(now.getTime() + minutesFromNow * 60_000).toISOString();

  it.each([
    [-12, "Overdue by 12 min"],
    [-65, "Overdue by 1 h 5 min"],
    [0, "Due now"],
    [8, "Due in 8 min"],
    [59, "Due in 59 min"]
  ])("shows a due time %i minutes away as %s", (minutesFromNow, label) => {
    expect(dueLabel(due(minutesFromNow), now)).toBe(label);
  });

  it("shows the clock time from an hour away, with the day when it is not today", () => {
    expect(dueLabel(due(90), now)).toBe(`Due ${timeLabel(due(90), now)}`);
    expect(dueLabel(due(60 * 30), now)).toMatch(/^Due \d{1,2} \w{3}, /);
  });

  it("says nothing is scheduled without a due time", () => {
    expect(dueLabel(null, now)).toBe("Not scheduled");
  });

  it("marks only a past due time as overdue", () => {
    expect(isOverdue(due(-1), now)).toBe(true);
    expect(isOverdue(due(5), now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });
});

describe("speciesKind", () => {
  it.each([
    ["Dog", "dog"],
    ["canine", "dog"],
    [" Cat ", "cat"],
    ["Rabbit", "other"]
  ] as const)("treats %s as %s", (species, kind) => {
    expect(speciesKind(species)).toBe(kind);
  });
});
