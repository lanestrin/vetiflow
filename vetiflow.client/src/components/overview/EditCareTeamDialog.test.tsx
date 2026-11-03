import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail } from "../../types/CaseDetail";
import { EditCareTeamDialog } from "./EditCareTeamDialog";

// jsdom has no modal dialogs; these behave like the browser's for the test.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const team = [
  { id: "vet-chen", displayName: "Dr. Avery Chen", initials: "AC", role: "veterinarian", status: "busy", activeCaseCount: 1, activeCases: [] },
  { id: "vet-lee", displayName: "Dr. Jordan Lee", initials: "JL", role: "veterinarian", status: "available", activeCaseCount: 0, activeCases: [] },
  { id: "tech-ortiz", displayName: "Sam Ortiz", initials: "SO", role: "technician", status: "available", activeCaseCount: 0, activeCases: [] }
];

function buildToby(overrides: Partial<CaseDetail> = {}): CaseDetail {
  const base = buildCaseDetail({ id: "case-toby", caseNumber: "ER-2489", ...overrides });
  return { ...base, patient: { ...base.patient, name: "Toby" } };
}

function renderDialog(detail = buildToby({ assignedDoctor: { id: "vet-chen", name: "Avery Chen" } }), canChangeVeterinarian = true) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onPartlySaved = vi.fn();
  render(
    <MemoryRouter initialEntries={["/er"]}>
      <Routes>
        <Route path="/er" element={<EditCareTeamDialog detail={detail} onClose={onClose} onSaved={onSaved} onPartlySaved={onPartlySaved} canChangeVeterinarian={canChangeVeterinarian} />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>
  );
  return { onClose, onSaved, onPartlySaved };
}

function serveTeam() {
  server.use(http.get(apiUrl("/api/staff/team"), () => HttpResponse.json(team)));
}

// Records each request in order as "<field>:<id>".
function serveAssignments(statuses: Partial<Record<"veterinarian" | "technician", number>> = {}) {
  const sent: string[] = [];
  for (const field of ["veterinarian", "technician"] as const) {
    server.use(
      http.put(apiUrl(`/api/cases/case-toby/${field}`), async ({ request }) => {
        const body = await request.json() as { id: string | null };
        sent.push(`${field}:${body.id}`);
        return new HttpResponse(null, { status: statuses[field] ?? 204 });
      })
    );
  }
  return sent;
}

async function waitForTeam() {
  await screen.findByRole("option", { name: "Sam Ortiz" });
}

describe("EditCareTeamDialog", () => {
  it("lists veterinarians and technicians in their own lists with the current people chosen", async () => {
    serveTeam();
    renderDialog();
    await waitForTeam();

    expect(screen.getByRole("dialog", { name: "Edit care team" })).toBeInTheDocument();
    const vet = screen.getByLabelText("Attending veterinarian");
    const tech = screen.getByLabelText("Primary technician");
    expect(vet).toHaveValue("vet-chen");
    expect(tech).toHaveValue("");
    expect(vet).toHaveTextContent("Dr. Jordan Lee");
    expect(vet).not.toHaveTextContent("Sam Ortiz");
    expect(tech).not.toHaveTextContent("Dr. Jordan Lee");
  });

  it("sends only the veterinarian when only they changed", async () => {
    serveTeam();
    const sent = serveAssignments();
    const { onSaved } = renderDialog();
    await waitForTeam();

    fireEvent.change(screen.getByLabelText("Attending veterinarian"), { target: { value: "vet-lee" } });
    fireEvent.click(screen.getByRole("button", { name: "Save care team" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Care team updated"));
    expect(sent).toEqual(["veterinarian:vet-lee"]);
  });

  it("sends only the technician when only they changed", async () => {
    serveTeam();
    const sent = serveAssignments();
    const { onSaved } = renderDialog();
    await waitForTeam();

    fireEvent.change(screen.getByLabelText("Primary technician"), { target: { value: "tech-ortiz" } });
    fireEvent.click(screen.getByRole("button", { name: "Save care team" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent).toEqual(["technician:tech-ortiz"]);
  });

  it("sends both, the veterinarian first, and Not assigned as null", async () => {
    serveTeam();
    const sent = serveAssignments();
    const { onSaved } = renderDialog();
    await waitForTeam();

    fireEvent.change(screen.getByLabelText("Attending veterinarian"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Primary technician"), { target: { value: "tech-ortiz" } });
    fireEvent.click(screen.getByRole("button", { name: "Save care team" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent).toEqual(["veterinarian:null", "technician:tech-ortiz"]);
  });

  it("closes without a request when nothing changed", async () => {
    serveTeam();
    const sent = serveAssignments();
    const { onClose, onSaved } = renderDialog();
    await waitForTeam();

    fireEvent.click(screen.getByRole("button", { name: "Save care team" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("says which part did not save and asks the panel to reload", async () => {
    serveTeam();
    const sent = serveAssignments({ technician: 500 });
    const { onSaved, onPartlySaved } = renderDialog();
    await waitForTeam();

    fireEvent.change(screen.getByLabelText("Attending veterinarian"), { target: { value: "vet-lee" } });
    fireEvent.change(screen.getByLabelText("Primary technician"), { target: { value: "tech-ortiz" } });
    fireEvent.click(screen.getByRole("button", { name: "Save care team" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The attending veterinarian was saved, but the primary technician was not. Try again.");
    expect(sent).toEqual(["veterinarian:vet-lee", "technician:tech-ortiz"]);
    expect(onPartlySaved).toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("offers to try again when the team does not load", async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl("/api/staff/team"), () => (calls++ === 0 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(team)))
    );
    renderDialog();

    expect(await screen.findByText(/Unable to load the team\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save care team" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitForTeam();
  });

  // The Technician demo view (2.28): screen only, the server is unchanged.
  it("keeps the attending veterinarian view-only in the Technician view", async () => {
    serveTeam();
    const sent = serveAssignments();
    const { onSaved } = renderDialog(undefined, false);
    await waitForTeam();

    const vet = screen.getByLabelText("Attending veterinarian");
    expect(vet).toBeDisabled();
    expect(vet).toHaveValue("vet-chen");
    expect(vet).toHaveAccessibleDescription("Attending veterinarian is managed in the Veterinarian view.");
    const tech = screen.getByLabelText("Primary technician");
    expect(tech).toBeEnabled();

    fireEvent.change(tech, { target: { value: "tech-ortiz" } });
    fireEvent.click(screen.getByRole("button", { name: "Save care team" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Care team updated"));
    expect(sent).toEqual(["technician:tech-ortiz"]);
  });
});
