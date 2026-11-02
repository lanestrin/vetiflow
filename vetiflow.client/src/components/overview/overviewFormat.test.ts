import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCaseTask } from "../../test/builders";
import type { CaseEventType } from "../../types/CaseDetail";
import {
  checkInLabel,
  dateLabel,
  dateTimeLabel,
  defaultDueTime,
  dueAtFromTime,
  dueLabel,
  eventDetail,
  eventLabel,
  isOverdue,
  locationLabel,
  measuredAgeLabel,
  recordTimeLabel,
  longAgeLabel,
  speciesKind,
  taskMeta,
  temperatureLabel,
  timeLabel,
  weightLabel
} from "./overviewFormat";

// Local times, so the labels read the same in any test time zone.
const now = new Date(2026, 9, 28, 12, 0);

describe("dateLabel and dateTimeLabel", () => {
  it("always show the full date, even for today", () => {
    const today = new Date(2026, 9, 28, 14, 5).toISOString();
    expect(dateLabel(today)).toBe("28 Oct 2026");
    expect(dateTimeLabel(today)).toBe("28 Oct 2026, 2:05 PM");
  });
});

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

describe("defaultDueTime", () => {
  it.each([
    [new Date(2026, 9, 28, 12, 0), "12:30"],
    [new Date(2026, 9, 28, 12, 1), "12:35"],
    [new Date(2026, 9, 28, 9, 34, 30), "10:05"],
    [new Date(2026, 9, 28, 23, 40), "00:10"]
  ])("gives half an hour from %s, rounded up to 5 minutes, as %s", (from, time) => {
    expect(defaultDueTime(from)).toBe(time);
  });
});

describe("dueAtFromTime", () => {
  it("gives a later time today", () => {
    expect(dueAtFromTime("12:45", now)).toBe(new Date(2026, 9, 28, 12, 45).toISOString());
  });

  it("keeps the current minute today", () => {
    expect(dueAtFromTime("12:00", new Date(2026, 9, 28, 12, 0, 40))).toBe(new Date(2026, 9, 28, 12, 0).toISOString());
  });

  it("gives tomorrow for a time that has passed", () => {
    expect(dueAtFromTime("11:15", now)).toBe(new Date(2026, 9, 29, 11, 15).toISOString());
    expect(dueAtFromTime("00:20", new Date(2026, 9, 28, 23, 50))).toBe(new Date(2026, 9, 29, 0, 20).toISOString());
  });

  it.each(["", "7:30", "noon"])("gives null for %j", (time) => {
    expect(dueAtFromTime(time, now)).toBeNull();
  });
});

describe("measuredAgeLabel", () => {
  const ago = (milliseconds: number) => new Date(now.getTime() - milliseconds).toISOString();

  it.each([
    [0, "Measured less than 1 min ago"],
    [59_999, "Measured less than 1 min ago"],
    [60_000, "Measured 1 min ago"],
    [59 * 60_000 + 59_999, "Measured 59 min ago"],
    [60 * 60_000, "Measured 1 hour ago"],
    [2 * 60 * 60_000, "Measured 2 hours ago"],
    [24 * 60 * 60_000 - 1, "Measured 23 hours ago"],
    [24 * 60 * 60_000, "Measured 1 day ago"],
    [3 * 24 * 60 * 60_000 + 5 * 60 * 60_000, "Measured 3 days ago"]
  ])("rounds %i ms down to whole units", (elapsed, label) => {
    expect(measuredAgeLabel(ago(elapsed), now)).toBe(label);
  });

  it("compares instants, not clock strings, across offsets", () => {
    const at = new Date(now.getTime() - 5 * 60_000);
    const utc = at.toISOString();
    const shifted = new Date(at.getTime() + 5.5 * 60 * 60_000).toISOString().replace("Z", "+05:30");
    expect(measuredAgeLabel(utc, now)).toBe("Measured 5 min ago");
    expect(measuredAgeLabel(shifted, now)).toBe("Measured 5 min ago");
  });

  it("says when the measurement time is unknown, invalid or in the future", () => {
    expect(measuredAgeLabel(null, now)).toBe("Measurement time unknown");
    expect(measuredAgeLabel(undefined, now)).toBe("Measurement time unknown");
    expect(measuredAgeLabel("not a time", now)).toBe("Measurement time unavailable");
    expect(measuredAgeLabel("", now)).toBe("Measurement time unavailable");
    expect(measuredAgeLabel(new Date(now.getTime() + 60_000).toISOString(), now)).toBe("Measurement time is in the future");
  });
});

describe("recordTimeLabel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads like timeLabel within the year", () => {
    expect(recordTimeLabel(new Date(2026, 9, 28, 10, 42).toISOString(), now)).toBe("10:42 AM");
    expect(recordTimeLabel(new Date(2026, 9, 27, 22, 42).toISOString(), now)).toBe("27 Oct, 10:42 PM");
  });

  it("adds the year across calendar years", () => {
    expect(recordTimeLabel(new Date(2025, 11, 31, 23, 50).toISOString(), new Date(2026, 0, 1, 0, 10)))
      .toBe("31 Dec 2025, 11:50 PM");
  });

  it("is null for a missing or invalid time", () => {
    expect(recordTimeLabel(null, now)).toBeNull();
    expect(recordTimeLabel(undefined, now)).toBeNull();
    expect(recordTimeLabel("not a time", now)).toBeNull();
  });

  it("names the zone only for a repeated daylight-saving hour", () => {
    vi.stubEnv("TZ", "America/New_York");
    // 1 Nov 2026: 1:30 AM EDT, then 1:30 AM EST an hour later.
    const first = recordTimeLabel("2026-11-01T05:30:00Z", new Date("2026-11-01T12:00:00Z"));
    const second = recordTimeLabel("2026-11-01T06:30:00Z", new Date("2026-11-01T12:00:00Z"));
    expect(first).toMatch(/ EDT$/);
    expect(second).toMatch(/ EST$/);
    expect(recordTimeLabel("2026-11-01T15:30:00Z", new Date("2026-11-01T16:00:00Z"))).not.toMatch(/E[SD]T/);
  });
});
