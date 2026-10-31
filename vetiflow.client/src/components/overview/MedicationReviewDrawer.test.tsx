import { fireEvent, render, screen, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import type { CaseDetail } from "../../types/CaseDetail";
import { MedicationReviewDrawer } from "./MedicationReviewDrawer";

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
    <button ref={triggerRef} onClick={() => setOpen(true)}>Medications</button>
    {open && <MedicationReviewDrawer detail={detail} triggerRef={triggerRef} fallbackRef={fallbackRef}
      onClose={() => setOpen(false)} />}
  </>;
}

describe("MedicationReviewDrawer", () => {
  it("identifies the encounter and keeps conflicting source text separate and unverified", () => {
    const detail = buildCaseDetail({ caseNumber: "ER-42", medicationsAtIntake: "Stopped reported medicine" });
    detail.patient.currentMedications = "Previously reported medicine";
    render(<Harness detail={detail} />);
    const drawer = within(screen.getByRole("dialog", { name: "Medications" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(`${detail.patient.name} · Case ER-42`);
    expect(drawer.getByText("Reconciliation status: Unknown (verification not recorded)")).toBeInTheDocument();
    expect(within(drawer.getByRole("region", { name: "Recorded at intake" })).getByText("Stopped reported medicine")).toBeInTheDocument();
    expect(within(drawer.getByRole("region", { name: "Patient record" })).getByText("Previously reported medicine")).toBeInTheDocument();
    expect(drawer.getByText("Stored patient history does not confirm current use at this encounter.")).toBeInTheDocument();
    expect(drawer.queryByRole("textbox")).not.toBeInTheDocument();
    expect(drawer.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(drawer.getAllByRole("button")).toHaveLength(1);
    expect(drawer.queryByText(/administered|last given|prescription/i)).not.toBeInTheDocument();
  });

  it.each([null, "", " \n "])("treats missing text %j as unknown medication use", text => {
    const detail = buildCaseDetail({ medicationsAtIntake: text });
    detail.patient.currentMedications = text;
    render(<Harness detail={detail} />);
    expect(screen.getAllByText("Not recorded; medication use unknown")).toHaveLength(2);
    expect(screen.queryByText(/no medications/i)).not.toBeInTheDocument();
  });

  it.each(["Recorded at intake", "Patient record"])("does not backfill the missing %s source", missing => {
    const detail = buildCaseDetail({ medicationsAtIntake: missing === "Recorded at intake" ? null : "Reported medicine" });
    detail.patient.currentMedications = missing === "Patient record" ? null : "Reported medicine";
    render(<Harness detail={detail} />);
    const empty = within(screen.getByRole("region", { name: missing }));
    expect(empty.getByText("Not recorded; medication use unknown")).toBeInTheDocument();
    expect(empty.queryByText("Reported medicine")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reported medicine")).toHaveLength(1);
  });

  it("preserves matching sources and explicit none as unverified recorded text", () => {
    const detail = buildCaseDetail({ medicationsAtIntake: "None reported" });
    detail.patient.currentMedications = "None reported";
    render(<Harness detail={detail} />);
    expect(screen.getAllByText("None reported")).toHaveLength(2);
    expect(screen.getByText(/Reconciliation status: Unknown/)).toBeInTheDocument();
  });

  it("renders multiline and markup-like history as literal text without adding fields", () => {
    const text = "Reported medicine 5 mg\n<img src=x onerror=alert(1)>";
    render(<Harness detail={buildCaseDetail({ medicationsAtIntake: text })} />);
    const section = within(screen.getByRole("region", { name: "Recorded at intake" }));
    expect(section.getByText(/Reported medicine 5 mg/).textContent).toBe(text);
    expect(section.queryByRole("img")).not.toBeInTheDocument();
    expect(section.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each(["Close", "Escape"])("returns focus to Medications after %s", method => {
    render(<Harness detail={buildCaseDetail()} />);
    expect(screen.getByRole("button", { name: "Close Medications" })).toHaveFocus();
    if (method === "Close") fireEvent.click(screen.getByRole("button", { name: "Close Medications" }));
    else fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Medications" })).toHaveFocus();
  });
});
