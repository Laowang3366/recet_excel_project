import { describe, expect, it } from "vitest";
import {
  QUESTION_CATEGORY_UNSUPPORTED_DESIGN_FIELDS,
  buildQuestionCategoryStats,
  buildSortableCategoryRows,
  moveSortableCategoryRow,
  normalizeQuestionCategoryCards,
} from "./question-categories-view-model";

const records = [
  { id: 2, name: "查找引用", description: "VLOOKUP / XLOOKUP / INDEX", groupName: "", sortOrder: 20, enabled: true, questionCount: 16 },
  { id: 1, name: "函数基础", description: "基础函数入门", groupName: "", sortOrder: 10, enabled: true, questionCount: 18 },
  { id: 7, name: "动态数组", description: "FILTER / SORT / UNIQUE", groupName: "", sortOrder: 70, enabled: false, questionCount: 13 },
  { id: 4, name: "文本处理", description: "字符串函数", groupName: "", sortOrder: 30, enabled: true, questionCount: 12 },
];

describe("question category view model", () => {
  it("builds dashboard stats from existing category records", () => {
    expect(buildQuestionCategoryStats(records)).toEqual({
      categoryCount: 4,
      questionCount: 59,
      draftCount: 1,
      anomalyCount: 0,
    });
  });

  it("counts empty names and duplicate sort orders as anomalies", () => {
    expect(buildQuestionCategoryStats([
      ...records,
      { id: 8, name: " ", sortOrder: 20, enabled: true, questionCount: 0 },
    ])).toMatchObject({
      categoryCount: 5,
      anomalyCount: 2,
    });
  });

  it("normalizes cards into the frontend chapter order", () => {
    expect(normalizeQuestionCategoryCards(records).map((item) => `${item.name}:${item.statusLabel}:${item.sortOrder}`)).toEqual([
      "函数基础:启用:10",
      "查找引用:启用:20",
      "文本处理:启用:30",
      "动态数组:需测试:70",
    ]);
  });

  it("renumbers sortable rows after a drag reorder", () => {
    const rows = buildSortableCategoryRows(records);
    const moved = moveSortableCategoryRow(rows, 2, 1);

    expect(moved.map((item) => `${item.name}:${item.sortOrder}`)).toEqual([
      "函数基础:10",
      "文本处理:20",
      "查找引用:30",
      "动态数组:40",
    ]);
  });

  it("documents design-only fields that cannot be persisted by the current API", () => {
    expect(QUESTION_CATEGORY_UNSUPPORTED_DESIGN_FIELDS).toEqual([
      "frontDisplayName",
      "iconKey",
      "recommendedDifficulty",
    ]);
  });
});
