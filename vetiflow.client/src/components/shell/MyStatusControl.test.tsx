import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { apiUrl, server } from "../../test/server";
import type { SignInRouteState } from "../auth/experienceHome";
import { MyStatusControl } from "./MyStatusControl";
import { ToastProvider } from "./Toast";

const route = apiUrl("/api/staff/me/status");

afterEach(() => {
  sessionStorage.clear();
});

function SignInStub() {
  const state = useLocation().state as SignInRouteState | null;
  return <p>Sign-in page{state?.sessionEnded ? " (session ended)" : ""}</p>;
}

function renderControl() {
  render(
    <MemoryRouter initialEntries={["/er"]}>
      <ToastProvider>
        <Routes>
          <Route path="/er" element={<MyStatusControl />} />
          <Route path="/sign-in" element={<SignInStub />} />
          <Route path="/pet-parent" element={<p>Pet parent home</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

function serveStatus(status: string) {
  server.use(http.get(route, () => HttpResponse.json({ status })));
}

describe("MyStatusControl", () => {
  it("selects the loaded status, with the prototype's options in order", async () => {
    serveStatus("atLimit");

    renderControl();

    const select = await screen.findByRole("combobox", { name: "My status" });
    expect(select).toHaveValue("atLimit");
    expect(screen.getAllByRole("option").map((option) => option.textContent))
      .toEqual(["Busy", "Available", "At limit", "Unavailable"]);
  });

  it("saves a change and confirms it with a toast", async () => {
    serveStatus("unavailable");
    let saved: unknown = null;
    server.use(http.put(route, async ({ request }) => {
      saved = await request.json();
      return new HttpResponse(null, { status: 204 });
    }));
    renderControl();
    const select = await screen.findByRole("combobox", { name: "My status" });

    fireEvent.change(select, { target: { value: "busy" } });

    expect(await screen.findByText("Availability set to Busy")).toBeInTheDocument();
    expect(saved).toEqual({ status: "busy" });
    expect(select).toHaveValue("busy");
    expect(select).toBeEnabled();
  });

  it("goes back to the saved status when the save fails", async () => {
    serveStatus("available");
    server.use(http.put(route, () => new HttpResponse(null, { status: 500 })));
    renderControl();
    const select = await screen.findByRole("combobox", { name: "My status" });

    fireEvent.change(select, { target: { value: "atLimit" } });

    expect(await screen.findByText("Couldn't save your status. Try again.")).toBeInTheDocument();
    await waitFor(() => expect(select).toHaveValue("available"));
  });

  it("shows nothing for a staff member with no status", async () => {
    let requested = false;
    server.use(http.get(route, () => {
      requested = true;
      return new HttpResponse(null, { status: 403 });
    }));

    renderControl();

    await waitFor(() => expect(requested).toBe(true));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("Status unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText("Pet parent home")).not.toBeInTheDocument();
  });

  it("says the status is unavailable when it can't load", async () => {
    server.use(http.get(route, () => new HttpResponse(null, { status: 500 })));

    renderControl();

    expect(await screen.findByText("Status unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("sends the person to sign in when the session has ended", async () => {
    saveAccessToken("expired");
    server.use(http.get(route, () => new HttpResponse(null, { status: 401 })));

    renderControl();

    expect(await screen.findByText("Sign-in page (session ended)")).toBeInTheDocument();
    expect(readAccessToken()).toBeNull();
  });
});
