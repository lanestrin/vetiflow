import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { readAccessToken, saveAccessToken } from "../services/session";
import { buildPatientListItem } from "../test/builders";
import { apiUrl, server } from "../test/server";
import type { PatientListItem } from "../types/PatientListItem";
import { RecordsPage } from "./RecordsPage";

afterEach(() => {
  sessionStorage.clear();
  server.events.removeAllListeners();
});

function SignInStub() {
  const state = useLocation().state as SignInRouteState | null;
  return <p>Sign-in page{state?.sessionEnded ? " (session ended)" : ""}</p>;
}

// Shows the current URL's search, so tests can see what the page put there.
function RecordsWithLocation() {
  const location = useLocation();
  return (
    <>
      <RecordsPage />
      <p data-testid="location">{location.search}</p>
    </>
  );
}

function renderPage(path = "/records") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/records" element={<RecordsWithLocation />} />
        <Route path="/sign-in" element={<SignInStub />} />
        <Route path="/pet-parent" element={<p>Pet parent home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function servePatients(patients: PatientListItem[]) {
  server.use(http.get(apiUrl("/api/patients"), () => HttpResponse.json(patients)));
}

// The search text of every request the page makes from here on.
function recordSearches() {
  const searches: (string | null)[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/api/patients")) {
      searches.push(url.searchParams.get("search"));
    }
  });
  return searches;
}

function search(text: string) {
  fireEvent.change(screen.getByLabelText("Pet or owner name"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
}

describe("RecordsPage", () => {
  it("names the page and asks for a pet or owner name before any search", () => {
    const searches = recordSearches();

    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Patient records" })).toBeInTheDocument();
    expect(document.title).toBe("Patient records · VetiFlow");
    expect(screen.getByText("Search by the pet's name or the owner's name.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(searches).toEqual([]);
  });

  it("asks for at least 2 characters without searching", async () => {
    const searches = recordSearches();
    renderPage();

    search(" a ");

    const input = screen.getByLabelText("Pet or owner name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter 2 to 100 characters to search.");
    expect(input).toHaveFocus();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(searches).toEqual([]);
  });

  it("lists each patient with species, owner and whether it is in care", async () => {
    servePatients([
      buildPatientListItem({ name: "Buddy", species: "Dog", breed: "Labrador", ownerName: "Morgan Hale", inCare: true }),
      buildPatientListItem({ name: "Stray cat", species: "Cat", breed: null, ownerId: null, ownerName: null })
    ]);
    renderPage();

    search("bu");

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("heading", { level: 2, name: "Buddy" })).toBeInTheDocument();
    expect(items[0]).toHaveTextContent("Dog · Labrador");
    expect(items[0]).toHaveTextContent("Owner: Morgan Hale");
    expect(items[0]).toHaveTextContent("In care");
    expect(within(items[1]).getByRole("heading", { level: 2, name: "Stray cat" })).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("Cat");
    expect(items[1]).toHaveTextContent("No owner recorded");
    expect(items[1]).toHaveTextContent("Not in care");
  });

  it("says it is searching, then announces how many were found", async () => {
    servePatients([buildPatientListItem(), buildPatientListItem(), buildPatientListItem()]);
    renderPage();

    search("Patient");

    expect(screen.getByRole("status")).toHaveTextContent("Searching…");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("3 patients found"));
    expect(screen.queryByText("Search by the pet's name or the owner's name.")).not.toBeInTheDocument();
  });

  it("says when only the first 25 matches are shown", async () => {
    servePatients(Array.from({ length: 25 }, () => buildPatientListItem()));
    renderPage();

    search("Patient");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Showing the first 25 matches. Add more of the name to narrow the search."
      )
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(25);
  });

  it("says when nothing matches", async () => {
    servePatients([]);
    renderPage();

    search("  rex ");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No patients match “rex”."));
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("says search is unavailable on a server error and lets the person try again", async () => {
    server.use(http.get(apiUrl("/api/patients"), () => new HttpResponse(null, { status: 500 })));
    renderPage();

    search("Buddy");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Patient search isn't available right now. Try again in a moment."
      )
    );
    servePatients([buildPatientListItem({ name: "Buddy" })]);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Buddy" })).toBeInTheDocument();
  });

  it("runs the search in the URL when the page opens, and puts a new search in the URL", async () => {
    const searches = recordSearches();
    servePatients([buildPatientListItem({ name: "Buddy" })]);
    renderPage("/records?search=Buddy");

    expect(screen.getByLabelText("Pet or owner name")).toHaveValue("Buddy");
    expect(await screen.findByRole("heading", { level: 2, name: "Buddy" })).toBeInTheDocument();

    search("Morgan Hale");

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("?search=Morgan+Hale"));
    await waitFor(() => expect(searches).toEqual(["Buddy", "Morgan Hale"]));
  });

  it("shows the field error for a search in the URL that is too short", () => {
    const searches = recordSearches();

    renderPage("/records?search=a");

    expect(screen.getByLabelText("Pet or owner name")).toHaveAttribute("aria-invalid", "true");
    expect(searches).toEqual([]);
  });

  it("drops an older search that answers after a newer one", async () => {
    let releaseSlow: () => void = () => {};
    const slowAnswered = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    server.use(
      http.get(apiUrl("/api/patients"), async ({ request }) => {
        const text = new URL(request.url).searchParams.get("search");
        if (text === "slow") {
          await slowAnswered;
          return HttpResponse.json([buildPatientListItem({ name: "Old result" })]);
        }
        return HttpResponse.json([buildPatientListItem({ name: "New result" })]);
      })
    );
    renderPage();

    search("slow");
    search("fast");
    expect(await screen.findByRole("heading", { level: 2, name: "New result" })).toBeInTheDocument();
    releaseSlow();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("heading", { level: 2, name: "Old result" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "New result" })).toBeInTheDocument();
  });

  it("returns to sign-in with the session-ended message on 401", async () => {
    saveAccessToken("expired-token");
    server.use(http.get(apiUrl("/api/patients"), () => new HttpResponse(null, { status: 401 })));
    renderPage();

    search("Buddy");

    expect(await screen.findByText("Sign-in page (session ended)")).toBeInTheDocument();
    expect(readAccessToken()).toBeNull();
  });

  it("sends a pet parent home on 403", async () => {
    server.use(http.get(apiUrl("/api/patients"), () => new HttpResponse(null, { status: 403 })));
    renderPage();

    search("Buddy");

    expect(await screen.findByText("Pet parent home")).toBeInTheDocument();
  });
});
