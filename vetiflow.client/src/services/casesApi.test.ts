import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { buildCase, buildCaseDetail } from "../test/builders";
import { apiUrl, server } from "../test/server";
import type { CaseIntakeRequest } from "../types/CaseIntake";
import { AccessDeniedError, CaseGoneError, FormRejectedError, SessionEndedError } from "./apiErrors";
import { completeTask, createIntake, createTask, getCase, getEmergencyCases, reopenTask, triageCase, updateCaseStage } from "./casesApi";
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

describe("getCase", () => {
  it("returns the case from the API with the session's token", async () => {
    saveAccessToken("token-1");
    const detail = buildCaseDetail({ id: "case-42" });
    let authorization: string | null = null;
    server.use(
      http.get(apiUrl("/api/cases/case-42"), ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json(detail);
      })
    );

    await expect(getCase("case-42")).resolves.toEqual(detail);
    expect(authorization).toBe("Bearer token-1");
  });

  it("returns null when no case has that id", async () => {
    server.use(http.get(apiUrl("/api/cases/case-42"), () => new HttpResponse(null, { status: 404 })));

    await expect(getCase("case-42")).resolves.toBeNull();
  });

  it.each([
    [401, SessionEndedError],
    [403, AccessDeniedError]
  ])("turns %i into its error", async (status, errorType) => {
    server.use(http.get(apiUrl("/api/cases/case-42"), () => new HttpResponse(null, { status })));

    await expect(getCase("case-42")).rejects.toBeInstanceOf(errorType);
  });

  it("throws on a server error", async () => {
    server.use(http.get(apiUrl("/api/cases/case-42"), () => new HttpResponse(null, { status: 500 })));

    await expect(getCase("case-42")).rejects.toThrow("Failed to load the case.");
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

describe("triageCase", () => {
  it("posts the priority and notes with the token", async () => {
    saveAccessToken("token-1");
    let sent: { body: unknown; authorization: string | null; contentType: string | null } | null = null;
    server.use(
      http.post(apiUrl("/api/cases/case-42/triage"), async ({ request }) => {
        sent = {
          body: await request.json(),
          authorization: request.headers.get("Authorization"),
          contentType: request.headers.get("Content-Type")
        };
        return new HttpResponse(null, { status: 204 });
      })
    );

    await triageCase("case-42", { priority: "critical", notes: "Laboured breathing" });

    expect(sent).toEqual({
      body: { priority: "critical", notes: "Laboured breathing" },
      authorization: "Bearer token-1",
      contentType: "application/json"
    });
  });

  it("brings back the first message for each refused field", async () => {
    server.use(
      http.post(apiUrl("/api/cases/case-42/triage"), () =>
        HttpResponse.json({ status: 400, errors: { Notes: ["Too long."] } }, { status: 400 }))
    );

    const error = await triageCase("case-42", { priority: "urgent", notes: null }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FormRejectedError);
    expect((error as FormRejectedError).fieldErrors).toEqual({ Notes: "Too long." });
  });

  it.each([
    [404, "notFound"],
    [409, "discharged"]
  ] as const)("turns %i into CaseGoneError (%s)", async (status, reason) => {
    server.use(http.post(apiUrl("/api/cases/case-42/triage"), () => new HttpResponse(null, { status })));

    const error = await triageCase("case-42", { priority: "urgent", notes: null }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CaseGoneError);
    expect((error as CaseGoneError).reason).toBe(reason);
  });

  it.each([
    [401, SessionEndedError],
    [403, AccessDeniedError]
  ])("turns %i into its error", async (status, errorType) => {
    server.use(http.post(apiUrl("/api/cases/case-42/triage"), () => new HttpResponse(null, { status })));

    await expect(triageCase("case-42", { priority: "urgent", notes: null })).rejects.toBeInstanceOf(errorType);
  });

  it("fails plainly on a server error", async () => {
    server.use(http.post(apiUrl("/api/cases/case-42/triage"), () => new HttpResponse(null, { status: 500 })));

    await expect(triageCase("case-42", { priority: "urgent", notes: null })).rejects.toThrow("Failed to save triage.");
  });
});

describe("completeTask and reopenTask", () => {
  it.each([
    ["complete", completeTask],
    ["reopen", reopenTask]
  ] as const)("posts %s for the task with the session's token", async (action, call) => {
    saveAccessToken("token-1");
    let seen: { method: string; authorization: string | null } | null = null;
    server.use(
      http.post(apiUrl(`/api/cases/case-42/tasks/task-7/${action}`), ({ request }) => {
        seen = { method: request.method, authorization: request.headers.get("Authorization") };
        return new HttpResponse(null, { status: 204 });
      })
    );

    await call("case-42", "task-7");

    expect(seen).toEqual({ method: "POST", authorization: "Bearer token-1" });
  });

  it("throws SessionEndedError on 401", async () => {
    server.use(http.post(apiUrl("/api/cases/case-42/tasks/task-7/complete"), () => new HttpResponse(null, { status: 401 })));

    await expect(completeTask("case-42", "task-7")).rejects.toBeInstanceOf(SessionEndedError);
  });

  it.each([404, 409, 500])("throws when the API answers %i", async (status) => {
    server.use(http.post(apiUrl("/api/cases/case-42/tasks/task-7/reopen"), () => new HttpResponse(null, { status })));

    await expect(reopenTask("case-42", "task-7")).rejects.toThrow("Failed to update the task.");
  });
});

describe("createTask", () => {
  const route = apiUrl("/api/cases/case-42/tasks");
  const request = { type: "blocker", description: "Awaiting owner consent", assignedToStaffId: "staff-3" } as const;

  it("posts the task with the token", async () => {
    saveAccessToken("token-1");
    let sent: { body: unknown; authorization: string | null; contentType: string | null } | null = null;
    server.use(
      http.post(route, async ({ request: posted }) => {
        sent = {
          body: await posted.json(),
          authorization: posted.headers.get("Authorization"),
          contentType: posted.headers.get("Content-Type")
        };
        return HttpResponse.json({ id: "task-9" }, { status: 201 });
      })
    );

    await createTask("case-42", request);
    expect(sent).toEqual({ body: request, authorization: "Bearer token-1", contentType: "application/json" });
  });

  it("brings back the first message for each refused field", async () => {
    server.use(
      http.post(route, () =>
        HttpResponse.json({ status: 400, errors: { Description: ["Too long.", "Other."] } }, { status: 400 }))
    );

    const error = await createTask("case-42", request).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FormRejectedError);
    expect((error as FormRejectedError).fieldErrors).toEqual({ Description: "Too long." });
  });

  it.each([
    [404, "notFound"],
    [409, "discharged"]
  ] as const)("turns %i into CaseGoneError (%s)", async (status, reason) => {
    server.use(http.post(route, () => new HttpResponse(null, { status })));

    const error = await createTask("case-42", request).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CaseGoneError);
    expect((error as CaseGoneError).reason).toBe(reason);
  });

  it.each([
    [401, SessionEndedError],
    [403, AccessDeniedError]
  ])("turns %i into its error", async (status, errorType) => {
    server.use(http.post(route, () => new HttpResponse(null, { status })));

    await expect(createTask("case-42", request)).rejects.toBeInstanceOf(errorType);
  });

  it("fails plainly on a server error", async () => {
    server.use(http.post(route, () => new HttpResponse(null, { status: 500 })));

    await expect(createTask("case-42", request)).rejects.toThrow("Failed to add the task.");
  });
});
