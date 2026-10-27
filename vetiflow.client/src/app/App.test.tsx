import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCaseHubConnection } from "../services/caseHub";
import { createFakeCaseHub } from "../test/fakeCaseHub";
import App from "./App";

vi.mock("../services/caseHub", () => ({
  createCaseHubConnection: vi.fn()
}));

beforeEach(() => {
  vi.mocked(createCaseHubConnection).mockReturnValue(
    createFakeCaseHub().asHubConnection()
  );
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("App", () => {
  it.each(["/", "/er"])("shows the ER board at %s", async (path) => {
    renderAt(path);

    expect(
      await screen.findByRole("heading", { name: "VetiFlow ER Board" })
    ).toBeInTheDocument();
  });

  it("shows the sign-in page at /sign-in", () => {
    renderAt("/sign-in");

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
  });

  it("shows the pet parent home at /pet-parent", () => {
    renderAt("/pet-parent");

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in to see your pet's updates" })
    ).toBeInTheDocument();
  });

  it.each(["/er", "/sign-in", "/pet-parent"])("labels %s as a demo", (path) => {
    renderAt(path);

    expect(screen.getByText(/fictional data only/)).toBeInTheDocument();
  });
});
