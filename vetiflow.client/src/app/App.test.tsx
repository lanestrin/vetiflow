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

describe("App", () => {
  it.each(["/", "/er"])("shows the ER board at %s", async (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "VetiFlow ER Board" })
    ).toBeInTheDocument();
  });
});
