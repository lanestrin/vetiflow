import { HubConnectionState } from "@microsoft/signalr";
import { describe, expect, it } from "vitest";
import { createCaseHubConnection } from "./caseHub";

describe("createCaseHubConnection", () => {
  it("points at the API's case hub without connecting yet", () => {
    const connection = createCaseHubConnection();

    expect(connection.baseUrl).toBe(
      `${import.meta.env.VITE_API_BASE_URL}/hubs/cases`
    );
    expect(connection.state).toBe(HubConnectionState.Disconnected);
  });
});
