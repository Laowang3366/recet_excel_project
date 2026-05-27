import { describe, expect, it } from "vitest";
import {
  buildPointsDashboard,
  formatSignedPoints,
  getPointsRuleStatus,
} from "./AdminPointsViewModel";
import type { PointsRecord, PointsRuleRecord, PointsStatsResponse } from "./AdminConsoleTypes";

describe("admin points view model", () => {
  it("derives dashboard card values from rules, stats, and visible records", () => {
    const rules: PointsRuleRecord[] = [
      { id: 1, name: "每日签到", description: "", taskKey: "daily_checkin", points: 5, type: "daily", dailyLimit: 1, enabled: true, userVisible: true, sortOrder: 10 },
      { id: 2, name: "兑换模板", description: "", taskKey: "redeem_template", points: -20, type: "system", dailyLimit: 0, enabled: true, userVisible: true, sortOrder: 20 },
      { id: 3, name: "提交反馈", description: "", taskKey: "submit_feedback", points: 5, type: "once", dailyLimit: 1, enabled: false, userVisible: true, sortOrder: 30 },
    ];
    const stats: PointsStatsResponse = {
      activeUsers: 128,
      totalPoints: 9000,
      todayPoints: 12340,
      todayIssued: 12340,
      todayConsumed: 4800,
      anomalyRecords: 2,
    };
    const records: PointsRecord[] = [
      { id: 1, username: "aquan76504", change: 50, reason: "手动补发签到积分" },
      { id: 2, username: "excel_user_82", change: -20, reason: "模板兑换" },
      { id: 3, username: "sheet_king", points: -15, reason: "道具兑换" },
    ];

    expect(buildPointsDashboard({ rules, stats, records })).toEqual({
      ruleCount: 3,
      enabledRuleCount: 2,
      activeUsers: 128,
      todayIssued: 12340,
      visibleConsumption: 4800,
      abnormalRecords: 2,
    });
  });

  it("normalizes signed points and rule status labels for table rendering", () => {
    expect(formatSignedPoints(10)).toBe("+10");
    expect(formatSignedPoints(-20)).toBe("-20");
    expect(formatSignedPoints(undefined)).toBe("-");

    expect(getPointsRuleStatus({ enabled: true })).toEqual({ label: "启用", tone: "success" });
    expect(getPointsRuleStatus({ enabled: false })).toEqual({ label: "停用", tone: "warning" });
  });
});
