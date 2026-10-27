import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { apiUrl, server } from "../test/server";
import { SessionEndedError } from "./apiErrors";
import { getMyPets } from "./petParentApi";
import { saveAccessToken } from "./session";

afterEach(() => {
  sessionStorage.clear();
});

describe("getMyPets", () => {
  it("sends the token and returns the pets", async () => {
    saveAccessToken("token-1");
    let authorization: string | null = null;
    server.use(
      http.get(apiUrl("/api/pet-parent/pets"), ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json([{ name: "Buddy", species: "Dog", inCare: true }]);
      })
    );

    const pets = await getMyPets();

    expect(authorization).toBe("Bearer token-1");
    expect(pets).toEqual([{ name: "Buddy", species: "Dog", inCare: true }]);
  });

  it("throws SessionEndedError on 401", async () => {
    server.use(http.get(apiUrl("/api/pet-parent/pets"), () => new HttpResponse(null, { status: 401 })));

    await expect(getMyPets()).rejects.toBeInstanceOf(SessionEndedError);
  });

  it("throws on other failures", async () => {
    server.use(http.get(apiUrl("/api/pet-parent/pets"), () => new HttpResponse(null, { status: 500 })));

    await expect(getMyPets()).rejects.toThrow("Failed to load your pets.");
  });
});
