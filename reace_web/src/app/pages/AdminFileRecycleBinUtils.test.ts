import { describe, expect, it } from "vitest";
import {
  buildRecycleRiskSummary,
  buildRecycleStats,
  getRecycleFileName,
  getRecycleRetentionDays,
  getRecycleStatus,
  getRecycleSourceLabel,
  type FileRecycleItemView,
} from "./AdminFileRecycleBinUtils";

const now = new Date("2026-05-27T12:00:00+08:00");

const records: FileRecycleItemView[] = [
  {
    id: 1,
    resourceType: "question",
    resourceId: 10,
    displayName: "旧题目",
    originalFileUrl: "/uploads/private/practice_filter.xlsx",
    fileCount: 2,
    deletedBy: 1,
    deletedAt: "2026-05-27T09:30:00",
    expiresAt: "2026-06-08T09:30:00",
    expired: false,
  },
  {
    id: 2,
    resourceType: "template",
    resourceId: 11,
    displayName: "模板中心记录",
    originalFileUrl: "/uploads/private/templates/old_template.xlsx",
    fileCount: 1,
    deletedBy: 3,
    deletedAt: "2026-05-25T10:20:00",
    expiresAt: "2026-05-28T10:20:00",
    expired: false,
  },
  {
    id: 3,
    resourceType: "qa_answer",
    resourceId: 12,
    displayName: "答疑附件",
    originalFileUrl: "/uploads/private/qa/answer.png",
    fileCount: 1,
    deletedBy: 8,
    deletedAt: "2026-05-20T10:20:00",
    expiresAt: "2026-05-26T10:20:00",
    expired: true,
  },
];

describe("AdminFileRecycleBinUtils", () => {
  it("derives file names and source labels from existing API fields", () => {
    expect(getRecycleFileName(records[0])).toBe("practice_filter.xlsx");
    expect(getRecycleFileName({ ...records[0], originalFileUrl: "" })).toBe("旧题目");
    expect(getRecycleSourceLabel("question")).toBe("题库模板");
    expect(getRecycleSourceLabel("template")).toBe("模板中心");
    expect(getRecycleSourceLabel("qa_answer")).toBe("答疑附件");
  });

  it("marks files that are recoverable, expiring soon, or expired", () => {
    expect(getRecycleRetentionDays(records[0], now)).toBe(12);
    expect(getRecycleStatus(records[0], now)).toEqual({ label: "可恢复", tone: "success" });
    expect(getRecycleRetentionDays(records[1], now)).toBe(1);
    expect(getRecycleStatus(records[1], now)).toEqual({ label: "即将过期", tone: "warning" });
    expect(getRecycleStatus(records[2], now)).toEqual({ label: "已过期", tone: "danger" });
  });

  it("builds dashboard and selected-risk summaries without inventing unavailable file sizes", () => {
    expect(buildRecycleStats(records, 38, now)).toEqual({
      totalRecords: 38,
      currentPageRecords: 3,
      recoverableRecords: 2,
      expiringSoonRecords: 1,
      todayDeletedRecords: 1,
      expiredRecords: 1,
      totalFileCount: 4,
      totalSizeBytes: 0,
      totalSizeLabel: "未提供",
      hasUnknownSize: true,
      sourceModules: ["题库模板", "模板中心", "答疑附件"],
      expiredFileCount: 1,
      expiredSizeBytes: 0,
      expiredSizeLabel: "未提供",
      hasUnknownExpiredSize: true,
      expiredSourceModules: ["答疑附件"],
      expiredSourceModuleCounts: [{ label: "答疑附件", count: 1 }],
    });

    expect(buildRecycleRiskSummary(records)).toEqual({
      fileCount: 4,
      releaseSizeLabel: "未提供",
      sourceLabels: ["题库模板", "模板中心", "答疑附件"],
    });
  });
});
