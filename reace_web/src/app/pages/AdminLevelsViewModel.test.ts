import { describe, expect, it } from "vitest";
import {
  buildLevelDashboard,
  getLevelBadgeTone,
  getLevelProgressPercent,
} from "./AdminLevelsViewModel";
import type { LevelRuleRecord, LevelUserRecord, LevelsOverviewResponse } from "./AdminConsoleTypes";

describe("admin levels view model", () => {
  it("derives level dashboard metrics and chart distribution", () => {
    const levelRules: LevelRuleRecord[] = [
      { level: 1, name: "入门学员", threshold: 0, enabled: true },
      { level: 2, name: "进阶学员", threshold: 100, enabled: true },
      { level: 3, name: "熟练学员", threshold: 500, enabled: false },
    ];
    const overview: LevelsOverviewResponse = {
      stats: { userCount: 3000, highestLevelUsers: 95 },
      levelRules,
      expRules: [
        { key: "daily_checkin", label: "每日签到", minExp: 5, maxExp: 5, enabled: true },
        { key: "practice_complete", label: "完成练习", minExp: 10, maxExp: 20, enabled: false },
      ],
      distribution: [
        { level: 1, name: "入门学员", threshold: 0, userCount: 1280 },
        { level: 2, name: "进阶学员", threshold: 100, userCount: 2140 },
      ],
    };

    expect(buildLevelDashboard(overview)).toEqual({
      levelRuleCount: 3,
      enabledLevelRuleCount: 2,
      expRuleCount: 2,
      enabledExpRuleCount: 1,
      pendingReviewCount: 0,
      logCount: 0,
      highestLevelUsers: 95,
      distribution: overview.distribution,
    });
  });

  it("caps progress percentages and maps badge tones by level", () => {
    const user: LevelUserRecord = {
      id: 1,
      username: "aquan76504",
      level: 6,
      exp: 6240,
      progress: { current: 6240, nextThreshold: 6240 },
    };

    expect(getLevelProgressPercent(user)).toBe(100);
    expect(getLevelProgressPercent({ ...user, progress: { current: 320, nextThreshold: 500 } })).toBe(64);
    expect(getLevelBadgeTone(1)).toBe("blue");
    expect(getLevelBadgeTone(5)).toBe("purple");
    expect(getLevelBadgeTone(6)).toBe("amber");
  });
});
