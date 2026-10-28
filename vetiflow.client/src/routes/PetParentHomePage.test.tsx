import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { readAccessToken, saveAccessToken } from "../services/session";
import { apiUrl, server } from "../test/server";
import type { PetSummary } from "../types/PetSummary";
import { PetParentHomePage } from "./PetParentHomePage";
import { buildPetParent } from "../test/builders";

afterEach(() => {
  sessionStorage.clear();
});

function SignInStub() {
  const state = useLocation().state as SignInRouteState | null;
  return <p>Sign-in page{state?.sessionEnded ? " (session ended)" : ""}</p>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/pet-parent"]}>
      <Routes>
        <Route
          path="/pet-parent"
          element={<PetParentHomePage user={buildPetParent()} />}
        />
        <Route path="/sign-in" element={<SignInStub />} />
      </Routes>
    </MemoryRouter>
  );
}

function servePets(pets: PetSummary[]) {
  server.use(http.get(apiUrl("/api/pet-parent/pets"), () => HttpResponse.json(pets)));
}

describe("PetParentHomePage", () => {
  it("welcomes the pet parent by name, with the session bar", async () => {
    servePets([]);

    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome back, Morgan Hale" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(document.title).toBe("Welcome · VetiFlow");
    await screen.findByText(/don't have any pets linked/);
  });

  it("says it is loading the pets", async () => {
    servePets([]);

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading your pets…");
    await screen.findByText(/don't have any pets linked/);
  });

  it("lists each pet with calm words for whether it is in care", async () => {
    servePets([
      { name: "Buddy", species: "Dog", inCare: true },
      { name: "Whiskers", species: "Cat", inCare: false }
    ]);

    renderPage();

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Buddy")).toBeInTheDocument();
    expect(items[0]).toHaveTextContent("In our care");
    expect(within(items[1]).getByText("Whiskers")).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("Not with us right now");
  });

  it("says when no pets are linked yet", async () => {
    servePets([]);

    renderPage();

    expect(
      await screen.findByText(
        "We don't have any pets linked to your account yet. Ask the hospital team if this looks wrong."
      )
    ).toBeInTheDocument();
  });

  it("says when the pets can't be shown", async () => {
    server.use(http.get(apiUrl("/api/pet-parent/pets"), () => new HttpResponse(null, { status: 500 })));

    renderPage();

    expect(
      await screen.findByText("We can't show your pets right now. Refresh the page to try again.")
    ).toBeInTheDocument();
  });

  it("sends the person to sign in when the session has ended", async () => {
    saveAccessToken("expired");
    server.use(http.get(apiUrl("/api/pet-parent/pets"), () => new HttpResponse(null, { status: 401 })));

    renderPage();

    expect(await screen.findByText("Sign-in page (session ended)")).toBeInTheDocument();
    expect(readAccessToken()).toBeNull();
  });
});
