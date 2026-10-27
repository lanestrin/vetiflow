import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { apiUrl, server } from "../../test/server";
import type { Experience, SignedInUser } from "../../types/Auth";
import type { SignInRouteState } from "./experienceHome";
import { RequireExperience } from "./RequireExperience";

afterEach(() => {
  sessionStorage.clear();
});

function SignInStub() {
  const state = useLocation().state as SignInRouteState | null;
  return <p>Sign-in page{state?.sessionEnded ? " (session ended)" : ""}</p>;
}

function renderGuarded(path: string, experience: Experience) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path={path}
          element={
            <RequireExperience experience={experience}>
              {(user) => <p>Allowed: {user.name}</p>}
            </RequireExperience>
          }
        />
        <Route path="/sign-in" element={<SignInStub />} />
        <Route path="/er" element={<p>Board home</p>} />
        <Route path="/pet-parent" element={<p>Pet parent home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function serveMe(user: SignedInUser) {
  saveAccessToken("token-1");
  server.use(http.get(apiUrl("/api/auth/me"), () => HttpResponse.json(user)));
}

describe("RequireExperience", () => {
  it("sends a visitor without a session to sign in", () => {
    renderGuarded("/guarded", "teamMember");

    expect(screen.getByText("Sign-in page")).toBeInTheDocument();
  });

  it("clears a refused token and says the session ended", async () => {
    saveAccessToken("expired");
    server.use(http.get(apiUrl("/api/auth/me"), () => new HttpResponse(null, { status: 401 })));

    renderGuarded("/guarded", "teamMember");

    expect(screen.getByRole("status")).toHaveTextContent("Checking your session…");
    expect(await screen.findByText("Sign-in page (session ended)")).toBeInTheDocument();
    expect(readAccessToken()).toBeNull();
  });

  it("says when the session can't be checked, and keeps the token", async () => {
    saveAccessToken("token-1");
    server.use(http.get(apiUrl("/api/auth/me"), () => new HttpResponse(null, { status: 500 })));

    renderGuarded("/guarded", "teamMember");

    expect(await screen.findByText(/can't check your sign-in right now/)).toBeInTheDocument();
    expect(readAccessToken()).toBe("token-1");
  });

  it("shows the page to the matching experience", async () => {
    serveMe({ name: "Jordan Lee", experience: "teamMember" });

    renderGuarded("/guarded", "teamMember");

    expect(await screen.findByText("Allowed: Jordan Lee")).toBeInTheDocument();
  });

  it.each([
    [{ name: "Morgan Hale", experience: "petParent" }, "teamMember", "Pet parent home"],
    [{ name: "Jordan Lee", experience: "teamMember" }, "petParent", "Board home"]
  ] as const)("sends %o to their own home", async (user, required, home) => {
    serveMe(user);

    renderGuarded("/guarded", required);

    expect(await screen.findByText(home)).toBeInTheDocument();
    expect(screen.queryByText(/Allowed/)).not.toBeInTheDocument();
  });
});
