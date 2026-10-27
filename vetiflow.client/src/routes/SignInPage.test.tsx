import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failureMessages } from "../components/auth/signInMessages";
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

// A response the test lets go of when it chooses, to catch a request in flight.
function holdResponse() {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { released, release: () => release() };
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

  it("ends with the emergency bar", () => {
    renderSignIn();

    expect(screen.getByRole("complementary", { name: "Emergency veterinary care" })).toBeInTheDocument();
  });

  it("keeps the art and icons out of the screen reader's way", () => {
    renderSignIn();

    expect(screen.queryAllByRole("img")).toHaveLength(0);
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
    ["", "", "Email address"],
    ["team@vetiflow.demo", "", "Password"]
  ])("focuses the first invalid field after a failed submit (%j / %j)", (email, password, field) => {
    renderSignIn();

    fillAndSubmit(email, password);

    expect(screen.getByLabelText(field)).toHaveFocus();
  });

  it("shows no error before the first submit", () => {
    renderSignIn();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "not-an-email" } });

    expect(screen.getByLabelText("Email address")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(/Enter an email address/)).not.toBeInTheDocument();
  });

  it("clears a field's error as it is corrected", () => {
    renderSignIn();
    fillAndSubmit("", "");
    const email = screen.getByLabelText("Email address");

    fireEvent.change(email, { target: { value: "team@" } });
    expect(email).toHaveAccessibleDescription("Enter an email address like you@example.com.");

    fireEvent.change(email, { target: { value: "team@vetiflow.demo" } });
    expect(email).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.");

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "w" } });
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid");
  });

  it("keeps typed values when switching methods", () => {
    renderSignIn();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "team@vetiflow.demo" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "welcome1" } });

    fireEvent.click(screen.getByRole("tab", { name: "Phone" }));
    fireEvent.change(screen.getByLabelText("Mobile phone number"), { target: { value: "312-555-0101" } });
    fireEvent.click(screen.getByRole("tab", { name: "Email" }));

    expect(screen.getByLabelText("Email address")).toHaveValue("team@vetiflow.demo");
    expect(screen.getByLabelText("Password")).toHaveValue("welcome1");
    fireEvent.click(screen.getByRole("tab", { name: "Phone" }));
    expect(screen.getByLabelText("Mobile phone number")).toHaveValue("312-555-0101");
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

  it("recovers when the sign-in response is malformed", async () => {
    server.use(http.post(apiUrl("/api/auth/email"), () => HttpResponse.text("not json")));
    renderSignIn();

    fillAndSubmit("team@vetiflow.demo", "welcome1");

    expect(await screen.findByText(failureMessages.unavailable)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
    expect(readAccessToken()).toBeNull();
  });

  it("sends one request when sign-in is pressed twice", async () => {
    let requests = 0;
    server.use(
      http.post(apiUrl("/api/auth/email"), () => {
        requests += 1;
        return HttpResponse.json({ accessToken: "token-1" });
      }),
      http.get(apiUrl("/api/auth/me"), () => HttpResponse.json(teamMember))
    );
    renderSignIn();

    fillAndSubmit("team@vetiflow.demo", "welcome1");
    fireEvent.submit(screen.getByLabelText("Password"));

    await screen.findByRole("heading", { level: 1, name: "You're all set" });
    expect(requests).toBe(1);
  });

  it("drops an email sign-in that finishes after switching to Phone", async () => {
    const answer = holdResponse();
    server.use(
      http.post(apiUrl("/api/auth/email"), async () => {
        await answer.released;
        return HttpResponse.json({ accessToken: "token-1" });
      }),
      http.get(apiUrl("/api/auth/me"), () => HttpResponse.json(teamMember))
    );
    renderSignIn();
    fillAndSubmit("team@vetiflow.demo", "welcome1");

    fireEvent.click(screen.getByRole("tab", { name: "Phone" }));
    answer.release();
    fireEvent.click(screen.getByRole("tab", { name: "Email" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled());
    expect(screen.getByLabelText("Email address")).toHaveValue("team@vetiflow.demo");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading", { name: "You're all set" })).not.toBeInTheDocument();
    expect(readAccessToken()).toBeNull();
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

  it("shows and hides the password", () => {
    renderSignIn();
    const password = screen.getByLabelText("Password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(password).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hide);

    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps only the chosen form reachable after switching back and forth", () => {
    renderSignIn();

    // A hidden panel is out of the accessibility tree, so role queries skip it.
    fireEvent.click(screen.getByRole("tab", { name: "Phone" }));
    expect(screen.getByRole("tabpanel", { name: "Phone" })).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Email" })).not.toBeInTheDocument();
    // It keeps its space on screen, so inert keeps it out of reach.
    const inertPanels = screen
      .getAllByRole("tabpanel", { hidden: true })
      .filter((panel) => panel.hasAttribute("inert"));
    expect(inertPanels).toHaveLength(1);
    expect(inertPanels[0]).toHaveAttribute("aria-labelledby", "sign-in-tab-email");

    fireEvent.click(screen.getByRole("tab", { name: "Email" }));
    expect(screen.getByRole("tabpanel", { name: "Email" })).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Phone" })).not.toBeInTheDocument();
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
    // Sending and the code check are simulated with short waits; fake timers
    // jump past them (and still run on their own, so waitFor works).
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
      server.events.removeAllListeners();
    });

    async function passTheWait() {
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }

    // The paths of every request the page makes from here on.
    function recordRequests() {
      const paths: string[] = [];
      server.events.on("request:start", ({ request }) => {
        paths.push(new URL(request.url).pathname);
      });
      return paths;
    }

    function openPhoneTab() {
      fireEvent.click(screen.getByRole("tab", { name: "Phone" }));
    }

    function sendCode(phoneNumber: string) {
      fireEvent.change(screen.getByLabelText("Mobile phone number"), { target: { value: phoneNumber } });
      fireEvent.click(screen.getByRole("button", { name: /text me a sign-in code/i }));
    }

    async function sendCodeAndWait(phoneNumber: string) {
      sendCode(phoneNumber);
      await passTheWait();
      await waitFor(() => expect(screen.getByLabelText("Verification code")).toBeEnabled());
    }

    function enterCode(code: string) {
      fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: code } });
      fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    }

    function servePhoneVerify(user: SignedInUser) {
      server.use(
        http.post(apiUrl("/api/auth/phone/verify"), () =>
          HttpResponse.json({ tokenType: "Bearer", accessToken: "phone-token", expiresIn: 3600 })
        ),
        http.get(apiUrl("/api/auth/me"), () => HttpResponse.json(user))
      );
    }

    it("shows the code field from the start, off until a code is sent", () => {
      renderSignIn();
      openPhoneTab();

      expect(screen.getByLabelText("Mobile phone number")).toBeEnabled();
      const codeInput = screen.getByLabelText("Verification code");
      expect(codeInput).toBeDisabled();
      expect(codeInput).toHaveAttribute("placeholder", "Send a code first");
      expect(screen.queryByRole("button", { name: "Send again" })).not.toBeInTheDocument();
    });

    it("asks for a 10-digit number before sending", async () => {
      const requests = recordRequests();
      renderSignIn();
      openPhoneTab();

      sendCode("555-0101");
      await passTheWait();

      const input = screen.getByLabelText("Mobile phone number");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription(
        "Enter a 10-digit mobile number like 312-555-0101. Demo mode: no text is sent. The next step shows the code to use."
      );
      expect(screen.getByLabelText("Verification code")).toBeDisabled();
      expect(requests).toEqual([]);
    });

    it("pretends to send, then opens the code field without asking the API", async () => {
      const requests = recordRequests();
      renderSignIn();
      openPhoneTab();

      sendCode("312-555-0102");

      expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
      await passTheWait();
      const codeInput = screen.getByLabelText("Verification code");
      await waitFor(() => expect(codeInput).toHaveFocus());
      expect(codeInput).toHaveAttribute("placeholder", "6-digit code");
      expect(screen.getByRole("status")).toHaveTextContent("Demo verification is ready. No text was sent.");
      expect(screen.getByText(/Use code/)).toHaveTextContent("Demo mode: no text is sent. Use code 123456.");
      expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeEnabled();
      expect(requests).toEqual([]);
    });

    it("asks for the 6-digit code", async () => {
      renderSignIn();
      openPhoneTab();
      await sendCodeAndWait("312-555-0101");

      enterCode("12");

      expect(screen.getByLabelText("Verification code")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("Enter the 6-digit code.")).toBeInTheDocument();
    });

    it("says to use 123456 when the code is wrong, without asking the API", async () => {
      const requests = recordRequests();
      renderSignIn();
      openPhoneTab();
      await sendCodeAndWait("312-555-0101");

      enterCode("654321");

      expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
      await passTheWait();
      expect(await screen.findByText("Use 123456 for this demo.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeEnabled();
      expect(requests).toEqual([]);
      expect(readAccessToken()).toBeNull();
    });

    it.each([
      ["unknownPhone", 401, "We couldn't match that demo phone. Try one of the sample numbers below."],
      ["phoneSignInOff", 403, "Phone sign-in is turned off for this demo. Use email instead."]
    ])("shows the message for %s when verifying", async (code, status, message) => {
      server.use(
        http.post(apiUrl("/api/auth/phone/verify"), () => HttpResponse.json({ status, code }, { status }))
      );
      renderSignIn();
      openPhoneTab();
      await sendCodeAndWait("312-555-0199");

      enterCode("123456");
      await passTheWait();

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(readAccessToken()).toBeNull();
    });

    it("turns the code field off again when the number changes", async () => {
      renderSignIn();
      openPhoneTab();
      await sendCodeAndWait("312-555-0101");
      fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123" } });

      fireEvent.change(screen.getByLabelText("Mobile phone number"), { target: { value: "312-555-0102" } });

      const codeInput = screen.getByLabelText("Verification code");
      expect(codeInput).toBeDisabled();
      expect(codeInput).toHaveValue("");
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(screen.getByRole("button", { name: /text me a sign-in code/i })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Send again" })).not.toBeInTheDocument();
    });

    it("sends again and keeps the code field on", async () => {
      const requests = recordRequests();
      renderSignIn();
      openPhoneTab();
      await sendCodeAndWait("312-555-0101");

      fireEvent.click(screen.getByRole("button", { name: "Send again" }));

      expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      await passTheWait();
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Demo verification is ready. No text was sent.")
      );
      expect(screen.getByLabelText("Verification code")).toBeEnabled();
      expect(requests).toEqual([]);
    });

    it("focuses the field that needs fixing", async () => {
      renderSignIn();
      openPhoneTab();

      sendCode("555");
      expect(screen.getByLabelText("Mobile phone number")).toHaveFocus();

      await sendCodeAndWait("312-555-0101");
      screen.getByRole("button", { name: "Verify and sign in" }).focus();
      enterCode("12");
      expect(screen.getByLabelText("Verification code")).toHaveFocus();
    });

    it("drops a send that finishes after switching to Email", async () => {
      renderSignIn();
      openPhoneTab();
      sendCode("312-555-0101");

      fireEvent.click(screen.getByRole("tab", { name: "Email" }));
      await passTheWait();
      openPhoneTab();

      expect(screen.getByLabelText("Verification code")).toBeDisabled();
      expect(screen.getByRole("button", { name: /text me a sign-in code/i })).toBeEnabled();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("drops a code check that finishes after switching to Email", async () => {
      const answer = holdResponse();
      server.use(
        http.post(apiUrl("/api/auth/phone/verify"), async () => {
          await answer.released;
          return HttpResponse.json({ accessToken: "phone-token" });
        }),
        http.get(apiUrl("/api/auth/me"), () => HttpResponse.json(teamMember))
      );
      renderSignIn();
      openPhoneTab();
      await sendCodeAndWait("312-555-0101");
      enterCode("123456");
      await passTheWait();

      fireEvent.click(screen.getByRole("tab", { name: "Email" }));
      answer.release();
      openPhoneTab();

      await waitFor(() => expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeEnabled());
      expect(screen.getByLabelText("Verification code")).toHaveValue("123456");
      expect(screen.queryByRole("heading", { name: "You're all set" })).not.toBeInTheDocument();
      expect(readAccessToken()).toBeNull();
    });

    it("checks the code once when Verify is pressed twice", async () => {
      servePhoneVerify(teamMember);
      const requests = recordRequests();
      renderSignIn();
      openPhoneTab();
      await sendCodeAndWait("312-555-0101");

      enterCode("123456");
      fireEvent.submit(screen.getByLabelText("Verification code"));
      await passTheWait();

      await screen.findByRole("heading", { level: 1, name: "You're all set" });
      expect(requests.filter((path) => path.endsWith("/api/auth/phone/verify"))).toHaveLength(1);
    });

    it.each([
      [teamMember, "312-555-0101", "Continue as Hospital team member", "Board opened"],
      [petParent, "312-555-0102", "Continue as Pet parent", "Pet parent home opened"]
    ])("signs in %o by phone and continues to the right experience", async (user, phoneNumber, continueLabel, destination) => {
      servePhoneVerify(user);
      renderSignIn();
      openPhoneTab();
      await sendCodeAndWait(phoneNumber);

      enterCode("123456");
      await passTheWait();

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
