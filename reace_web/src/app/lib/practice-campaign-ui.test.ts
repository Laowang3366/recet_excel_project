import { describe, expect, it } from "vitest";
import {
  canExpandChapterQuestions,
  getCampaignQuestionListPath,
  getCampaignLevelStatusLabel,
  getChapterQuestionToggleLabel,
  getCampaignProgressSessionKey,
  campaignChapterMatchesSearch,
  filterCampaignLevelsBySearch,
  getCampaignLevelStatsSummary,
  getPracticeDetailEditorKey,
} from "./practice-campaign-ui";

describe("practice campaign UI helpers", () => {
  it("labels the collapsed and expanded chapter question list action", () => {
    expect(getChapterQuestionToggleLabel({ isExpanded: false, isUnlocked: true })).toBe("题目列表");
    expect(getChapterQuestionToggleLabel({ isExpanded: true, isUnlocked: true })).toBe("收起题目");
  });

  it("does not expose the question list action for locked chapters", () => {
    expect(canExpandChapterQuestions({ unlocked: false })).toBe(false);
    expect(getChapterQuestionToggleLabel({ isExpanded: false, isUnlocked: false })).toBe("等待解锁");
  });

  it("normalizes campaign level status labels", () => {
    expect(getCampaignLevelStatusLabel("locked")).toBe("未解锁");
    expect(getCampaignLevelStatusLabel("perfect")).toBe("满星");
    expect(getCampaignLevelStatusLabel("cleared")).toBe("已通关");
    expect(getCampaignLevelStatusLabel("ready")).toBe("可挑战");
  });

  it("separates campaign progress query cache by current session", () => {
    expect(getCampaignProgressSessionKey(null, null)).toBe("guest");
    expect(getCampaignProgressSessionKey(null, "token")).toBe("auth-pending");
    expect(getCampaignProgressSessionKey({ id: 1 }, "token")).toBe("user:1");
  });

  it("matches practice chapters and levels with a normalized search term", () => {
    expect(campaignChapterMatchesSearch({ name: "函数基础", description: "SUM 入门" }, "sum")).toBe(true);
    expect(campaignChapterMatchesSearch({ name: "逻辑判断", description: "IF" }, "sum")).toBe(false);

    expect(filterCampaignLevelsBySearch([
      { title: "季度销售合计：SUM 汇总门店销售额" },
      { title: "字段完整度：COUNTA-COUNTBLANK" },
    ], "sum")).toHaveLength(1);
  });

  it("routes campaign returns to the question list instead of the map page", () => {
    expect(getCampaignQuestionListPath()).toBe("/practice");
    expect(getCampaignQuestionListPath(8)).toBe("/practice?chapter=8");
    expect(getCampaignQuestionListPath("chapter 1")).toBe("/practice?chapter=chapter%201");
  });

  it("formats campaign level participation stats for the question list", () => {
    expect(getCampaignLevelStatsSummary({ participantCount: 3, passedCount: 2, passRate: 66.7 })).toEqual({
      participants: "3",
      passed: "2",
      passRate: "66.7%",
    });
    expect(getCampaignLevelStatsSummary({ participantCount: null, passedCount: undefined, passRate: null })).toEqual({
      participants: "0",
      passed: "0",
      passRate: "0%",
    });
  });

  it("keeps the workbook editor mounted while answers change", () => {
    expect(getPracticeDetailEditorKey(18)).toBe("practice-question-18");
    expect(getPracticeDetailEditorKey("random")).toBe("practice-question-random");
    expect(getPracticeDetailEditorKey(null)).toBe("practice-question-unknown");
  });
});
