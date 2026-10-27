import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { apiUrl, server } from "../test/server";
import {
  finishSignIn,
  getSignedInUser,
  signInByEmail,
  startPhoneSignIn,
  verifyPhoneSignIn
} from "./authApi";
import { readAccessToken } from "./session";

afterEach(() => {
  sessionStorage.clear();
});

function failWith(status: number, body?: unknown) {
  server.use(
    http.post(apiUrl("/api/auth/email"), () =>
      body === undefined
        ? new HttpResponse(null, { status })
        : HttpResponse.json(body, { status })
    )
  );
}

describe("signInByEmail", () => {
  it("posts the email and password as JSON and returns the token", async () => {
    let received: { contentType: string | null; body: unknown } | undefined;
    server.use(
      http.post(apiUrl("/api/auth/email"), async ({ request }) => {
        received = {
          contentType: request.headers.get("Content-Type"),
          body: await request.json()
        };
        return HttpResponse.json({ tokenType: "Bearer", accessToken: "token-1", expiresIn: 3600 });
      })
    );

    const result = await signInByEmail("team@vetiflow.demo", "welcome1");

    expect(received).toEqual({
      contentType: "application/json",
      body: { email: "team@vetiflow.demo", password: "welcome1" }
    });
    expect(result).toEqual({ ok: true, accessToken: "token-1" });
  });

  it.each(["unknownAccount", "wrongPassword", "inactiveAccount"] as const)(
    "returns the %s failure from a 401",
    async (code) => {
      failWith(401, { status: 401, title: "Sign-in failed", code });

      await expect(signInByEmail("a@b.demo", "x")).resolves.toEqual({ ok: false, failure: code });
    }
  );

  it("treats a server error as unavailable", async () => {
    failWith(500);

    await expect(signInByEmail("a@b.demo", "x")).resolves.toEqual({ ok: false, failure: "unavailable" });
  });

  it("treats a network error as unavailable", async () => {
    server.use(http.post(apiUrl("/api/auth/email"), () => HttpResponse.error()));

    await expect(signInByEmail("a@b.demo", "x")).resolves.toEqual({ ok: false, failure: "unavailable" });
  });

  it("treats a 401 with an unknown code as unavailable", async () => {
    failWith(401, { status: 401, code: "somethingNew" });

    await expect(signInByEmail("a@b.demo", "x")).resolves.toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("phone sign-in", () => {
  it("starts with the number and reports ready", async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl("/api/auth/phone/start"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      })
    );

    await expect(startPhoneSignIn("312-555-0101")).resolves.toEqual({ ok: true });
    expect(body).toEqual({ phoneNumber: "312-555-0101" });
  });

  it("verifies the number and code and returns the token", async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl("/api/auth/phone/verify"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ tokenType: "Bearer", accessToken: "token-2", expiresIn: 3600 });
      })
    );

    await expect(verifyPhoneSignIn("312-555-0101", "123456")).resolves.toEqual({
      ok: true,
      accessToken: "token-2"
    });
    expect(body).toEqual({ phoneNumber: "312-555-0101", code: "123456" });
  });

  it.each([
    ["/api/auth/phone/start", 401, "unknownPhone"],
    ["/api/auth/phone/verify", 401, "wrongCode"],
    ["/api/auth/phone/verify", 401, "inactiveAccount"],
    ["/api/auth/phone/start", 403, "phoneSignInOff"]
  ] as const)("returns the %s %i code %s", async (path, status, code) => {
    server.use(http.post(apiUrl(path), () => HttpResponse.json({ status, code }, { status })));

    const result = path.endsWith("start")
      ? await startPhoneSignIn("312-555-0101")
      : await verifyPhoneSignIn("312-555-0101", "123456");

    expect(result).toEqual({ ok: false, failure: code });
  });

  it("treats a network error as unavailable", async () => {
    server.use(http.post(apiUrl("/api/auth/phone/start"), () => HttpResponse.error()));

    await expect(startPhoneSignIn("312-555-0101")).resolves.toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("finishSignIn", () => {
  it("keeps the token and returns who signed in", async () => {
    server.use(
      http.get(apiUrl("/api/auth/me"), () => HttpResponse.json({ name: "Jordan Lee", experience: "teamMember" }))
    );

    await expect(finishSignIn("token-3")).resolves.toEqual({ name: "Jordan Lee", experience: "teamMember" });
    expect(readAccessToken()).toBe("token-3");
  });

  it("leaves no token behind when the user can't be loaded", async () => {
    server.use(http.get(apiUrl("/api/auth/me"), () => new HttpResponse(null, { status: 500 })));

    await expect(finishSignIn("token-3")).rejects.toThrow();
    expect(readAccessToken()).toBeNull();
  });
});

describe("getSignedInUser", () => {
  it("sends the token and returns the name and experience", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(apiUrl("/api/auth/me"), ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({ name: "Jordan Lee", experience: "teamMember" });
      })
    );

    const user = await getSignedInUser("token-1");

    expect(authorization).toBe("Bearer token-1");
    expect(user).toEqual({ name: "Jordan Lee", experience: "teamMember" });
  });

  it("throws when the token is not accepted", async () => {
    server.use(http.get(apiUrl("/api/auth/me"), () => new HttpResponse(null, { status: 401 })));

    await expect(getSignedInUser("expired")).rejects.toThrow();
  });
});
