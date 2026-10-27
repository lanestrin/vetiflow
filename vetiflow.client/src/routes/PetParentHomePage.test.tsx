import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { saveAccessToken } from "../services/session";
import { apiUrl, server } from "../test/server";
import type { SignedInUser } from "../types/Auth";
import { PetParentHomePage } from "./PetParentHomePage";

afterEach(() => {
  sessionStorage.clear();
});

function renderPage() {
  render(
    <MemoryRouter>
      <PetParentHomePage />
    </MemoryRouter>
  );
}

function serveMe(user: SignedInUser) {
  server.use(http.get(apiUrl("/api/auth/me"), () => HttpResponse.json(user)));
}

describe("PetParentHomePage", () => {
  it("welcomes the signed-in pet parent by name", async () => {
    saveAccessToken("token-1");
    serveMe({ name: "Morgan Hale", experience: "petParent" });

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Welcome back, Morgan Hale" })
    ).toBeInTheDocument();
    expect(screen.getByText("Your pet's care updates will appear here.")).toBeInTheDocument();
    expect(document.title).toBe("Welcome · VetiFlow");
  });

  it("asks a visitor without a session to sign in", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in to see your pet's updates" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("asks to sign in again when the session is no longer accepted", async () => {
    saveAccessToken("expired");
    server.use(http.get(apiUrl("/api/auth/me"), () => new HttpResponse(null, { status: 401 })));

    renderPage();

    expect(await screen.findByRole("link", { name: "Go to sign in" })).toBeInTheDocument();
  });

  it("points a hospital team member to the board", async () => {
    saveAccessToken("token-1");
    serveMe({ name: "Jordan Lee", experience: "teamMember" });

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "This page is for pet parents" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the ER board" })).toHaveAttribute("href", "/er");
  });
});
