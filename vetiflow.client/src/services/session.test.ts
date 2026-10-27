import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken, readAccessToken, saveAccessToken } from "./session";

afterEach(() => {
  sessionStorage.clear();
});

describe("session", () => {
  it("saves, reads and clears the access token", () => {
    saveAccessToken("token-1");
    expect(readAccessToken()).toBe("token-1");

    clearAccessToken();
    expect(readAccessToken()).toBeNull();
  });

  it("has no session when nothing was saved", () => {
    expect(readAccessToken()).toBeNull();
  });

  it("treats blocked storage as no session instead of throwing", () => {
    const blocked = () => {
      throw new DOMException("Storage is blocked", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);

    expect(() => saveAccessToken("token-1")).not.toThrow();
    expect(readAccessToken()).toBeNull();
    expect(() => clearAccessToken()).not.toThrow();
  });
});
