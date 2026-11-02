import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import { MedicationReview } from "./MedicationReview";

describe("MedicationReview", () => {
  it("identifies the encounter and keeps conflicting source text separate and unverified", () => {
    const detail = buildCaseDetail({ caseNumber: "ER-42", medicationsAtIntake: "Stopped reported medicine" });
    detail.patient.currentMedications = "Previously reported medicine";
    const { container } = render(<MedicationReview detail={detail} />);
    const drawer = within(container);
    expect(drawer.getByText("Reconciliation status: Unknown (verification not recorded)")).toBeInTheDocument();
    expect(within(drawer.getByRole("region", { name: "Recorded at intake" })).getByText("Stopped reported medicine")).toBeInTheDocument();
    expect(within(drawer.getByRole("region", { name: "Patient record" })).getByText("Previously reported medicine")).toBeInTheDocument();
    expect(drawer.getByText("Stored patient history does not confirm current use at this encounter.")).toBeInTheDocument();
    expect(drawer.queryByRole("textbox")).not.toBeInTheDocument();
    expect(drawer.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(drawer.queryByRole("button")).not.toBeInTheDocument();
    expect(drawer.queryByText(/administered|last given|prescription/i)).not.toBeInTheDocument();
  });

  it.each([null, "", " \n "])("treats missing text %j as unknown medication use", text => {
    const detail = buildCaseDetail({ medicationsAtIntake: text });
    detail.patient.currentMedications = text;
    render(<MedicationReview detail={detail} />);
    expect(screen.getAllByText("Not recorded; medication use unknown")).toHaveLength(2);
    expect(screen.queryByText(/no medications/i)).not.toBeInTheDocument();
  });

  it.each(["Recorded at intake", "Patient record"])("does not backfill the missing %s source", missing => {
    const detail = buildCaseDetail({ medicationsAtIntake: missing === "Recorded at intake" ? null : "Reported medicine" });
    detail.patient.currentMedications = missing === "Patient record" ? null : "Reported medicine";
    render(<MedicationReview detail={detail} />);
    const empty = within(screen.getByRole("region", { name: missing }));
    expect(empty.getByText("Not recorded; medication use unknown")).toBeInTheDocument();
    expect(empty.queryByText("Reported medicine")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reported medicine")).toHaveLength(1);
  });

  it("preserves matching sources and explicit none as unverified recorded text", () => {
    const detail = buildCaseDetail({ medicationsAtIntake: "None reported" });
    detail.patient.currentMedications = "None reported";
    render(<MedicationReview detail={detail} />);
    expect(screen.getAllByText("None reported")).toHaveLength(2);
    expect(screen.getByText(/Reconciliation status: Unknown/)).toBeInTheDocument();
  });

  it("renders multiline and markup-like history as literal text without adding fields", () => {
    const text = "Reported medicine 5 mg\n<img src=x onerror=alert(1)>";
    render(<MedicationReview detail={buildCaseDetail({ medicationsAtIntake: text })} />);
    const section = within(screen.getByRole("region", { name: "Recorded at intake" }));
    expect(section.getByText(/Reported medicine 5 mg/).textContent).toBe(text);
    expect(section.queryByRole("img")).not.toBeInTheDocument();
    expect(section.queryByRole("table")).not.toBeInTheDocument();
  });

  // Orders are not recorded in VetiFlow yet (4.18).
  it("says no orders are recorded yet", () => {
    render(<MedicationReview detail={buildCaseDetail()} />);
    expect(screen.getByText("No orders are recorded in VetiFlow yet.")).toBeInTheDocument();
  });
});
