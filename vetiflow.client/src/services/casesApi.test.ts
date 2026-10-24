import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { buildCase } from "../test/builders";
import { apiUrl, server } from "../test/server";
import { getEmergencyCases, updateCaseStage } from "./casesApi";

describe("getEmergencyCases", () => {
  it("returns the cases from the API", async () => {
    const cases = [buildCase(), buildCase()];
    server.use(
      http.get(apiUrl("/api/cases"), () => HttpResponse.json(cases))
    );

    await expect(getEmergencyCases()).resolves.toEqual(cases);
  });

  it("throws when the API responds with an error", async () => {
    server.use(
      http.get(apiUrl("/api/cases"), () =>
        new HttpResponse(null, { status: 500 })
      )
    );

    await expect(getEmergencyCases()).rejects.toThrow(
      "Failed to load emergency cases."
    );
  });
});

describe("updateCaseStage", () => {
  it("sends the new stage as JSON to the case's stage endpoint", async () => {
    let received: { method: string; contentType: string | null; body: unknown } | undefined;
    server.use(
      http.patch(apiUrl("/api/cases/case-42/stage"), async ({ request }) => {
        received = {
          method: request.method,
          contentType: request.headers.get("Content-Type"),
          body: await request.json()
        };
        return new HttpResponse(null, { status: 204 });
      })
    );

    await updateCaseStage("case-42", "treatment");

    expect(received).toEqual({
      method: "PATCH",
      contentType: "application/json",
      body: { stage: "treatment" }
    });
  });

  it("throws when the API rejects the update", async () => {
    server.use(
      http.patch(apiUrl("/api/cases/case-42/stage"), () =>
        new HttpResponse(null, { status: 404 })
      )
    );

    await expect(updateCaseStage("case-42", "treatment")).rejects.toThrow(
      "Failed to update case stage."
    );
  });
});
