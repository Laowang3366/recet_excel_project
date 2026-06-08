import { describe, expect, it } from "vitest";
import { resolveSafeNotificationAction } from "./notification-link";

describe("resolveSafeNotificationAction", () => {
  const origin = "https://www.excelcc.cn";

  it("keeps local app paths and same-origin absolute links", () => {
    expect(resolveSafeNotificationAction("/tools?tab=formula#top", origin)).toEqual({
      kind: "internal",
      path: "/tools?tab=formula#top",
    });

    expect(resolveSafeNotificationAction("https://www.excelcc.cn/templates?mine=1", origin)).toEqual({
      kind: "internal",
      path: "/templates?mine=1",
    });
  });

  it("rejects external, protocol-relative, script, and malformed targets", () => {
    const unsafeTargets = [
      "https://evil.example/phish",
      "http://www.excelcc.cn/tools",
      "//evil.example/phish",
      "javascript:alert(1)",
      "/tools\nhttps://evil.example",
      "\\\\evil.example\\share",
      "",
    ];

    unsafeTargets.forEach((target) => {
      expect(resolveSafeNotificationAction(target, origin)).toBeNull();
    });
  });
});
