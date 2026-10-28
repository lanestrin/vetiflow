import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { buildPatientListItem } from "../test/builders";
import { apiUrl, server } from "../test/server";
import { AccessDeniedError, SessionEndedError } from "./apiErrors";
import { searchPatients } from "./recordsApi";
import { saveAccessToken } from "./session";

afterEach(() => {
  sessionStorage.clear();
});

describe("searchPatients", () => {
  it("sends the search text and the session's token, and returns the list", async () => {
    saveAccessToken("token-1");
    const patients = [buildPatientListItem(), buildPatientListItem({ ownerId: null, ownerName: null })];
    let seen: { search: string | null; authorization: string | null } | null = null;
    server.use(
      http.get(apiUrl("/api/patients"), ({ request }) => {
        seen = {
          search: new URL(request.url).searchParams.get("search"),
          authorization: request.headers.get("Authorization")
        };
        return HttpResponse.json(patients);
      })
    );

    await expect(searchPatients("Rex & Co")).resolves.toEqual(patients);
    expect(seen).toEqual({ search: "Rex & Co", authorization: "Bearer token-1" });
  });

  it("throws SessionEndedError on 401", async () => {
    server.use(http.get(apiUrl("/api/patients"), () => new HttpResponse(null, { status: 401 })));

    await expect(searchPatients("Rex")).rejects.toBeInstanceOf(SessionEndedError);
  });

  it("throws AccessDeniedError on 403", async () => {
    server.use(http.get(apiUrl("/api/patients"), () => new HttpResponse(null, { status: 403 })));

    await expect(searchPatients("Rex")).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("throws on any other failure", async () => {
    server.use(http.get(apiUrl("/api/patients"), () => new HttpResponse(null, { status: 500 })));

    await expect(searchPatients("Rex")).rejects.toThrow("Failed to search patients.");
  });
});
