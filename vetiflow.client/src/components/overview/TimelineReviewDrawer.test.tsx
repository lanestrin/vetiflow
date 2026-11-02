import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { dateLabel } from "./overviewFormat";
import { StrictMode, useRef, useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail, buildCaseTask, buildPainScore, buildVitalsRecord } from "../../test/builders";
import type { CaseDetail, CaseEvent } from "../../types/CaseDetail";
import { TimelineReviewDrawer } from "./TimelineReviewDrawer";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});

function Harness({ detail }: { detail: CaseDetail }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(true);
  return <>
    <h2 ref={fallbackRef} tabIndex={-1}>Patient overview</h2>
    <button ref={triggerRef} onClick={() => setOpen(true)}>Timeline</button>
    {open && <TimelineReviewDrawer detail={detail} triggerRef={triggerRef} fallbackRef={fallbackRef}
      onClose={() => setOpen(false)} />}
  </>;
}

const at = (hour: number) => new Date(2020, 0, 2, hour).toISOString();
const actor = { id: "recorder", name: "Jordan Lee" };
function event(overrides: Partial<CaseEvent> = {}): CaseEvent {
  return { id: "event", type: "arrived", description: "Saved event", createdAt: at(8), createdBy: null, ...overrides };
}

function history() { return within(screen.getByRole("region", { name: "Recorded history" })); }
function tasks() { return within(screen.getByRole("region", { name: "Current care tasks" })); }

