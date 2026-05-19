import { describe, expect, it } from "vitest";
import { formatTimeoutMs, timeoutMinutesToMs, timeoutMsToMinutes } from "./AdminAssistant";

describe("admin assistant timeout helpers", () => {
  it("uses minutes as the admin-facing unit", () => {
    expect(timeoutMsToMinutes(60_000)).toBe(1);
    expect(timeoutMsToMinutes(3_600_000)).toBe(60);
    expect(formatTimeoutMs(3_600_000)).toBe("60 分钟");
  });

  it("clamps submitted minutes to one hour", () => {
    expect(timeoutMinutesToMs(60)).toBe(3_600_000);
    expect(timeoutMinutesToMs(61)).toBe(3_600_000);
    expect(timeoutMinutesToMs(0)).toBe(60_000);
  });
});
