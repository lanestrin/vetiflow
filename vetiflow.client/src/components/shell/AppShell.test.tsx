import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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

// Shows the search the shell shares with the page below it.
function SearchReader() {
  return <p data-testid="shared-search">{useShellSearch()}</p>;
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

  it("clears the shared search when Enter opens Patients", () => {
    renderShell();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search patients" }), { target: { value: "Buddy" } });

    fireEvent.submit(screen.getByRole("search", { name: "Quick search" }));

    expect(screen.getByTestId("shared-search")).toBeEmptyDOMElement();
  });

  it("opens the mobile navigation and focuses its first destination", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "main-navigation");

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Close navigation menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Main" })).toHaveAttribute("id", "main-navigation");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveFocus();
  });

  it("closes the mobile navigation with Escape and returns focus to the toggle", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(toggle);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("closes the mobile navigation after selecting a destination", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(toggle);

    fireEvent.click(screen.getByRole("link", { name: "Patients" }));

    expect(screen.getByTestId("where")).toHaveTextContent("/records");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("closes after non-rail navigation and stays closed through browser history", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("link", { name: "Search patients" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/records");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Previous route" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/er");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Next route" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/records");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("resets on desktop without intercepting Escape or reopening on mobile", () => {
    const media = Object.assign(new EventTarget(), { matches: true });
    vi.stubGlobal("matchMedia", () => media);
    renderShell();
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(toggle);
    media.matches = false;
    act(() => media.dispatchEvent(Object.assign(new Event("change"), { matches: false })));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).not.toHaveFocus();
    const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    fireEvent(document, escape);
    expect(escape.defaultPrevented).toBe(false);
    media.matches = true;
    act(() => media.dispatchEvent(Object.assign(new Event("change"), { matches: true })));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveFocus();
  });
});
