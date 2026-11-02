import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail, buildVitalsRecord } from "../../test/builders";
import type { CaseDetail } from "../../types/CaseDetail";
import { ClinicalReviewDrawer } from "./ClinicalReviewDrawer";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});

function Harness({ detail, onClose = () => {} }: { detail: CaseDetail; onClose?: () => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(true);
  return <>
    <h2 ref={fallbackRef} tabIndex={-1}>Patient overview</h2>
    <button ref={triggerRef} onClick={() => setOpen(true)}>Clinical</button>
    {open && <ClinicalReviewDrawer detail={detail} triggerRef={triggerRef} fallbackRef={fallbackRef}
      onClose={() => { setOpen(false); onClose(); }} />}
  </>;
}

const enteredAt = new Date(2020, 0, 2, 9, 3).toISOString();
const complete = () => buildVitalsRecord({ heartRate: 120, respiratoryRate: 28, temperatureF: 102,
  spO2: 97, mucousMembraneColor: "Pink", capillaryRefillTime: "2 s", mentation: "Not assessed",
  recordedAt: enteredAt, recordedBy: { id: "staff-1", name: "Jordan Lee" }, outOfRange: ["heartRate", "spO2"] });

// The vitals and assessment sections, apart from the Allergies section (4.12b).
const vitalsSection = () => within(screen.getByRole("region", { name: "Latest recorded vitals" }));
const assessmentSection = () => within(screen.getByRole("region", { name: "Clinical assessment" }));

describe("ClinicalReviewDrawer", () => {
  it("ignores a delayed cleanup close after Strict Mode reopens the native dialog", async () => {
    vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      setTimeout(() => this.dispatchEvent(new Event("close")), 0);
    });
    render(<StrictMode><Harness detail={buildCaseDetail()} /></StrictMode>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(screen.getByRole("dialog", { name: "Clinical" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close Clinical" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Close Clinical" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Clinical" })).toHaveFocus();
  });

  it("shows only recorded latest values with units, literal findings and entry metadata", () => {
    const latest = complete();
    latest.mucousMembraneColor = "<img src=x>";
    const detail = buildCaseDetail({ caseNumber: "ER-42", arrivalTime: "2026-10-30T12:00:00Z", vitals: [latest] });
    render(<Harness detail={detail} />);
    const drawer = within(screen.getByRole("dialog", { name: "Clinical" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(`${detail.patient.name} · Case ER-42 · 30 Oct 2026`);
    // The Allergies section (4.12b) has its own definitions; these are the readings and findings.
    expect([...vitalsSection().getAllByRole("definition"), ...assessmentSection().getAllByRole("definition")]
      .map(value => value.textContent)).toEqual([
      "120 bpm", "28 /min", "38.9 °C", "97%", "<img src=x>", "2 s", "Not assessed"
    ]);
    expect(drawer.getByText("Measurement time unknown")).toBeInTheDocument();
    expect(drawer.getByText("Entered")).toHaveTextContent(/^Entered 2 Jan 2020, 9:03 AM$/);
    expect(drawer.getByText("Entered by Jordan Lee")).toBeInTheDocument();
    expect(drawer.queryByText("Outside range")).not.toBeInTheDocument();
    expect(drawer.queryByRole("textbox")).not.toBeInTheDocument();
    expect(drawer.getAllByRole("button")).toHaveLength(1);
  });

  it("does not backfill a partial newest set or invent a recorder", () => {
    render(<Harness detail={buildCaseDetail({ vitals: [
      buildVitalsRecord({ heartRate: 0, recordedAt: enteredAt }), complete()
    ] })} />);
    const drawer = within(screen.getByRole("dialog"));
    expect(drawer.getByText("0 bpm")).toBeInTheDocument();
    expect(vitalsSection().getAllByText("Not recorded")).toHaveLength(3);
    expect(drawer.getByText("No assessment findings recorded in this set")).toBeInTheDocument();
    expect(drawer.getByText("Entered")).toHaveTextContent(/^Entered 2 Jan 2020, 9:03 AM$/);
    expect(drawer.queryByText("Pink")).not.toBeInTheDocument();
    expect(drawer.queryByText(/Jordan Lee/)).not.toBeInTheDocument();
  });

  it("supports observation-only sets and omits blank finding rows", () => {
    render(<Harness detail={buildCaseDetail({ vitals: [buildVitalsRecord({ mentation: "Alert", mucousMembraneColor: " " })] })} />);
    const drawer = within(screen.getByRole("dialog"));
    expect(vitalsSection().getAllByText("Not recorded")).toHaveLength(4);
    expect(drawer.getByText("Alert")).toBeInTheDocument();
    expect(drawer.queryByText("Mucous membrane colour")).not.toBeInTheDocument();
    expect(drawer.queryByText("Capillary refill time")).not.toBeInTheDocument();
  });

  it("shows honest empty states without fabricated metadata", () => {
    render(<Harness detail={buildCaseDetail()} />);
    const drawer = within(screen.getByRole("dialog"));
    expect(drawer.getByText("No vitals recorded")).toBeInTheDocument();
    expect(vitalsSection().getAllByText("Not recorded")).toHaveLength(4);
    expect(drawer.getByText("No assessment findings recorded")).toBeInTheDocument();
    expect(drawer.queryByText(/^Entered/)).not.toBeInTheDocument();
    expect(drawer.queryByText(/Measure/)).not.toBeInTheDocument();
  });

  describe("measurement time", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows a retrospective measurement's age apart from its entry and advances with the clock", () => {
      vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
      vi.setSystemTime(new Date(2026, 9, 28, 12, 0));
      render(<Harness detail={buildCaseDetail({ vitals: [buildVitalsRecord({ heartRate: 120,
        occurredAt: new Date(2026, 9, 28, 9, 30).toISOString(), recordedAt: new Date(2026, 9, 28, 11, 58).toISOString(),
        recordedBy: { id: "staff-1", name: "Jordan Lee" } })] })} />);
      const drawer = within(screen.getByRole("dialog"));
      expect(drawer.getByText(/^Measured/)).toHaveTextContent(/^Measured 2 hours ago · 9:30 AM$/);
      expect(drawer.getByText("Entered")).toHaveTextContent(/^Entered 11:58 AM$/);
      expect(drawer.getByText("Entered by Jordan Lee")).toBeInTheDocument();
      expect(drawer.getByText("120 bpm")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(30 * 60_000));
      expect(drawer.getByText(/^Measured/)).toHaveTextContent(/^Measured 3 hours ago · 9:30 AM$/);
      expect(drawer.getByText("Entered")).toHaveTextContent(/^Entered 11:58 AM$/);
    });

    it.each([
      ["not a time", "Measurement time unavailable"],
      [new Date(Date.now() + 60 * 60_000).toISOString(), "Measurement time is in the future"]
    ])("is honest about an occurredAt of %s without an age or event time", (occurredAt, label) => {
      render(<Harness detail={buildCaseDetail({ vitals: [buildVitalsRecord({ occurredAt })] })} />);
      const drawer = within(screen.getByRole("dialog"));
      expect(drawer.getByText(label)).toBeInTheDocument();
      expect(drawer.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it("shows an invalid entry time without a time element or a crash", () => {
      render(<Harness detail={buildCaseDetail({ vitals: [buildVitalsRecord({ heartRate: 90, recordedAt: "garbage" })] })} />);
      const drawer = within(screen.getByRole("dialog"));
      expect(drawer.getByText("Entry time unavailable")).toBeInTheDocument();
      expect(drawer.getByText("Measurement time unknown")).toBeInTheDocument();
      expect(drawer.getByText("90 bpm")).toBeInTheDocument();
      expect(drawer.queryByText("Entered")).not.toBeInTheDocument();
    });
  });

  it.each(["close", "Escape"])("focuses Close and restores the trigger after %s", method => {
    render(<Harness detail={buildCaseDetail()} />);
    expect(screen.getByRole("button", { name: "Close Clinical" })).toHaveFocus();
    if (method === "close") fireEvent.click(screen.getByRole("button", { name: "Close Clinical" }));
    else fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clinical" })).toHaveFocus();
  });

  it("ignores backdrop and empty-space clicks", () => {
    const onClose = vi.fn();
    render(<Harness detail={buildCaseDetail()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("heading", { name: "Clinical" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("updates the same case from new props without resetting focus or storing clinical values", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const detail = buildCaseDetail({ vitals: [complete()] });
    const view = render(<Harness detail={detail} />);
    view.rerender(<Harness detail={{ ...detail, vitals: [buildVitalsRecord({ heartRate: 95 })] }} />);
    const drawer = within(screen.getByRole("dialog"));
    expect(drawer.getByText("95 bpm")).toBeInTheDocument();
    expect(drawer.queryByText("120 bpm")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Clinical" })).toHaveFocus();
    expect(setItem).not.toHaveBeenCalled();
  });
});

// Changes since the previous saved vitals set (build plan 4.8g).
describe("vitals changes in Clinical", () => {
  const since = () => screen.queryByRole("region", { name: "Since the previous saved set" });

  it("lists how the latest set differs from the set saved before it", () => {
    render(<Harness detail={buildCaseDetail({ vitals: [
      buildVitalsRecord({ heartRate: 148, mentation: "Alert", recordedAt: new Date(2020, 0, 2, 10, 0).toISOString() }),
      buildVitalsRecord({ heartRate: 160, mentation: "Alert", spO2: 95, recordedAt: enteredAt })
    ] })} />);

    const changes = within(since()!);
    expect(changes.getByText(/Compared with the set entered/)).toHaveTextContent("9:03 AM");
    expect(changes.getByText("160 bpm → 148 bpm")).toBeInTheDocument();
    expect(changes.getByText("Not recorded in this set; previous set 95%")).toBeInTheDocument();
    expect(changes.getByText("Mentation Alert")).toBeInTheDocument();
  });

  it("says when the latest set is the only one, and shows nothing without vitals", () => {
    const view = render(<Harness detail={buildCaseDetail({ vitals: [complete()] })} />);
    expect(within(since()!).getByText("No earlier vitals saved for this case")).toBeInTheDocument();

    view.unmount();
    render(<Harness detail={buildCaseDetail()} />);
    expect(since()).not.toBeInTheDocument();
  });
});

// The stored allergy record (build plan 4.12b).
describe("allergies in Clinical", () => {
  const allergies = () => within(screen.getByRole("region", { name: "Allergies" }));
  const value = (term: string) => allergies().getByText(term).nextElementSibling?.textContent;

  it("names the verifier, time and source of a verified record", () => {
    const base = buildCaseDetail();
    render(<Harness detail={{
      ...base,
      allergyStatusAtIntake: "notRecorded",
      allergiesAtIntake: null,
      patient: {
        ...base.patient, allergyStatus: "documentedAllergies", allergies: "Penicillin", allergySource: "referringClinic",
        allergiesVerifiedAt: enteredAt, allergiesVerifiedBy: { id: "staff-1", name: "Jordan Lee" }
      }
    }} />);

    expect(value("Status")).toBe("Documented allergies · verified");
    expect(value("Reported allergies")).toBe("Penicillin");
    expect(value("Source")).toBe("Referring clinic records");
    expect(value("Verified")).toBe("Jordan Lee · 2 Jan 2020, 9:03 AM");
    expect(value("At this visit's intake")).toBe("Not recorded at this visit's intake");
  });

  it("says not verified, and never no known allergies, for unverified text", () => {
    const base = buildCaseDetail();
    render(<Harness detail={{
      ...base,
      allergyStatusAtIntake: "unknownOrUnverified",
      allergiesAtIntake: "None",
      patient: { ...base.patient, allergyStatus: "unknownOrUnverified", allergies: "None" }
    }} />);

    expect(value("Status")).toBe("Unknown or not verified");
    expect(value("Source")).toBe("Not recorded");
    expect(value("Verified")).toBe("Not verified");
    expect(value("At this visit's intake")).toBe("None · not verified");
    expect(allergies().queryByText(/no known allergies/i)).not.toBeInTheDocument();
  });

  it("shows a record with nothing recorded", () => {
    render(<Harness detail={buildCaseDetail()} />);

    expect(value("Status")).toBe("Not recorded");
    expect(value("Reported allergies")).toBe("None recorded");
  });
});
