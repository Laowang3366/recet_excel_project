import { describe, expect, it } from "vitest";
import {
  QUESTION_BANK_SERVICE_ENDPOINTS,
  QUESTION_BANK_TABS,
  QUESTION_EDITOR_STEPS,
  buildQuestionBankStats,
  getQuestionStatusMeta,
} from "./question-bank-view-model";

describe("question bank view model", () => {
  it("keeps the redesigned question-bank tabs and editor steps in design order", () => {
    expect(QUESTION_BANK_TABS.map((item) => item.label)).toEqual([
      "题目列表",
      "闯关关卡",
      "模板快照检查",
      "异常题目",
    ]);
    expect(QUESTION_EDITOR_STEPS.map((item) => item.label)).toEqual([
      "基本信息",
      "上传模板",
      "答题区域",
      "判题规则",
      "预览发布",
    ]);
  });

  it("derives stat cards from existing question and campaign data", () => {
    const stats = buildQuestionBankStats({
      totalQuestions: 117,
      records: [
        { enabled: true, gradingMode: "dynamic_array" },
        { enabled: false, gradingRuleJson: "{\"dynamicArrayRules\":[{\"sheet\":\"Sheet1\"}]}" },
        { enabled: true },
      ],
      campaignLevelCount: 42,
      categoryCount: 13,
    });

    expect(stats.map((item) => [item.label, item.value, item.hint])).toEqual([
      ["题目总数", "117", "启用 2"],
      ["动态数组题", "2", "需重点验证"],
      ["闯关关卡", "42", "草稿 1"],
      ["待审核投稿", "0", "最长 18h"],
    ]);
  });

  it("normalizes question status labels for the compact table", () => {
    expect(getQuestionStatusMeta(true).label).toBe("启用");
    expect(getQuestionStatusMeta(false).label).toBe("停用");
    expect(getQuestionStatusMeta("draft").label).toBe("草稿");
    expect(getQuestionStatusMeta("pending").label).toBe("待验证");
  });

  it("keeps the server-backed question-bank endpoints explicit", () => {
    expect(QUESTION_BANK_SERVICE_ENDPOINTS.batchImport).toBe("/api/admin/questions/batch-import");
    expect(QUESTION_BANK_SERVICE_ENDPOINTS.templateSnapshotChecks).toBe("/api/admin/questions/template-snapshot-checks");
    expect(QUESTION_BANK_SERVICE_ENDPOINTS.exceptions).toBe("/api/admin/questions/exceptions");
    expect(QUESTION_BANK_SERVICE_ENDPOINTS.publishTests).toBe("/api/admin/questions/publish-tests");
    expect(QUESTION_BANK_SERVICE_ENDPOINTS.publishTest(18)).toBe("/api/admin/questions/18/publish-test");
  });
});
