import { fireEvent, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { createCaseHubConnection } from "../services/caseHub";
import { readAccessToken, saveAccessToken } from "../services/session";
import { buildCase, buildCaseDetail } from "../test/builders";
import { createFakeCaseHub } from "../test/fakeCaseHub";
import { apiUrl, server } from "../test/server";
import type { EmergencyCaseListItem } from "../types/EmergencyCaseListItem";
import { ToastProvider } from "../components/shell/Toast";
import { ErBoardPage } from "./ErBoardPage";

vi.mock("../services/caseHub", () => ({
  createCaseHubConnection: vi.fn()
}));

let hub: ReturnType<typeof createFakeCaseHub>;

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

beforeEach(() => {
  hub = createFakeCaseHub();
  vi.mocked(createCaseHubConnection).mockReturnValue(hub.asHubConnection());
});

afterEach(() => {
  sessionStorage.clear();
});

function serveCases(cases: EmergencyCaseListItem[]) {
  server.use(http.get(apiUrl("/api/cases"), () => HttpResponse.json(cases)));
}

async function findLane(name: string) {
  return screen.findByRole("region", { name });
}

// Shows the router state the board leaves on /sign-in, so tests can read it.
function SignInStub() {
  const state = useLocation().state as SignInRouteState | null;
  return <p>Sign-in page{state?.sessionEnded ? " (session ended)" : ""}</p>;
}

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={["/er"]}>
      <Routes>
        <Route path="/er" element={<ToastProvider><ErBoardPage /></ToastProvider>} />
        <Route path="/sign-in" element={<SignInStub />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ErBoardPage", () => {
  it("sends the person to sign in when the session has ended", async () => {
    saveAccessToken("expired");
    server.use(http.get(apiUrl("/api/cases"), () => new HttpResponse(null, { status: 401 })));

    renderBoard();

    expect(await screen.findByText("Sign-in page (session ended)")).toBeInTheDocument();
    expect(readAccessToken()).toBeNull();
  });

  it("shows a loading message until the cases arrive", async () => {
    renderBoard();

    expect(screen.getByText("Loading emergency cases...")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "VetiFlow ER Board" })
    ).toBeInTheDocument();
  });

  it("names the browser tab while loading and once loaded", async () => {
    serveCases([buildCase()]);
    renderBoard();

    expect(document.title).toBe("ER Board · VetiFlow");
    await screen.findByRole("heading", { level: 1, name: "VetiFlow ER Board" });
    expect(document.title).toBe("ER Board · VetiFlow");
  });

  it("places each case in the lane for its acuity", async () => {
    serveCases([
      buildCase({ patientName: "Buddy", acuity: "critical" }),
      buildCase({ patientName: "Mittens", acuity: "stable" })
    ]);

    renderBoard();

    expect(
      within(await findLane("Critical")).getByRole("heading", { name: "Buddy" })
    ).toBeInTheDocument();
    expect(
      within(await findLane("Stable")).getByRole("heading", { name: "Mittens" })
    ).toBeInTheDocument();
    expect(within(await findLane("Urgent")).getByText("No patients")).toBeInTheDocument();
  });

  // The API sorts by acuity and wait; the board must not reorder within a lane.
  it("lists a lane's cards in the order the API sent them", async () => {
    serveCases([
      buildCase({ patientName: "Rex", acuity: "urgent" }),
      buildCase({ patientName: "Bella", acuity: "urgent" }),
      buildCase({ patientName: "Coco", acuity: "urgent" })
    ]);

    renderBoard();

    const names = within(await findLane("Urgent"))
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(["Rex", "Bella", "Coco"]);
  });

  it("shows the three acuity lanes in order", async () => {
    renderBoard();

    await findLane("Critical");
    const lanes = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent?.replace("● ", ""));

    expect(lanes).toEqual(["Critical", "Urgent", "Stable"]);
  });

  it("selects a card when it is pressed", async () => {
    serveCases([buildCase({ patientName: "Buddy" }), buildCase({ patientName: "Max" })]);
    renderBoard();

    const buddy = await screen.findByRole("button", { name: "Buddy" });
    fireEvent.click(buddy);

    expect(buddy).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Max" })).toHaveAttribute("aria-pressed", "false");
  });

  // Patient overview panel (build plan 3.2b).
  it("shows the selected card's case in the patient overview", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    server.use(http.get(apiUrl("/api/cases/case-buddy"), () =>
      HttpResponse.json(buildCaseDetail({ id: "case-buddy", caseNumber: "ER-2481" }))));
    renderBoard();
    const overview = await screen.findByRole("complementary", { name: "Patient overview" });
    expect(within(overview).getByText("Select a patient on the board to see their overview.")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));

    expect(await within(overview).findByText(/Case ER-2481/)).toBeInTheDocument();
  });

  it("loads the shown case again when the server reports a case update", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    let detailRequests = 0;
    server.use(http.get(apiUrl("/api/cases/case-buddy"), () => {
      detailRequests += 1;
      return HttpResponse.json(buildCaseDetail({ id: "case-buddy", weightKg: detailRequests === 1 ? 12 : 13 }));
    }));
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    const overview = screen.getByRole("complementary", { name: "Patient overview" });
    await within(overview).findByText(/12 kg/);

    hub.emit("caseUpdated", buddy.id);

    expect(await within(overview).findByText(/13 kg/)).toBeInTheDocument();
  });

  it("empties the patient overview when the selected case leaves the board", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    const overview = screen.getByRole("complementary", { name: "Patient overview" });
    await within(overview).findByText(/Case ER-/);

    serveCases([]);
    hub.emit("caseUpdated", buddy.id);

    expect(await within(overview).findByText("Select a patient on the board to see their overview.")).toBeInTheDocument();
  });

  it("shows an error when the cases cannot be loaded", async () => {
    server.use(
      http.get(apiUrl("/api/cases"), () => new HttpResponse(null, { status: 500 }))
    );

    renderBoard();

    expect(
      await screen.findByText("Unable to load emergency cases.")
    ).toBeInTheDocument();
  });

  it("reloads the board when the server reports a case update", async () => {
    const buddy = buildCase({ patientName: "Buddy", acuity: "urgent" });
    serveCases([buddy]);
    renderBoard();
    await within(await findLane("Urgent")).findByRole("heading", { name: "Buddy" });

    serveCases([{ ...buddy, acuity: "critical" }]);
    hub.emit("caseUpdated", buddy.id);

    expect(
      await within(await findLane("Critical")).findByRole("heading", { name: "Buddy" })
    ).toBeInTheDocument();
    expect(within(await findLane("Urgent")).getByText("No patients")).toBeInTheDocument();
  });

  it("still shows the board when live updates cannot connect", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    hub.connection.start.mockRejectedValue(new Error("Hub unavailable"));
    serveCases([buildCase({ patientName: "Buddy" })]);

    renderBoard();

    expect(await screen.findByRole("heading", { name: "Buddy" })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to connect to live case updates.",
      expect.any(Error)
    );
  });

  it("disconnects from live updates when the page closes", async () => {
    const { unmount } = renderBoard();
    await findLane("Critical");

    unmount();

    expect(hub.isListening("caseUpdated")).toBe(false);
    expect(hub.connection.stop).toHaveBeenCalled();
  });
  // New patient intake (build plan 4.1b): the new case shows in its lane,
  // selected, with a toast.
  it("adds an intake to the board, selects it and says so", async () => {
    const toby = buildCase({ id: "case-toby", patientName: "Toby", stage: "incoming", acuity: "urgent", waitChip: "new" });
    serveCases([]);
    server.use(http.post(apiUrl("/api/cases/intake"), () =>
      HttpResponse.json({ id: "case-toby", caseNumber: "ER-2489", patientId: "patient-toby" }, { status: 201 })));
    renderBoard();

    fireEvent.click(await screen.findByRole("button", { name: "New intake" }));
    const dialog = screen.getByRole("dialog", { name: "New patient intake" });
    fireEvent.change(within(dialog).getByLabelText("Patient name *"), { target: { value: "Toby" } });
    fireEvent.change(within(dialog).getByLabelText("Species *"), { target: { value: "Dog" } });
    fireEvent.change(within(dialog).getByLabelText("Pet parent / guardian *"), { target: { value: "Jo Mills" } });
    fireEvent.change(within(dialog).getByLabelText("Phone number *"), { target: { value: "312-555-0177" } });
    fireEvent.change(within(dialog).getByLabelText("Chief complaint *"), { target: { value: "Acute vomiting" } });
    fireEvent.click(within(dialog).getByLabelText("Urgent"));
    serveCases([toby]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to triage queue" }));

    const card = await within(await findLane("Urgent")).findByRole("button", { name: "Toby" });
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Toby added to triage queue");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
