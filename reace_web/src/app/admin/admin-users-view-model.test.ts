import { describe, expect, it } from "vitest";
import {
  buildRegistrationTrend,
  buildUserComposition,
  buildUserSummary,
  buildUsersCsv,
  maskAdminPhone,
  sanitizeCsvCell,
} from "./admin-users-view-model";

describe("admin users view model", () => {
  const records = [
    { id: 1, username: "admin", role: "admin", status: 0, level: 5, points: 100, createTime: "2026-05-26T08:00:00" },
    { id: 2, username: "normal", role: "user", status: 0, level: 1, points: 20, createTime: "2026-05-25T08:00:00" },
    { id: 3, username: "locked", role: "user", status: 1, isMuted: true, level: 3, points: 50, createTime: "2026-05-24T08:00:00" },
  ];

  it("builds summary numbers from the current user page", () => {
    expect(buildUserSummary(records, 128560, new Date("2026-05-26T12:00:00"))).toEqual({
      totalUsers: 128560,
      todayNew: 1,
      activeUsers: 2,
      frozenUsers: 1,
    });
  });

  it("groups users into membership composition segments", () => {
    expect(buildUserComposition(records).map((item) => item.label)).toEqual(["管理员", "普通会员", "黄金会员"]);
  });

  it("creates a seven day registration trend", () => {
    const trend = buildRegistrationTrend(records, 3, new Date("2026-05-26T12:00:00"));
    expect(trend).toEqual([
      { date: "2026-05-24", label: "05-24", count: 1 },
      { date: "2026-05-25", label: "05-25", count: 1 },
      { date: "2026-05-26", label: "05-26", count: 1 },
    ]);
  });

  it("masks phones and prevents formula injection in csv exports", () => {
    expect(maskAdminPhone("13812345678")).toBe("138****5678");
    expect(sanitizeCsvCell("=cmd|' /C calc'!A0")).toBe("\"'=cmd|' /C calc'!A0\"");
    expect(buildUsersCsv([{ id: 9, username: "+evil", email: "user@example.com" }])).toContain("\"'+evil\"");
  });
});
