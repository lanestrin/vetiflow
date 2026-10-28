import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { buildCase } from "../test/builders";
import { apiUrl, server } from "../test/server";
import type { CaseIntakeRequest } from "../types/CaseIntake";
import { AccessDeniedError, FormRejectedError, SessionEndedError } from "./apiErrors";
import { createIntake, getEmergencyCases, updateCaseStage } from "./casesApi";
import { saveAccessToken } from "./session";

afterEach(() => {
  sessionStorage.clear();
});

describe("board requests", () => {
  it("send the session's token", async () => {
    saveAccessToken("token-1");
    const seen: (string | null)[] = [];
    server.use(
      http.get(apiUrl("/api/cases"), ({ request }) => {
        seen.push(request.headers.get("Authorization"));
        return HttpResponse.json([]);
      }),
      http.patch(apiUrl("/api/cases/case-42/stage"), ({ request }) => {
        seen.push(request.headers.get("Authorization"));
        return new HttpResponse(null, { status: 204 });
      })
    );

    await getEmergencyCases();
    await updateCaseStage("case-42", "treatment");

    expect(seen).toEqual(["Bearer token-1", "Bearer token-1"]);
  });

  it("throw SessionEndedError on 401", async () => {
    server.use(http.get(apiUrl("/api/cases"), () => new HttpResponse(null, { status: 401 })));

    await expect(getEmergencyCases()).rejects.toBeInstanceOf(SessionEndedError);
  });

  it("throw AccessDeniedError on 403", async () => {
    server.use(
      http.patch(apiUrl("/api/cases/case-42/stage"), () => new HttpResponse(null, { status: 403 }))
    );

    await expect(updateCaseStage("case-42", "treatment")).rejects.toBeInstanceOf(AccessDeniedError);
  });
});

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

const intake: CaseIntakeRequest = {
  petName: "Toby",
  species: "Dog",
  breed: null,
  age: "5 years",
  ownerName: "Jo Mills",
  ownerPhone: "312-555-0177",
  chiefComplaint: "Acute vomiting",
  priority: "urgent",
  triageNotes: null,
  allergies: null,
  medications: null,
  treatmentAuthorization: "notDiscussed",
  referringClinic: null
};

describe("createIntake", () => {
  it("posts the intake with the token and returns the new case", async () => {
    saveAccessToken("token-1");
    let sent: { body: unknown; authorization: string | null } | null = null;
    server.use(
      http.post(apiUrl("/api/cases/intake"), async ({ request }) => {
        sent = { body: await request.json(), authorization: request.headers.get("Authorization") };
        return HttpResponse.json({ id: "case-9", caseNumber: "ER-2489", patientId: "patient-9" }, { status: 201 });
      })
    );

    await expect(createIntake(intake)).resolves.toEqual({ id: "case-9", caseNumber: "ER-2489", patientId: "patient-9" });
    expect(sent).toEqual({ body: intake, authorization: "Bearer token-1" });
  });

  it("brings back the first message for each refused field", async () => {
    server.use(
      http.post(apiUrl("/api/cases/intake"), () =>
        HttpResponse.json(
          { status: 400, errors: { OwnerName: ["Enter the pet parent's first and last name.", "Second"], Age: ["Enter an age like 8 years."] } },
          { status: 400 }
        ))
    );

    const error = await createIntake(intake).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FormRejectedError);
    expect((error as FormRejectedError).fieldErrors).toEqual({
      OwnerName: "Enter the pet parent's first and last name.",
      Age: "Enter an age like 8 years."
    });
  });

  it.each([
    [401, SessionEndedError],
    [403, AccessDeniedError]
  ])("turns %i into its error", async (status, errorType) => {
    server.use(http.post(apiUrl("/api/cases/intake"), () => new HttpResponse(null, { status })));

    await expect(createIntake(intake)).rejects.toBeInstanceOf(errorType);
  });

  it("fails plainly on a server error", async () => {
    server.use(http.post(apiUrl("/api/cases/intake"), () => new HttpResponse(null, { status: 500 })));

    await expect(createIntake(intake)).rejects.toThrow("Failed to add the patient.");
  });
});