describe("TimelineReviewDrawer", () => {
  it("identifies the actual encounter and merges every event/vitals entry by recorded time without mutation", () => {
    const detail = buildCaseDetail({ caseNumber: "ER-42", timeline: [
      event(), event({ id: "triage", type: "triaged", createdAt: at(10), createdBy: actor })
    ], vitals: [
      buildVitalsRecord({ id: "new", recordedAt: at(11), recordedBy: actor }),
      buildVitalsRecord({ id: "event", recordedAt: at(9), mentation: "Alert" })
    ] });
    Object.freeze(detail.timeline);
    Object.freeze(detail.vitals);
    render(<Harness detail={detail} />);

    expect(screen.getByRole("dialog", { name: "Timeline" })).toHaveAccessibleDescription(`${detail.patient.name} · Case ER-42 · ${dateLabel(detail.arrivalTime)}`);
    expect(history().getAllByRole("heading", { level: 4 }).map(row => row.textContent)).toEqual([
      "Arrived", "Vitals recorded", "Triage completed", "Vitals recorded"
    ]);
    expect(history().getAllByRole("listitem").map(row => row.textContent)).toEqual([
      "ArrivedSaved eventRecorded 2 Jan 2020, 8:00 AM",
      "Vitals recordedMeasurement time unknownEntered 2 Jan 2020, 9:00 AMFirst vitals saved for this case",
      "Triage completedSaved eventRecorded 2 Jan 2020, 10:00 AMRecorded by Jordan Lee",
      "Vitals recordedMeasurement time unknownEntered 2 Jan 2020, 11:00 AMEntered by Jordan Lee"
        + "Compared with the set entered 2 Jan 2020, 9:00 AMMentationNot recorded in this set; previous set Alert"
    ]);
    expect(detail.vitals.map(row => row.id)).toEqual(["new", "event"]);
    expect(detail.timeline.map(row => row.id)).toEqual(["event", "triage"]);
    expect(history().queryByText("Alert")).not.toBeInTheDocument();
  });

  it("keeps equal-time source order, puts undated rows last and never substitutes a timestamp", () => {
    render(<Harness detail={buildCaseDetail({ timeline: [
      event({ id: "bad", description: "Undated event", createdAt: "bad-time" }),
      event({ id: "first", description: "First equal event" }),
      event({ id: "second", description: "Second equal event" })
    ], vitals: [buildVitalsRecord({ recordedAt: at(8) }), buildVitalsRecord({ recordedAt: "" })] })} />);
    const rows = history().getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("First equal eventRecorded 2 Jan 2020, 8:00 AM");
    expect(rows[1]).toHaveTextContent("Second equal event");
    expect(rows[2]).toHaveTextContent("Vitals recordedMeasurement time unknownEntered 2 Jan 2020, 8:00 AM");
    expect(rows[3]).toHaveTextContent("Undated eventRecorded Time not available");
    expect(rows[4]).toHaveTextContent("Vitals recordedMeasurement time unknownEntry time unavailable");
  });

  it("shows honest empty states without inventing arrival, triage or pain history", () => {
    render(<Harness detail={buildCaseDetail({ triageAssessments: [
      { id: "triage", acuity: "urgent", occurredAt: null, assessedAt: at(7), assessedBy: actor, rawIntakeNotes: "Private intake" }
    ], latestPainScore: buildPainScore({ notes: "Private pain note" }) })} />);
    expect(history().getByText("No history recorded")).toBeInTheDocument();
    expect(tasks().getByText("No tasks recorded")).toBeInTheDocument();
    expect(history().queryByText(/Separate event or measurement times are not available/)).not.toBeInTheDocument();
    expect(history().getByText(/Vitals show when they were measured where that was recorded/)).toBeInTheDocument();
    expect(history().queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/Private intake|Private pain note|Arrived|Triage completed/)).not.toBeInTheDocument();
  });

  it("shows a retrospective measurement apart from its entry without moving the row or calling it recent", () => {
    render(<Harness detail={buildCaseDetail({ timeline: [
      event({ description: "Earlier event", createdAt: at(8) }), event({ id: "later", description: "Later event", createdAt: at(10) })
    ], vitals: [
      buildVitalsRecord({ occurredAt: new Date(2020, 0, 1, 23, 0).toISOString(), recordedAt: at(9), recordedBy: actor })
    ] })} />);
    const rows = history().getAllByRole("listitem");
    expect(rows.map(row => within(row).getByRole("heading").textContent)).toEqual(["Arrived", "Vitals recorded", "Arrived"]);
    const vitals = within(rows[1]);
    expect(vitals.getByText(/^Measured/)).toHaveTextContent(/^Measured \d+ days? ago · 1 Jan 2020, 11:00 PM$/);
    expect(vitals.getByText("Entered")).toHaveTextContent("Entered 2 Jan 2020, 9:00 AM");
    expect(vitals.getByText("Entered by Jordan Lee")).toBeInTheDocument();
    expect(rows[1]).not.toHaveTextContent(/less than|recent|normal|fresh|current/i);
    expect(history().getAllByText(/^Measure/)).toHaveLength(1);
  });

  it.each([
    ["bad-time", "Measurement time unavailable"],
    [new Date(Date.now() + 60 * 60_000).toISOString(), "Measurement time is in the future"]
  ])("is honest about a vitals occurredAt of %s", (occurredAt, label) => {
    render(<Harness detail={buildCaseDetail({ vitals: [buildVitalsRecord({ occurredAt, recordedAt: at(9) })] })} />);
    const row = history().getByRole("listitem");
    expect(within(row).getByText(label)).toBeInTheDocument();
    expect(row).not.toHaveTextContent(/ago/);
    expect(within(row).getByText("Entered")).toHaveTextContent("Entered 2 Jan 2020, 9:00 AM");
  });

  it("handles event-only and vitals-only refreshes without inventing unknown actors", () => {
    const detail = buildCaseDetail({ timeline: [event()] });
    const view = render(<Harness detail={detail} />);
    expect(history().getAllByRole("listitem")).toHaveLength(1);
    expect(history().queryByText(/Recorded by/)).not.toBeInTheDocument();
    view.rerender(<Harness detail={{ ...detail, timeline: [], vitals: [buildVitalsRecord({ recordedAt: at(9) })] }} />);
    expect(history().getAllByRole("listitem")).toHaveLength(1);
    expect(history().getByText("Vitals recorded")).toBeInTheDocument();
    expect(history().queryByText("Saved event")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Timeline" })).toHaveFocus();
  });

  it("shows all current task types/statuses and distinguishes creators, assignees and resolution actors", () => {
    render(<Harness detail={buildCaseDetail({ tasks: [
      buildCaseTask({ description: "Open blocker", type: "blocker", assignedTo: actor, createdAt: at(8),
        createdBy: { id: "creator", name: "Creator" }, dueAt: at(10) }),
      buildCaseTask({ description: "Done task", status: "done", createdAt: at(8), resolvedAt: at(9),
        resolvedBy: { id: "resolver", name: "Resolver" } }),
      buildCaseTask({ description: "Cancelled recheck", type: "reassessment", status: "cancelled", createdAt: at(8),
        resolvedAt: at(10), resolvedBy: actor }),
      buildCaseTask({ description: "Owner update", type: "clientUpdate", createdAt: at(8) })
    ] })} />);
    const rows = tasks().getAllByRole("listitem").map(row => within(row));
    expect(rows).toHaveLength(4);
    expect(rows[0].getByText("Blocker · Open")).toBeInTheDocument();
    expect(rows[0].getAllByRole("definition").map(value => value.textContent)).toEqual([
      "2 Jan 2020, 8:00 AM", "Creator", "Jordan Lee", "2 Jan 2020, 10:00 AM"
    ]);
    expect(rows[0].getByText("Scheduled due")).toBeInTheDocument();
    expect(rows[0].queryByText("Completed")).not.toBeInTheDocument();
    expect(rows[1].getByText("Task · Done")).toBeInTheDocument();
    expect(rows[1].getByText("Completed by")).toBeInTheDocument();
    expect(rows[1].getByText("Resolver")).toBeInTheDocument();
    expect(rows[2].getByText("Reassessment · Cancelled")).toBeInTheDocument();
    expect(rows[2].getByText("Resolved")).toBeInTheDocument();
    expect(rows[2].queryByText("Completed")).not.toBeInTheDocument();
    expect(rows[3].getByText("Client update · Open")).toBeInTheDocument();
    expect(tasks().getByText(/current task state, not every prior change/)).toBeInTheDocument();
  });

  it("does not invent task metadata or treat reopened/current tasks as immutable history", () => {
    render(<Harness detail={buildCaseDetail({ tasks: [
      buildCaseTask({ status: "open", createdAt: "bad", dueAt: "bad", resolvedAt: at(10), resolvedBy: actor }),
      buildCaseTask({ status: "done", createdAt: at(8) }),
      buildCaseTask({ status: "cancelled", createdAt: at(8), resolvedAt: "bad" })
    ] })} />);
    const rows = tasks().getAllByRole("listitem").map(row => within(row));
    expect(rows[0].getAllByText("Time not available")).toHaveLength(2);
    expect(rows[0].queryByText(/Completed|Resolved|Jordan Lee/)).not.toBeInTheDocument();
    expect(rows[1].getAllByRole("term").map(value => value.textContent)).toEqual(["Created"]);
    expect(rows[2].getByText("Time not available")).toBeInTheDocument();
    expect(history().getByText("No history recorded")).toBeInTheDocument();
  });

  it("renders saved descriptions and actor names literally and exposes no write controls or storage", () => {
    const store = vi.spyOn(Storage.prototype, "setItem");
    render(<Harness detail={buildCaseDetail({ timeline: [event({
      description: "<img src=x onerror=alert(1)>", createdBy: { ...actor, name: "<script>name</script>" }
    })], tasks: [buildCaseTask({ description: "<b>Task</b>" })] })} />);
    expect(history().getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(history().getByText("Recorded by <script>name</script>")).toBeInTheDocument();
    expect(tasks().getByText("<b>Task</b>")).toBeInTheDocument();
    const drawer = within(screen.getByRole("dialog"));
    expect(drawer.queryByRole("img")).not.toBeInTheDocument();
    expect(drawer.queryByRole("textbox")).not.toBeInTheDocument();
    expect(drawer.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(drawer.getAllByRole("button")).toHaveLength(1);
    expect(store).not.toHaveBeenCalled();
  });

  it.each(["Close", "Escape"])("focuses Close and restores Timeline after %s", method => {
    render(<Harness detail={buildCaseDetail()} />);
    expect(screen.getByRole("button", { name: "Close Timeline" })).toHaveFocus();
    if (method === "Close") fireEvent.click(screen.getByRole("button", { name: "Close Timeline" }));
    else fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline" })).toHaveFocus();
  });

  it("retains Timeline on backdrop/blank-space clicks", () => {
    render(<Harness detail={buildCaseDetail()} />);
    fireEvent.click(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("heading", { name: "Timeline" }));
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("survives delayed native-close events during StrictMode initialization", async () => {
    vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      setTimeout(() => this.dispatchEvent(new Event("close")), 0);
    });
    render(<StrictMode><Harness detail={buildCaseDetail()} /></StrictMode>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(screen.getByRole("dialog", { name: "Timeline" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close Timeline" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Timeline" })).toHaveFocus();
  });
});

// Changes since the previous saved vitals set (build plan 4.8g).
describe("vitals changes in the Timeline", () => {
  it("says the oldest set is the first, and compares each later set with the set saved before it", () => {
    const detail = buildCaseDetail({ vitals: [
      buildVitalsRecord({ id: "third", recordedAt: at(11), heartRate: 140, respiratoryRate: 40 }),
      buildVitalsRecord({ id: "second", recordedAt: at(10), heartRate: 148, respiratoryRate: 40, spO2: 95 }),
      buildVitalsRecord({ id: "first", recordedAt: at(9), heartRate: 160 })
    ] });
    render(<Harness detail={detail} />);

    const rows = history().getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("First vitals saved for this case");
    expect(rows[0]).not.toHaveTextContent("Compared with");

    const second = within(rows[1]);
    expect(second.getByText(/Compared with the set entered/)).toHaveTextContent("9:00 AM");
    expect(second.getByText("160 bpm → 148 bpm")).toBeInTheDocument();
    expect(second.getByText("40 /min, not recorded in the previous set")).toBeInTheDocument();
    expect(second.getByText("95%, not recorded in the previous set")).toBeInTheDocument();

    const third = within(rows[2]);
    expect(third.getByText(/Compared with the set entered/)).toHaveTextContent("10:00 AM");
    expect(third.getByText("148 bpm → 140 bpm")).toBeInTheDocument();
    expect(third.getByText("Not recorded in this set; previous set 95%")).toBeInTheDocument();
    expect(third.getByText("Respiratory rate 40 /min")).toBeInTheDocument();
    expect(rows[2]).not.toHaveTextContent(/improved|worse|increase|decrease/i);
  });
});
