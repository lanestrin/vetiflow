import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { buildBoardSummary } from "../test/builders";
import { apiUrl, server } from "../test/server";
import { AccessDeniedError, SessionEndedError } from "./apiErrors";
import { getBoardSummary } from "./boardApi";
import { saveAccessToken } from "./session";

afterEach(() => {
  sessionStorage.clear();
});

describe("getBoardSummary", () => {
  it("returns the summary from the API", async () => {
    const summary = buildBoardSummary({ patientsInCare: 12, awaitingTriage: 3 });
    server.use(http.get(apiUrl("/api/board/summary"), () => HttpResponse.json(summary)));

    await expect(getBoardSummary()).resolves.toEqual(summary);
  });

  it("sends the session's token", async () => {
    saveAccessToken("token-1");
    let seen: string | null = null;
    server.use(
      http.get(apiUrl("/api/board/summary"), ({ request }) => {
        seen = request.headers.get("Authorization");
        return HttpResponse.json(buildBoardSummary());
      })
    );

    await getBoardSummary();

    expect(seen).toBe("Bearer token-1");
  });

  it("throws SessionEndedError on 401", async () => {
    server.use(http.get(apiUrl("/api/board/summary"), () => new HttpResponse(null, { status: 401 })));

    await expect(getBoardSummary()).rejects.toBeInstanceOf(SessionEndedError);
  });

  it("throws AccessDeniedError on 403", async () => {
    server.use(http.get(apiUrl("/api/board/summary"), () => new HttpResponse(null, { status: 403 })));

    await expect(getBoardSummary()).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("throws when the API responds with an error", async () => {
    server.use(http.get(apiUrl("/api/board/summary"), () => new HttpResponse(null, { status: 500 })));

    await expect(getBoardSummary()).rejects.toThrow("Failed to load the board summary.");
  });
});
