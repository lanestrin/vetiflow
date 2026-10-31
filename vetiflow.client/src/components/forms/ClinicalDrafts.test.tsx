import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, expect, it, vi } from "vitest";
import { buildCaseDetail, buildVitalsRecord } from "../../test/builders";
import { TriageDialog } from "../triage/TriageDialog";
import { AddTaskDialog } from "../tasks/AddTaskDialog";
import { DueItemDialog } from "../tasks/DueItemDialog";
import { RecordVitalsDialog } from "../vitals/RecordVitalsDialog";
import * as casesApi from "../../services/casesApi";
import type { CaseDetail } from "../../types/CaseDetail";

const forms = [
  { name: "triage", field: "Triage notes", submit: "Save priority", saved: "triageCase",
    render: (detail: CaseDetail, close: () => void, saved: () => void) => <TriageDialog detail={detail} onClose={close} onSaved={saved} /> },
  { name: "task", field: "Task *", submit: "Add task", saved: "createTask",
    render: (detail: CaseDetail, close: () => void, saved: () => void) => <AddTaskDialog detail={detail} onClose={close} onSaved={saved} /> },
  { name: "due item", field: "Note", submit: "Set reassessment", saved: "createTask",
    render: (detail: CaseDetail, close: () => void, saved: () => void) => <DueItemDialog detail={detail} type="reassessment" onClose={close} onSaved={saved} /> },
  { name: "vitals", field: "Mentation", submit: "Save vitals", saved: "recordVitals",
    render: (detail: CaseDetail, close: () => void, saved: () => void) => <RecordVitalsDialog detail={detail} onClose={close} onSaved={saved} onUnavailable={() => {}} /> }
] as const;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

it.each(forms)("treats opening and reverted $name values as clean, and warns only for edits", ({ field, render: form }) => {
  const close = vi.fn();
  const view = render(<MemoryRouter>{form(buildCaseDetail(), close, vi.fn())}</MemoryRouter>);
  const unload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(unload()).toBe(false);
  const input = screen.getByLabelText(field);
  fireEvent.change(input, { target: { value: "Recheck" } });
  expect(unload()).toBe(true);
  fireEvent.change(input, { target: { value: "" } });
  expect(unload()).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(close).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
  view.unmount();
  expect(unload()).toBe(false);
});

it.each(forms)("keeps $name on Escape from confirmation and restores the edited field", ({ field, render: form }) => {
  const close = vi.fn();
  render(<MemoryRouter>{form(buildCaseDetail(), close, vi.fn())}</MemoryRouter>);
  const input = screen.getByLabelText(field);
  fireEvent.change(input, { target: { value: "Recheck" } });
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  const confirmation = screen.getByRole("dialog", { name: "Discard unsaved changes?" });
  expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
  fireEvent(confirmation, new Event("cancel", { cancelable: true }));
  expect(close).not.toHaveBeenCalled();
  expect(input).toHaveValue("Recheck");
  expect(input).toHaveFocus();
});

it("opens prefilled vitals clean and clears the warning when their original values are restored", () => {
  const close = vi.fn();
  render(<MemoryRouter><RecordVitalsDialog detail={buildCaseDetail({ vitals: [buildVitalsRecord({ heartRate: 120 })] })}
    onClose={close} onSaved={() => {}} onUnavailable={() => {}} /></MemoryRouter>);
  const rate = screen.getByLabelText("Heart rate (bpm)");
  expect(rate).toHaveValue("120");
  fireEvent.change(rate, { target: { value: "130" } });
  fireEvent.change(rate, { target: { value: "120" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(close).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
});

it.each(forms)("retains a failed $name draft and clears protection only after a successful retry", async ({ field, submit, saved: method, render: form }) => {
  vi.spyOn(casesApi, method).mockRejectedValueOnce(new Error("Fixture failure")).mockResolvedValueOnce(undefined);
  const saved = vi.fn();
  render(<MemoryRouter>{form(buildCaseDetail({ acuity: "urgent" }), vi.fn(), saved)}</MemoryRouter>);
  const input = screen.getByLabelText(field);
  fireEvent.change(input, { target: { value: "Recheck" } });
  fireEvent.click(screen.getByRole("button", { name: submit }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Unable to save/);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(input).toHaveValue("Recheck");
  fireEvent.click(screen.getByRole("button", { name: submit }));
  await vi.waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(false);
});

it.each(forms)("binds $name to its original encounter and ignores a completion after unmount", async ({ field, submit, saved: method, render: form }) => {
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  const api = vi.spyOn(casesApi, method).mockImplementation(() => pending);
  const close = vi.fn();
  const saved = vi.fn();
  const original = buildCaseDetail({ id: "original-case", acuity: "urgent" });
  const view = render(<MemoryRouter>{form(original, close, saved)}</MemoryRouter>);
  fireEvent.change(screen.getByLabelText(field), { target: { value: "Recheck" } });
  view.rerender(<MemoryRouter>{form({ ...original, id: "other-case" }, close, saved)}</MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: submit }));
  fireEvent.submit(screen.getByRole("form"));
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(api).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[0][0]).toBe("original-case");
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
  view.unmount();
  await act(async () => { resolve(); await pending; });
  expect(saved).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it("keeps triage input until the user explicitly discards it", async () => {
  const onClose = vi.fn();
  render(<MemoryRouter><TriageDialog detail={buildCaseDetail()} onClose={onClose} onSaved={vi.fn()} /></MemoryRouter>);
  const notes = screen.getByLabelText("Triage notes");
  fireEvent.change(notes, { target: { value: "Recheck breathing" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(notes).toHaveValue("Recheck breathing");
  expect(notes).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});
