import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCaseHubConnection } from "../services/caseHub";
import { saveAccessToken } from "../services/session";
import { createFakeCaseHub } from "../test/fakeCaseHub";
import { apiUrl, server } from "../test/server";
import type { SignedInUser } from "../types/Auth";
import App from "./App";

vi.mock("../services/caseHub", () => ({
  createCaseHubConnection: vi.fn()
}));

const teamMember: SignedInUser = { name: "Jordan Lee", experience: "teamMember" };
const petParent: SignedInUser = { name: "Morgan Hale", experience: "petParent" };

beforeEach(() => {
  vi.mocked(createCaseHubConnection).mockReturnValue(
    createFakeCaseHub().asHubConnection()
  );
});

afterEach(() => {
  sessionStorage.clear();
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

function signInAs(user: SignedInUser) {
  saveAccessToken("token-1");
  server.use(http.get(apiUrl("/api/auth/me"), () => HttpResponse.json(user)));
}

const boardHeading = { level: 1, name: "VetiFlow ER Board" } as const;
const signInHeading = { level: 1, name: "Welcome back" } as const;
const petParentHeading = { level: 1, name: "Welcome back, Morgan Hale" } as const;
const recordsHeading = { level: 1, name: "Patient records" } as const;

describe("App", () => {
  it.each(["/", "/er", "/pet-parent", "/records"])("sends a signed-out visitor at %s to sign in", async (path) => {
    renderAt(path);

    expect(await screen.findByRole("heading", signInHeading)).toBeInTheDocument();
  });

  it("opens the board at / for a hospital team member", async () => {
    signInAs(teamMember);

    renderAt("/");

    expect(await screen.findByRole("heading", boardHeading)).toBeInTheDocument();
  });

  it("opens the pet parent home at / for a pet parent", async () => {
    signInAs(petParent);

    renderAt("/");

    expect(await screen.findByRole("heading", petParentHeading)).toBeInTheDocument();
  });

  it("keeps a pet parent off the board", async () => {
    signInAs(petParent);

    renderAt("/er");

    expect(await screen.findByRole("heading", petParentHeading)).toBeInTheDocument();
    expect(screen.queryByRole("heading", boardHeading)).not.toBeInTheDocument();
  });

  it("opens patient records for a hospital team member", async () => {
    signInAs(teamMember);

    renderAt("/records");

    expect(await screen.findByRole("heading", recordsHeading)).toBeInTheDocument();
  });

  it("keeps a pet parent out of patient records", async () => {
    signInAs(petParent);

    renderAt("/records");

    expect(await screen.findByRole("heading", petParentHeading)).toBeInTheDocument();
    expect(screen.queryByRole("heading", recordsHeading)).not.toBeInTheDocument();
  });

  it("skips the sign-in page for someone already signed in", async () => {
    signInAs(teamMember);

    renderAt("/sign-in");

    expect(await screen.findByRole("heading", boardHeading)).toBeInTheDocument();
  });

  it.each(["/er", "/sign-in", "/pet-parent"])("labels %s as a demo", (path) => {
    renderAt(path);

    expect(screen.getByText(/fictional data only/)).toBeInTheDocument();
  });
});
