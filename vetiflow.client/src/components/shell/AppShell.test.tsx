import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { buildTeamMember } from "../../test/builders";
import { AppShell } from "./AppShell";
import { useShellSearch } from "./shellSearchContext";

afterEach(() => {
  sessionStorage.clear();
});

// Shows the current path and search, so tests can see where the shell went.
function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

// Shows the search the shell shares with the page below it, and a page box
// that changes it, as the board's search box does (2.26b).
function SearchReader() {
  const [search, setSearch] = useShellSearch() ?? ["", () => {}];
  return <>
    <p data-testid="shared-search">{search}</p>
    <input aria-label="Page search" value={search} onChange={(event) => setSearch(event.target.value)} />
  </>;
}

function HistoryControls() {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate(-1)}>Previous route</button>
    <button onClick={() => navigate(1)}>Next route</button>
  </>;
}

function renderShell(path = "/er") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
        <Route
          path="*"
          element={
            <AppShell user={buildTeamMember({ displayName: "Dr. Jordan Reed", initials: "JR" })}>
              <Where />
              <SearchReader />
              <HistoryControls />
            </AppShell>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("AppShell", () => {
  it("links every rail destination in the prototype's order", () => {
    renderShell();

    const rail = screen.getByRole("navigation", { name: "Main" });
    const links = within(rail).getAllByRole("link").map((link) => [
      link.getAttribute("aria-label"),
      link.getAttribute("href")
    ]);
    expect(links).toEqual([
      ["Overview", "/overview"],
      ["ER board", "/er"],
      ["Patients", "/records"],
      ["Team", "/team"],
      ["Reports", "/reports"],
      ["Settings", "/settings"]
    ]);
  });

  it.each([
    ["/er", "ER board", "ER Command Center"],
    ["/records", "Patients", "Patients"],
    ["/records/patient-1", "Patients", "Patients"],
    ["/records/patient-1/visits/case-1", "Patients", "Patients"],
    ["/settings", "Settings", "Settings"]
  ])("marks %s active and names it in the breadcrumb", (path, railLink, crumb) => {
    renderShell(path);

    expect(screen.getByRole("link", { name: railLink })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
    expect(screen.getByText(crumb, { selector: "b" })).toBeInTheDocument();
  });

  it("opens Patients with the search typed in the top bar", () => {
    renderShell();

    const search = screen.getByRole("searchbox", { name: "Search patients" });
    fireEvent.change(search, { target: { value: " Buddy Hale " } });
    fireEvent.submit(screen.getByRole("search", { name: "Quick search" }));

    expect(screen.getByTestId("where")).toHaveTextContent("/records?search=Buddy%20Hale");
    expect(search).toHaveValue("");
  });

  it("opens Patients without a search when the field is empty", () => {
    renderShell();

    fireEvent.submit(screen.getByRole("search", { name: "Quick search" }));

    expect(screen.getByTestId("where")).toHaveTextContent(/^\/records$/);
  });

  it("says there are no notifications yet", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByRole("status")).toHaveTextContent("No notifications yet");
  });

  it("shows the initials and display name, and opens the profile menu", () => {
    renderShell();

    const profile = screen.getByRole("button", { name: "Dr. Jordan Reed, account" });
    expect(profile).toHaveTextContent("JR");
    expect(profile).toHaveTextContent("Dr. Jordan Reed");
    expect(profile).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();

    fireEvent.click(profile);

    expect(profile).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  // My status (build plan 2.21b), loaded when the menu opens.
  it("shows My status in the opened profile menu", async () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Dr. Jordan Reed, account" }));

    expect(await screen.findByRole("combobox", { name: "My status" })).toHaveValue("busy");
  });

  it("closes the profile menu with Escape and returns focus to the profile", () => {
    renderShell();
    const profile = screen.getByRole("button", { name: "Dr. Jordan Reed, account" });
    fireEvent.click(profile);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(profile).toHaveAttribute("aria-expanded", "false");
    expect(profile).toHaveFocus();
  });

  it("closes the profile menu on a press outside it", () => {
    renderShell();
    const profile = screen.getByRole("button", { name: "Dr. Jordan Reed, account" });
    fireEvent.click(profile);

    fireEvent.pointerDown(screen.getByTestId("where"));

    expect(profile).toHaveAttribute("aria-expanded", "false");
  });

  it("signs out: forgets the token and goes to sign-in", () => {
    saveAccessToken("token-1");
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Dr. Jordan Reed, account" }));

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(readAccessToken()).toBeNull();
    expect(screen.getByText("Sign-in page")).toBeInTheDocument();
  });

  it("shares the typed search with the page below it", () => {
    renderShell();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search patients" }), { target: { value: "Buddy" } });

    expect(screen.getByTestId("shared-search")).toHaveTextContent("Buddy");
  });

  it("keeps the top bar and board search in step", () => {
    renderShell();
    const topBar = screen.getByRole("searchbox", { name: "Search patients" });
    const page = screen.getByRole("textbox", { name: "Page search" });

    fireEvent.change(page, { target: { value: "Pip" } });
    expect(topBar).toHaveValue("Pip");

    fireEvent.change(topBar, { target: { value: "Buddy" } });
    expect(page).toHaveValue("Buddy");
  });

  it("clears the shared search when Enter opens Patients", () => {
    renderShell();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search patients" }), { target: { value: "Buddy" } });

    fireEvent.submit(screen.getByRole("search", { name: "Quick search" }));

    expect(screen.getByTestId("shared-search")).toBeEmptyDOMElement();
  });
});

// At 700 px and below the rail is a bottom bar with More (2.27b).
describe("the bottom bar on phones", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 700px)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function more() {
    return screen.getByRole("button", { name: "More" });
  }

  it("shows Overview, ER board, Patients, Team and More in the bottom bar", () => {
    renderShell();

    const bar = screen.getByRole("navigation", { name: "Main" });
    expect(within(bar).getAllByRole("link").map((link) => link.getAttribute("aria-label")))
      .toEqual(["Overview", "ER board", "Patients", "Team"]);
    expect(within(bar).getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /navigation menu/ })).not.toBeInTheDocument();
  });

  it("opens More with Reports and Settings", () => {
    renderShell();

    fireEvent.click(more());

    expect(more()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("closes More with Escape and returns focus to it", () => {
    renderShell();
    fireEvent.click(more());

    fireEvent.keyDown(document, { key: "Escape" });

    expect(more()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Reports" })).not.toBeInTheDocument();
    expect(more()).toHaveFocus();
  });

  it("closes More on a press outside it", () => {
    renderShell();
    fireEvent.click(more());

    fireEvent.pointerDown(screen.getByTestId("where"));

    expect(more()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes More after choosing a destination", () => {
    renderShell();
    fireEvent.click(more());

    fireEvent.click(screen.getByRole("link", { name: "Reports" }));

    expect(screen.getByTestId("where")).toHaveTextContent("/reports");
    expect(more()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes More after navigation from elsewhere", () => {
    renderShell();
    fireEvent.click(more());

    fireEvent.click(screen.getByRole("link", { name: "Search patients" }));

    expect(screen.getByTestId("where")).toHaveTextContent("/records");
    expect(more()).toHaveAttribute("aria-expanded", "false");
  });

  it("marks More as the current section on Reports", () => {
    renderShell("/reports");

    expect(more()).toHaveAttribute("aria-current", "true");
    expect(screen.queryAllByRole("link", { current: "page" })).toHaveLength(0);
  });
});
