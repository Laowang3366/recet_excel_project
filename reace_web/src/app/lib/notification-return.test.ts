import { describe, expect, it } from "vitest";
import { buildNotificationReturnPath, resolveNotificationReturnTarget } from "./notification-return";

describe("notification return navigation", () => {
  it("keeps a stable origin when entering notification pages", () => {
    expect(buildNotificationReturnPath("/practice/question/121?from=list#editor")).toBe(
      "/notifications?returnTo=%2Fpractice%2Fquestion%2F121%3Ffrom%3Dlist%23editor",
    );
  });

  it("does not use notification pages as the final return target", () => {
    expect(resolveNotificationReturnTarget("?returnTo=%2Fpractice", "/notifications")).toBe("/practice");
    expect(resolveNotificationReturnTarget("?returnTo=%2Fnotification%2F3", "/")).toBe("/");
    expect(resolveNotificationReturnTarget("?returnTo=https%3A%2F%2Fevil.test", "/practice")).toBe("/practice");
  });
});
