import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildCaseDetail, buildVitalsRecord } from "../../test/builders";
import type { CaseDetail } from "../../types/CaseDetail";
import { ClinicalTab } from "./ClinicalTab";

const today = new Date();
const at = (hour: number, minute: number) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute).toISOString();

function renderTab(detail: CaseDetail = buildCaseDetail()) {
  return render(<ClinicalTab detail={detail} showAllergies={false} onAllergiesShown={vi.fn()} />);
}

// A <details> has the "group" role, named by its title.
const disclosure = (name: string) => screen.getByRole("group", { name });
const isSummary = (_: string, element: Element | null) => element?.tagName === "SUMMARY";
const summaryOf = (name: string) => within(disclosure(name)).getByText(isSummary);

function inOrder(elements: Element[]) {
  return elements.every((element, index) =>
    index === 0 || (elements[index - 1].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
}

describe("ClinicalTab", () => {
  it("shows the sections in Clinical.png's order", () => {
    renderTab();

    expect(inOrder([
      screen.getByRole("heading", { name: "Examination & treatment plan" }),
      disclosure("Signed documentation & nursing notes"),
      screen.getByRole("heading", { name: "Vet review requests" }),
      disclosure("Diagnostics & follow-up"),
      disclosure("Handoff & escalation"),
      disclosure("Discharge"),
      disclosure("Recorded vitals & assessment"),
      disclosure("Allergy details"),
      screen.getByText(/^Last updated/)
    ])).toBe(true);
    expect(screen.getByText("Vet workspace")).toBeInTheDocument();
  });

  it("shows the exam and plan fields disabled with the reason", () => {
    renderTab();

    const hint = "Exam and plan drafts can't be saved in VetiFlow yet.";
    expect(screen.getByText(hint)).toBeVisible();
    const fields = [
      screen.getByLabelText("Assessment / examination"),
      screen.getByLabelText("Clinical plan"),
      screen.getByLabelText("Assessment event time")
    ];
    expect(fields[0]).toHaveAttribute("placeholder", "Findings and clinical assessment");
    expect(fields[1]).toHaveAttribute("placeholder", "Plan and follow-up");
    for (const field of fields) {
      expect(field).toBeDisabled();
      expect(field).toHaveAccessibleDescription(hint);
      expect(field).toHaveAttribute("title", "Available when clinical drafts are saved in VetiFlow (4.15b).");
    }
  });

  it.each([
    ["Save draft", "Available when clinical drafts are saved in VetiFlow (4.15b)."],
    ["Sign off", "Available when clinical note signing is built (4.15d)."],
    ["＋ Request", "Available when vet review requests are built (4.16b)."],
    ["Track diagnostic", "Available when diagnostics are tracked (4.20b)."],
    ["Record handoff / concern", "Available when handoffs are recorded (6.1b)."],
    ["Review discharge readiness", "Available when discharge authorization is built (6.2b)."]
  ])("names the build item for each unavailable control: %s", (label, reason) => {
    renderTab();

    const button = screen.getByText(label, { selector: "button" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", reason);
    expect(button).toHaveAccessibleDescription(reason);
  });

  it("keeps unavailable buttons focusable and does nothing on click", () => {
    renderTab();
    const buttons = screen.getAllByRole("button");

    expect(buttons).toHaveLength(6);
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toBeDisabled();
      button.focus();
      expect(button).toHaveFocus();
      fireEvent.click(button);
      fireEvent.keyDown(button, { key: "Enter" });
      expect(button).toHaveFocus();
    }
    expect(screen.getAllByRole("group").filter(group => group.hasAttribute("open"))).toHaveLength(0);
  });

  it("shows honest summaries and empty states for documentation, diagnostics, handoff and discharge", () => {
    renderTab();

    const expected = [
      ["Signed documentation & nursing notes", "0", "No signed documentation or nursing notes recorded."],
      ["Diagnostics & follow-up", "Not tracked yet",
        "Diagnostics aren't tracked in VetiFlow yet. Diagnostic tasks and blockers are in Tasks and due items."],
      ["Handoff & escalation", "Not tracked yet", "Handoffs aren't recorded in VetiFlow yet. Urgent concerns require direct communication."],
      ["Discharge", "Not recorded", "Medical authorization is separate from preparation, checkout and physical departure."]
    ];
    for (const [title, value, content] of expected) {
      const details = disclosure(title);
      expect(details).not.toHaveAttribute("open");
      expect(within(details).getByText(value, { selector: "summary span" })).toBeInTheDocument();
      expect(within(details).getByText(content)).toBeInTheDocument();
    }
    expect(screen.getByText("No review requests recorded.")).toBeInTheDocument();
  });

  it("shows the discharge time on a discharged case", () => {
    renderTab(buildCaseDetail({ dischargedAt: at(11, 5) }));

    expect(within(disclosure("Discharge")).getByText("Discharged 11:05 AM", { selector: "summary span" })).toBeInTheDocument();
  });

  it("keeps the recorded vitals, previous-set comparison and mentation in a closed disclosure", () => {
    renderTab(buildCaseDetail({
      vitals: [
        buildVitalsRecord({ id: "v2", heartRate: 148, mentation: "Quiet, alert", occurredAt: at(10, 48), recordedAt: at(10, 50),
          recordedBy: { id: "s1", name: "Jordan Lee" } }),
        buildVitalsRecord({ id: "v1", heartRate: 160, recordedAt: at(10, 40) })
      ]
    }));

    const details = disclosure("Recorded vitals & assessment");
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("10:48 AM", { selector: "summary span" })).toBeInTheDocument();
    const record = within(details);
    expect(record.getByText("148 bpm")).toBeInTheDocument();
    expect(record.getByText("Entered by Jordan Lee")).toBeInTheDocument();
    expect(record.getByText("Since the previous saved set")).toBeInTheDocument();
    expect(within(record.getByRole("region", { name: "Clinical assessment" })).getByText("Mentation")).toBeInTheDocument();
    expect(record.getAllByText("Quiet, alert").length).toBeGreaterThan(0);
  });

  it("says no vitals are recorded in the vitals summary", () => {
    renderTab(buildCaseDetail({ vitals: [] }));

    expect(within(disclosure("Recorded vitals & assessment")).getByText("None recorded", { selector: "summary span" })).toBeInTheDocument();
  });

  it("keeps the allergy source and verification in a closed disclosure", () => {
    const base = buildCaseDetail();
    renderTab({
      ...base,
      patient: { ...base.patient, allergies: "Penicillin", allergyStatus: "documentedAllergies", allergySource: "clinicRecord",
        allergiesVerifiedAt: at(9, 0), allergiesVerifiedBy: { id: "s1", name: "Jordan Reed" } }
    });

    const details = disclosure("Allergy details");
    expect(details).not.toHaveAttribute("open");
    const record = within(details);
    expect(record.getByText("Penicillin")).toBeInTheDocument();
    expect(record.getByText("Source")).toBeInTheDocument();
    expect(record.getByText(/^Jordan Reed · /)).toBeInTheDocument();
    expect(record.getByText("At this visit's intake")).toBeInTheDocument();
  });

  it("ends with the last-updated line", () => {
    renderTab(buildCaseDetail({ lastUpdated: at(10, 47) }));

    expect(screen.getAllByText(/\S/).at(-1)).toBe(screen.getByText("Last updated 10:47 AM"));
  });

  it("opens allergy details and focuses its summary when asked", () => {
    const onAllergiesShown = vi.fn();
    render(<ClinicalTab detail={buildCaseDetail()} showAllergies onAllergiesShown={onAllergiesShown} />);

    expect(disclosure("Allergy details")).toHaveAttribute("open");
    expect(summaryOf("Allergy details")).toHaveFocus();
    expect(onAllergiesShown).toHaveBeenCalledOnce();
  });
});
