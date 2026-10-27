import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { readAccessToken } from "../services/session";
import { apiUrl, server } from "../test/server";
import type { SignedInUser } from "../types/Auth";
import { SignInPage } from "./SignInPage";

const teamMember: SignedInUser = { name: "Jordan Lee", experience: "teamMember" };
const petParent: SignedInUser = { name: "Morgan Hale", experience: "petParent" };

afterEach(() => {
  sessionStorage.clear();
});

function renderSignIn() {
  render(
    <MemoryRouter initialEntries={["/sign-in"]}>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/er" element={<p>Board opened</p>} />
        <Route path="/pet-parent" element={<p>Pet parent home opened</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function serveSignIn(user: SignedInUser) {
  server.use(
    http.post(apiUrl("/api/auth/email"), () =>
      HttpResponse.json({ tokenType: "Bearer", accessToken: "token-1", expiresIn: 3600 })
    ),
    http.get(apiUrl("/api/auth/me"), () => HttpResponse.json(user))
  );
}

function serveFailure(code: string) {
  server.use(
    http.post(apiUrl("/api/auth/email"), () =>
      HttpResponse.json({ status: 401, title: "Sign-in failed", code }, { status: 401 })
    )
  );
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("SignInPage", () => {
  it("names the tab and greets the visitor", () => {
    renderSignIn();

    expect(document.title).toBe("Sign in · VetiFlow");
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Email" })).toHaveAttribute("aria-selected", "true");
  });

  it.each([
    ["", "welcome1", "Email address", "Enter your email address."],
    ["not-an-email", "welcome1", "Email address", "Enter an email address like you@example.com."],
    ["team@vetiflow.demo", "", "Password", "Enter your password."]
  ])("shows a field error for %j / %j before sending", (email, password, field, error) => {
    renderSignIn();

    fillAndSubmit(email, password);

    const input = screen.getByLabelText(field);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(error);
  });

  it.each([
    ["unknownAccount", "We couldn't match that demo account. Try one of the sample emails below."],
    ["wrongPassword", "Use welcome1 for this demo account."],
    ["inactiveAccount", "This demo account is turned off."]
  ])("shows the demo message for %s", async (code, message) => {
    serveFailure(code);
    renderSignIn();

    fillAndSubmit("team@vetiflow.demo", "welcome1");

    expect(await screen.findByRole("status")).toHaveTextContent(message);
    expect(readAccessToken()).toBeNull();
  });

  it("says sign-in is unavailable when the API cannot answer", async () => {
    server.use(http.post(apiUrl("/api/auth/email"), () => new HttpResponse(null, { status: 500 })));
    renderSignIn();

    fillAndSubmit("team@vetiflow.demo", "welcome1");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sign-in isn't available right now. Try again in a moment."
    );
  });

  it("disables the button while signing in", async () => {
    serveSignIn(teamMember);
    renderSignIn();

    fillAndSubmit("team@vetiflow.demo", "welcome1");

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    await screen.findByRole("heading", { level: 1, name: "You're all set" });
  });

  it.each([
    [teamMember, "Welcome to your care team", "Continue as Hospital team member", "Board opened"],
    [petParent, "Welcome back", "Continue as Pet parent", "Pet parent home opened"]
  ])("signs in %o and continues to the right experience", async (user, title, continueLabel, destination) => {
    serveSignIn(user);
    renderSignIn();

    fillAndSubmit("demo@vetiflow.demo", "welcome1");

    const heading = await screen.findByRole("heading", { level: 1, name: "You're all set" });
    // Focus moves in an effect just after the heading renders.
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getByText(`Signed in as ${user.name}.`)).toBeInTheDocument();
    expect(readAccessToken()).toBe("token-1");

    fireEvent.click(screen.getByRole("button", { name: continueLabel }));

    expect(await screen.findByText(destination)).toBeInTheDocument();
  });

  it("clears the session when going back to sign in", async () => {
    serveSignIn(teamMember);
    renderSignIn();
    fillAndSubmit("team@vetiflow.demo", "welcome1");
    await screen.findByRole("heading", { level: 1, name: "You're all set" });

    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(readAccessToken()).toBeNull();
  });

  it("says the session ended when sent back from an expired session", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/sign-in", state: { sessionEnded: true } }]}>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toHaveTextContent("Your session ended. Sign in again.");
  });

  it("explains that password reset is a placeholder", () => {
    renderSignIn();

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Password reset is a placeholder in this no-cost demo."
    );
  });

  it("moves between the tabs with the arrow keys", () => {
    renderSignIn();
    const emailTab = screen.getByRole("tab", { name: "Email" });

    fireEvent.keyDown(emailTab, { key: "ArrowRight" });

    const phoneTab = screen.getByRole("tab", { name: "Phone" });
    expect(phoneTab).toHaveAttribute("aria-selected", "true");
    expect(phoneTab).toHaveFocus();
    expect(
      within(screen.getByRole("tabpanel", { name: "Phone" })).getByLabelText("Mobile phone number")
    ).toBeInTheDocument();

    fireEvent.keyDown(phoneTab, { key: "ArrowLeft" });
    expect(emailTab).toHaveAttribute("aria-selected", "true");
  });

  describe("phone", () => {
    function openPhoneTab() {
      fireEvent.click(screen.getByRole("tab", { name: "Phone" }));
    }

    function sendCode(phoneNumber: string) {
      fireEvent.change(screen.getByLabelText("Mobile phone number"), { target: { value: phoneNumber } });
      fireEvent.click(screen.getByRole("button", { name: /text me a sign-in code/i }));
    }

    function enterCode(code: string) {
      fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: code } });
      fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    }

    function servePhoneStart(status = 200, code?: string) {
      server.use(
        http.post(apiUrl("/api/auth/phone/start"), () =>
          status === 200 ? HttpResponse.json({}) : HttpResponse.json({ status, code }, { status })
        )
      );
    }

    it("asks for a 10-digit number before sending", () => {
      renderSignIn();
      openPhoneTab();

      sendCode("555-0101");

      const input = screen.getByLabelText("Mobile phone number");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription("Enter a 10-digit mobile number like 312-555-0101.");
    });

    it("says no text was sent and moves to the code", async () => {
      servePhoneStart();
      renderSignIn();
      openPhoneTab();

      sendCode("312-555-0101");

      const codeInput = await screen.findByLabelText("Verification code");
      await waitFor(() => expect(codeInput).toHaveFocus());
      expect(screen.getByRole("status")).toHaveTextContent("Demo verification is ready. No text was sent.");
      expect(screen.getByText(/Demo mode: no text is sent/)).toHaveTextContent("Use code 123456.");
    });

    it.each([
      ["unknownPhone", 401, "We couldn't match that demo phone. Try one of the sample numbers below."],
      ["phoneSignInOff", 403, "Phone sign-in is turned off for this demo. Use email instead."]
    ])("shows the message for %s when sending", async (code, status, message) => {
      servePhoneStart(status, code);
      renderSignIn();
      openPhoneTab();

      sendCode("312-555-0199");

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
    });

    it("asks for the 6-digit code", async () => {
      servePhoneStart();
      renderSignIn();
      openPhoneTab();
      sendCode("312-555-0101");
      await screen.findByLabelText("Verification code");

      enterCode("12");

      expect(screen.getByLabelText("Verification code")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("Enter the 6-digit code.")).toBeInTheDocument();
    });

    it("says to use 123456 when the code is wrong", async () => {
      servePhoneStart();
      server.use(
        http.post(apiUrl("/api/auth/phone/verify"), () =>
          HttpResponse.json({ status: 401, code: "wrongCode" }, { status: 401 })
        )
      );
      renderSignIn();
      openPhoneTab();
      sendCode("312-555-0101");
      await screen.findByLabelText("Verification code");

      enterCode("654321");

      expect(await screen.findByText("Use 123456 for this demo.")).toBeInTheDocument();
      expect(readAccessToken()).toBeNull();
    });

    it("goes back to the number, and can send again", async () => {
      let starts = 0;
      server.use(
        http.post(apiUrl("/api/auth/phone/start"), () => {
          starts += 1;
          return HttpResponse.json({});
        })
      );
      renderSignIn();
      openPhoneTab();
      sendCode("312-555-0101");
      await screen.findByLabelText("Verification code");

      fireEvent.click(screen.getByRole("button", { name: "Send again" }));
      await waitFor(() => expect(starts).toBe(2));
      fireEvent.click(screen.getByRole("button", { name: "Use a different number" }));

      expect(screen.getByLabelText("Mobile phone number")).toHaveValue("312-555-0101");
      expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
    });

    it.each([
      [teamMember, "312-555-0101", "Continue as Hospital team member", "Board opened"],
      [petParent, "312-555-0102", "Continue as Pet parent", "Pet parent home opened"]
    ])("signs in %o by phone and continues to the right experience", async (user, phoneNumber, continueLabel, destination) => {
      servePhoneStart();
      server.use(
        http.post(apiUrl("/api/auth/phone/verify"), () =>
          HttpResponse.json({ tokenType: "Bearer", accessToken: "phone-token", expiresIn: 3600 })
        ),
        http.get(apiUrl("/api/auth/me"), () => HttpResponse.json(user))
      );
      renderSignIn();
      openPhoneTab();
      sendCode(phoneNumber);
      await screen.findByLabelText("Verification code");

      enterCode("123456");

      expect(await screen.findByRole("heading", { level: 1, name: "You're all set" })).toBeInTheDocument();
      expect(readAccessToken()).toBe("phone-token");
      fireEvent.click(screen.getByRole("button", { name: continueLabel }));
      expect(await screen.findByText(destination)).toBeInTheDocument();
    });
  });

  it("opens the demo accounts from Help", () => {
    renderSignIn();
    // <details> has the "group" role; it is the only group on the page.
    const panel = screen.getByRole("group");
    const summary = within(panel).getByText("Try the demo");
    expect(panel).not.toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: "Help" }));

    expect(panel).toHaveAttribute("open");
    expect(summary).toHaveFocus();
    expect(within(panel).getByText("team@vetiflow.demo")).toBeInTheDocument();
    expect(within(panel).getByText("welcome1")).toBeInTheDocument();
  });
});
