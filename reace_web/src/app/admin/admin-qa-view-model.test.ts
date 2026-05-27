import { describe, expect, it } from "vitest";
import {
  buildAdminQaRows,
  buildAdminQaStatCards,
  getAdminQaMissingCapabilities,
  getAdminQaStatusLabel,
} from "./admin-qa-view-model";

describe("admin qa view model", () => {
  const cases = [
    { id: 1, title: "多条件统计公式错误", status: "open", answerCount: 0, author: { username: "user_21" }, createTime: "2025-05-20T10:15:00" },
    { id: 2, title: "透视表刷新失败", status: "answered", answerCount: 1, author: { username: "user_82" }, createTime: "2025-05-19T09:00:00" },
    { id: 3, title: "图表数据源不更新", status: "accepted", answerCount: 2, author: { username: "user_56" }, createTime: "2025-05-14T09:00:00" },
  ];
  const answers = [
    { id: 11, caseId: 1, status: "active", author: { username: "helper_01" }, createTime: "2025-05-20T11:15:00" },
  ];
  const shares = [
    { id: 21, title: "COUNTIFS 区间写法", status: "published", viewCount: 58, author: { username: "mentor" }, createTime: "2025-05-18T11:15:00" },
  ];
  const feedback = [
    { id: 31, caseId: 1, reason: "unclear_requirement", detail: "需要补充样例", author: { username: "helper_02" }, createTime: "2025-05-17T11:15:00" },
  ];

  it("builds the four design stat cards from existing admin qa data", () => {
    expect(buildAdminQaStatCards({ cases: 42, pendingCases: 4, answers: 126, solutionShares: 58, feedback: 17 })).toEqual([
      { key: "cases", label: "案例求助", value: 42, hintLabel: "待处理", hintValue: 4, tone: "green" },
      { key: "answers", label: "答疑提交", value: 126, hintLabel: "待审核", hintValue: 0, tone: "orange" },
      { key: "shares", label: "解题分享", value: 58, hintLabel: "精选", hintValue: 0, tone: "blue" },
      { key: "feedback", label: "反馈", value: 17, hintLabel: "未读", hintValue: 0, tone: "red" },
    ]);
  });

  it("normalizes qa records into the table rows used by the redesigned tabs", () => {
    expect(buildAdminQaRows({ tab: "cases", cases, answers, shares, feedback, keyword: "统计", status: "all" })).toEqual([
      {
        id: 1,
        source: "case",
        title: "多条件统计公式错误",
        user: "user_21",
        typeLabel: "函数问题",
        statusLabel: "待处理",
        statusTone: "warning",
        submittedAt: "2025-05-20T10:15:00",
        actionMode: "assign",
        original: cases[0],
      },
    ]);
  });

  it("maps existing statuses to the labels in the design draft", () => {
    expect(getAdminQaStatusLabel("case", "answered")).toBe("已回复");
    expect(getAdminQaStatusLabel("answer", "active")).toBe("待审核");
    expect(getAdminQaStatusLabel("share", "published")).toBe("已沉淀");
    expect(getAdminQaStatusLabel("feedback", "unclear_requirement")).toBe("需求描述不清");
  });

  it("reports no missing workflow capabilities after backend wiring", () => {
    expect(getAdminQaMissingCapabilities()).toEqual([]);
  });
});
