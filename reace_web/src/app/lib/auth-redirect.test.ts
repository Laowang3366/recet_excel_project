import { describe, expect, it } from "vitest";
import {
  buildAuthRedirectPath,
  normalizeAuthRedirectTarget,
  resolveAuthRedirect,
} from "./auth-redirect";

describe("auth redirect helpers", () => {
  it("keeps the current functional page as the post-login target", () => {
    expect(buildAuthRedirectPath("/practice/question/121?from=list#editor")).toBe(
      "/auth?redirect=%2Fpractice%2Fquestion%2F121%3Ffrom%3Dlist%23editor",
    );
  });

  it("rejects unsafe or recursive redirect targets", () => {
    expect(normalizeAuthRedirectTarget("https://evil.example/path")).toBe("/");
    expect(normalizeAuthRedirectTarget("//evil.example/path")).toBe("/");
    expect(normalizeAuthRedirectTarget("javascript:alert(1)")).toBe("/");
    expect(normalizeAuthRedirectTarget("/auth?redirect=%2Fpractice")).toBe("/");
  });

  it("resolves the login query redirect with a safe homepage fallback", () => {
    expect(resolveAuthRedirect("?redirect=%2Fpractice%2Fquestion%2F121")).toBe(
      "/practice/question/121",
    );
    expect(resolveAuthRedirect("?redirect=https%3A%2F%2Fevil.example")).toBe("/");
  });
});
