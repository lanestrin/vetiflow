import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { SessionBar } from "./SessionBar";

afterEach(() => {
  sessionStorage.clear();
});

describe("SessionBar", () => {
  it("names the signed-in person as a demo account", () => {
    render(
      <MemoryRouter>
        <SessionBar user={{ name: "Jordan Lee", experience: "teamMember" }} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Signed in as/)).toHaveTextContent("Signed in as Jordan Lee (demo)");
  });

  it("signs out: forgets the token and goes to sign in", () => {
    saveAccessToken("token-1");
    render(
      <MemoryRouter initialEntries={["/er"]}>
        <Routes>
          <Route path="/er" element={<SessionBar user={{ name: "Jordan Lee", experience: "teamMember" }} />} />
          <Route path="/sign-in" element={<p>Sign-in page</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(readAccessToken()).toBeNull();
    expect(screen.getByText("Sign-in page")).toBeInTheDocument();
  });
});
