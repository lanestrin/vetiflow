import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { apiUrl, server } from "../test/server";
import { AccessDeniedError, SessionEndedError } from "./apiErrors";
import { saveAccessToken } from "./session";
import { getMyStatus, setMyStatus } from "./staffApi";

const route = apiUrl("/api/staff/me/status");

afterEach(() => {
  sessionStorage.clear();
});

describe("getMyStatus", () => {
  it("returns the status from the API with the session's token", async () => {
    saveAccessToken("token-1");
    let seen: string | null = null;
    server.use(
      http.get(route, ({ request }) => {
        seen = request.headers.get("Authorization");
        return HttpResponse.json({ status: "atLimit" });
      })
    );

    await expect(getMyStatus()).resolves.toBe("atLimit");
    expect(seen).toBe("Bearer token-1");
  });

  it("throws SessionEndedError on 401", async () => {
    server.use(http.get(route, () => new HttpResponse(null, { status: 401 })));

    await expect(getMyStatus()).rejects.toBeInstanceOf(SessionEndedError);
  });

  it("throws AccessDeniedError on 403", async () => {
    server.use(http.get(route, () => new HttpResponse(null, { status: 403 })));

    await expect(getMyStatus()).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("throws when the API responds with an error", async () => {
    server.use(http.get(route, () => new HttpResponse(null, { status: 500 })));

    await expect(getMyStatus()).rejects.toThrow("Failed to load my status.");
  });
});

describe("setMyStatus", () => {
  it("puts the status with the session's token", async () => {
    saveAccessToken("token-1");
    let seen: { method: string; authorization: string | null; body: unknown } | null = null;
    server.use(
      http.put(route, async ({ request }) => {
        seen = {
          method: request.method,
          authorization: request.headers.get("Authorization"),
          body: await request.json()
        };
        return new HttpResponse(null, { status: 204 });
      })
    );

    await setMyStatus("busy");

    expect(seen).toEqual({ method: "PUT", authorization: "Bearer token-1", body: { status: "busy" } });
  });

  it("throws SessionEndedError on 401", async () => {
    server.use(http.put(route, () => new HttpResponse(null, { status: 401 })));

    await expect(setMyStatus("busy")).rejects.toBeInstanceOf(SessionEndedError);
  });

  it("throws AccessDeniedError on 403", async () => {
    server.use(http.put(route, () => new HttpResponse(null, { status: 403 })));

    await expect(setMyStatus("busy")).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("throws when the API responds with an error", async () => {
    server.use(http.put(route, () => new HttpResponse(null, { status: 500 })));

    await expect(setMyStatus("busy")).rejects.toThrow("Failed to save my status.");
  });
});
