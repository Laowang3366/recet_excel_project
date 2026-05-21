import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_REMEMBER_KEY, getRememberedAuth, storeRememberedAuth } from "./session-store";

function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
  };
}

describe("remembered auth storage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createMemoryStorage(),
        sessionStorage: createMemoryStorage(),
        dispatchEvent: vi.fn(),
      },
      configurable: true,
    });
  });

  it("drops legacy plaintext password while keeping the login identifier", () => {
    window.localStorage.setItem(AUTH_REMEMBER_KEY, JSON.stringify({
      username: "tester",
      password: "PlainText123!",
    }));

    expect(getRememberedAuth()).toEqual({ username: "tester" });
    expect(window.localStorage.getItem(AUTH_REMEMBER_KEY)).toBe(JSON.stringify({ username: "tester" }));
  });

  it("stores only the login identifier", () => {
    storeRememberedAuth({ username: "user@example.com" });

    expect(window.localStorage.getItem(AUTH_REMEMBER_KEY)).toBe(JSON.stringify({ username: "user@example.com" }));
  });
});
