import { describe, expect, it } from "vitest";
import {
  formatFormulaExplanationForCopy,
  validateFormulaInput,
  type FormulaExplainResponse,
} from "./formula-explainer";

describe("formula explainer helpers", () => {
  it("accepts a normal formula", () => {
    expect(validateFormulaInput("=SUM(A1:A10)")).toEqual({ ok: true });
  });

  it("rejects empty input", () => {
    expect(validateFormulaInput("   ")).toEqual({ ok: false, message: "请输入需要解释的 Excel 公式" });
  });

  it("rejects unbalanced parentheses", () => {
    expect(validateFormulaInput("=IF(A1>0,SUM(B:B)")).toEqual({ ok: false, message: "公式括号不完整，请检查后再解释" });
  });

  it("rejects workbook context that is too long", () => {
    expect(validateFormulaInput("=SUM(A1:A10)", { workbookContext: "A".repeat(4001) })).toEqual({
      ok: false,
      message: "表格上下文不能超过 4000 个字符",
    });
  });

  it("ignores parentheses inside string literals", () => {
    expect(validateFormulaInput("=IF(A1=\"SUM(\",1,0)")).toEqual({ ok: true });
  });

  it("formats structured response for copying", () => {
    const response: FormulaExplainResponse = {
      formula: "=SUM(A1:A10)",
      normalizedFormula: "SUM(A1:A10)",
      summary: "这条公式对 A1 到 A10 求和。",
      segments: [{ text: "SUM(A1:A10)", title: "求和", explanation: "统计区域内数字总和。" }],
      functions: [{ name: "SUM", purpose: "求和" }],
      warnings: ["区域内文本会被忽略。"],
      suggestions: ["确认区域范围正确。"],
      analysis: {
        functions: ["SUM"],
        parenthesesDepth: 1,
        nestingDepth: 1,
        structuredReference: false,
        dynamicArrayFunction: false,
        riskFlags: ["忽略文本"],
      },
      fixes: ["如果需要统计文本中的数字，请先转换为数值。"],
      cacheHit: true,
      pointsCost: 1,
      currentPoints: 99,
      model: "gpt-test",
      recordId: 123,
      createTime: "2026-05-24T10:00:00",
    };

    const copyText = formatFormulaExplanationForCopy(response);
    expect(copyText).toContain("整体解释：这条公式对 A1 到 A10 求和。");
    expect(copyText).toContain("1. 求和");
    expect(copyText).toContain("SUM：求和");
    expect(copyText).toContain("公式分析：\n函数：SUM");
    expect(copyText).toContain("风险标记：忽略文本");
    expect(copyText).toContain("修复建议：\n- 如果需要统计文本中的数字，请先转换为数值。");
    expect(copyText).toContain("模型信息：gpt-test / 缓存命中 / 消耗 1 积分 / 当前 99 积分");
  });
});
