import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router-dom";
import { useState } from "react";
import { beforeAll, afterEach, expect, it, vi } from "vitest";
import { buildCaseDetail, buildTeamMember } from "../../test/builders";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { SessionEndedError, AccessDeniedError } from "../../services/apiErrors";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { TriageDialog } from "../triage/TriageDialog";
import { ProfileMenu } from "../shell/ProfileMenu";
import { ClinicalDraftProvider, ClinicalDraftRouteBlocker } from "./ClinicalDraftProvider";
import { useClinicalDraftNavigation } from "./clinicalDraftContext";
import * as casesApi from "../../services/casesApi";
import { ToastProvider } from "../shell/Toast";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function () {
    this.removeAttribute("open"); this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => sessionStorage.clear());

function Encounter() {
  const [selected, setSelected] = useState("original-case");
  const drafts = useClinicalDraftNavigation();
  const leaveWhenRefused = useLeaveWhenRefused();
  return <>
    <p>Selected: {selected}</p>
    <Link to="/records">Records</Link>
    <button onClick={() => void drafts.requestLeave(() => setSelected("other-case"))}>Other patient</button>
    <button onClick={() => leaveWhenRefused(new SessionEndedError())}>Expire session</button>
    <button onClick={() => leaveWhenRefused(new AccessDeniedError())}>Refuse access</button>
    <ProfileMenu user={buildTeamMember({ displayName: "Fixture Clinician" })} />
    <TriageDialog key={selected} detail={buildCaseDetail({ id: selected, acuity: "urgent" })} onClose={() => {}} onSaved={() => {}} />
  </>;
}

function start() {
  const router = createMemoryRouter([{
    element: <ClinicalDraftProvider><ToastProvider><ClinicalDraftRouteBlocker /><Outlet /></ToastProvider></ClinicalDraftProvider>,
    children: [
      { path: "/er", element: <Encounter /> },
      { path: "/records", element: <p>Records destination</p> },
      { path: "/team", element: <p>Team destination</p> },
      { path: "/sign-in", element: <p>Sign-in destination</p> },
      { path: "/pet-parent", element: <p>Owner destination</p> }
    ]
  }], { initialEntries: ["/records", "/er", "/team"], initialIndex: 1 });
  const view = render(<RouterProvider router={router} />);
  fireEvent.change(screen.getByLabelText("Triage notes"), { target: { value: "Private fixture notes" } });
  return { router, ...view };
}

it("preserves selection on Keep editing and switches once on discard", async () => {
  start();
  fireEvent.click(screen.getByRole("button", { name: "Other patient" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByText("Selected: original-case")).toBeInTheDocument();
  expect(screen.getByLabelText("Triage notes")).toHaveValue("Private fixture notes");
  await waitFor(() => expect(screen.getByLabelText("Triage notes")).toHaveValue("Private fixture notes"));
  fireEvent.click(screen.getByRole("button", { name: "Other patient" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(await screen.findByText("Selected: other-case")).toBeInTheDocument();
  expect(screen.getByLabelText("Triage notes")).toHaveValue("");
});

it("guards links, back and forward using the router without duplicate prompts", async () => {
  const { router } = start();
  fireEvent.click(screen.getByRole("link", { name: "Records" }));
  fireEvent.click(await screen.findByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(router.state.blockers.size === 0 || [...router.state.blockers.values()][0].state === "unblocked").toBe(true));
  expect(router.state.location.pathname).toBe("/er");
  await act(async () => { await router.navigate(-1); });
  fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
  expect(await screen.findByText("Records destination")).toBeInTheDocument();
  await act(async () => { await router.navigate(1); });
  fireEvent.change(screen.getByLabelText("Triage notes"), { target: { value: "New notes" } });
  await act(async () => { await router.navigate(1); });
  fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
  expect(await screen.findByText("Team destination")).toBeInTheDocument();
});

it("clears the token only after explicit sign-out is confirmed", async () => {
  saveAccessToken("fictional-token");
  start();
  fireEvent.click(screen.getByRole("button", { name: "Fixture Clinician, account" }));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(readAccessToken()).toBe("fictional-token");
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(readAccessToken()).toBe("fictional-token");
  await waitFor(() => expect(screen.getByLabelText("Triage notes")).toHaveValue("Private fixture notes"));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(await screen.findByText("Sign-in destination")).toBeInTheDocument();
  expect(readAccessToken()).toBeNull();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it.each([
  ["Expire session", "Sign-in destination", null],
  ["Refuse access", "Owner destination", "fictional-token"]
])("bypasses a pending confirmation for %s and clears private forms", async (action, destination, token) => {
  saveAccessToken("fictional-token");
  start();
  fireEvent.click(screen.getByRole("link", { name: "Records" }));
  expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: action! }));
  expect(await screen.findByText(destination!)).toBeInTheDocument();
  expect(readAccessToken()).toBe(token);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue("Private fixture notes")).not.toBeInTheDocument();
});

it("blocks navigation while saving but permits a forced expiry and ignores the late success", async () => {
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  vi.spyOn(casesApi, "triageCase").mockImplementation(() => pending);
  const { router } = start();
  fireEvent.click(screen.getByRole("button", { name: "Save priority" }));
  fireEvent.click(screen.getByRole("link", { name: "Records" }));
  await waitFor(() => expect(screen.getByLabelText("Triage notes")).toHaveValue("Private fixture notes"));
  expect(router.state.location.pathname).toBe("/er");
  expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Expire session" }));
  expect(await screen.findByText("Sign-in destination")).toBeInTheDocument();
  await act(async () => { resolve(); await pending; });
  expect(router.state.location.pathname).toBe("/sign-in");
});
