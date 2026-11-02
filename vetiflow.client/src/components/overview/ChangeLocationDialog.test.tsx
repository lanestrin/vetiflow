import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail } from "../../types/CaseDetail";
import type { Room } from "../../types/Room";
import { ChangeLocationDialog } from "./ChangeLocationDialog";

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

const exam1: Room = { id: "room-exam", name: "Exam 1", type: "exam", occupiedBy: null };
const oxygen: Room = { id: "room-oxygen", name: "Oxygen Cage", type: "oxygen", occupiedBy: { id: "case-other", caseNumber: "ER-2481" } };
const icu: Room = { id: "room-icu", name: "ICU", type: "icu", occupiedBy: null };

function buildToby(overrides: Partial<CaseDetail> = {}): CaseDetail {
  const base = buildCaseDetail({ id: "case-toby", caseNumber: "ER-2489", ...overrides });
  return { ...base, patient: { ...base.patient, name: "Toby" } };
}

function renderDialog(detail = buildToby({ room: { id: "room-exam", name: "Exam 1", type: "exam" } })) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <MemoryRouter initialEntries={["/er"]}>
      <Routes>
        <Route path="/er" element={<ChangeLocationDialog detail={detail} onClose={onClose} onSaved={onSaved} />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>
  );
  return { onClose, onSaved };
}

function serveRooms(...lists: Room[][]) {
  let calls = 0;
  server.use(
    http.get(apiUrl("/api/rooms"), () => HttpResponse.json(lists[Math.min(calls++, lists.length - 1)]))
  );
  return () => calls;
}

function serveRoomChange(status: number, body?: unknown) {
  const sent: unknown[] = [];
  server.use(
    http.put(apiUrl("/api/cases/case-toby/room"), async ({ request }) => {
      sent.push(await request.json());
      return body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status });
    })
  );
  return sent;
}

describe("ChangeLocationDialog", () => {
  it("lists the rooms with the current one chosen and a room in use shown but not choosable", async () => {
    serveRooms([exam1, icu, oxygen]);
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Change location" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "ICU · ICU" })).toBeEnabled();
    expect(screen.getByRole("option", { name: "Exam · Exam 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("Room")).toHaveValue("room-exam");
    expect(screen.getByRole("option", { name: "Oxygen · Oxygen Cage · In use · ER-2481" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "No room" })).toBeEnabled();
  });

  it("saves the chosen room", async () => {
    serveRooms([exam1, icu, oxygen]);
    const sent = serveRoomChange(204);
    const { onSaved } = renderDialog();

    await screen.findByRole("option", { name: "ICU · ICU" });
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "room-icu" } });
    fireEvent.click(screen.getByRole("button", { name: "Save location" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Location updated"));
    expect(sent).toEqual([{ id: "room-icu" }]);
  });

  it("clears the room with No room", async () => {
    serveRooms([exam1, icu]);
    const sent = serveRoomChange(204);
    const { onSaved } = renderDialog();

    await screen.findByRole("option", { name: "ICU · ICU" });
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save location" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent).toEqual([{ id: null }]);
  });

  it("closes without a request when the room is unchanged", async () => {
    serveRooms([exam1, icu]);
    const sent = serveRoomChange(204);
    const { onClose, onSaved } = renderDialog();

    await screen.findByRole("option", { name: "ICU · ICU" });
    fireEvent.click(screen.getByRole("button", { name: "Save location" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("names the case that took the room first and reloads the rooms", async () => {
    const taken: Room = { ...icu, occupiedBy: { id: "case-new", caseNumber: "ER-2490" } };
    const calls = serveRooms([exam1, icu], [exam1, taken]);
    serveRoomChange(409, { title: "This room is in use", occupyingCaseId: "case-new", occupyingCaseNumber: "ER-2490" });
    const { onSaved } = renderDialog();

    await screen.findByRole("option", { name: "ICU · ICU" });
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "room-icu" } });
    fireEvent.click(screen.getByRole("button", { name: "Save location" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ICU is now in use by ER-2490. Choose another room.");
    expect(await screen.findByRole("option", { name: "ICU · ICU · In use · ER-2490" })).toBeDisabled();
    expect(calls()).toBe(2);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("offers to try again when the rooms do not load", async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl("/api/rooms"), () => (calls++ === 0 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json([exam1, icu])))
    );
    renderDialog();

    expect(await screen.findByText(/Unable to load rooms\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save location" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("option", { name: "ICU · ICU" })).toBeInTheDocument();
  });

  it("stops changes once the case has gone from the board", async () => {
    serveRooms([exam1, icu]);
    serveRoomChange(404);
    renderDialog();

    await screen.findByRole("option", { name: "ICU · ICU" });
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "room-icu" } });
    fireEvent.click(screen.getByRole("button", { name: "Save location" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This case is no longer on the board.");
    expect(screen.getByLabelText("Room")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save location" })).toBeDisabled();
  });
});
