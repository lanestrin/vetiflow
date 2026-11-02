import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { apiUrl, server } from "../test/server";
import { AccessDeniedError, SessionEndedError } from "./apiErrors";
import { getRooms } from "./roomsApi";
import { saveAccessToken } from "./session";

afterEach(() => {
  sessionStorage.clear();
});

describe("getRooms", () => {
  it("loads the rooms with the token", async () => {
    saveAccessToken("token-rooms");
    let authorization: string | null = null;
    const rooms = [{ id: "room-1", name: "Oxygen Cage", type: "oxygen", occupiedBy: { id: "case-1", caseNumber: "ER-2481" } }];
    server.use(
      http.get(apiUrl("/api/rooms"), ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json(rooms);
      })
    );

    await expect(getRooms()).resolves.toEqual(rooms);
    expect(authorization).toBe("Bearer token-rooms");
  });

  it.each([
    [401, SessionEndedError],
    [403, AccessDeniedError]
  ])("turns a %i into a refused session", async (status, errorType) => {
    server.use(http.get(apiUrl("/api/rooms"), () => new HttpResponse(null, { status })));

    await expect(getRooms()).rejects.toBeInstanceOf(errorType);
  });

  it("fails on any other error", async () => {
    server.use(http.get(apiUrl("/api/rooms"), () => new HttpResponse(null, { status: 500 })));

    await expect(getRooms()).rejects.toThrow("Failed to load rooms.");
  });
});
