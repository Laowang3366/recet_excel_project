import { describe, expect, it } from "vitest";
import {
  formatFormulaExplanationForCopy,
  buildFormulaFunctionAnnotations,
  buildFormulaLayout,
  buildFormulaOptimizationSuggestions,
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

  it("builds a readable formula layout with custom parameter references", () => {
    const layout = buildFormulaLayout("=LET(src,Sales!A2:D100,filtered,FILTER(src,Sales!D2:D100=\"已成交\"),MAP(filtered,LAMBDA(row,INDEX(row,1))))");

    expect(layout.formattedLines).toContain("LET(");
    expect(layout.blocks.map((item) => item.name)).toEqual(["LET", "FILTER", "MAP", "LAMBDA", "INDEX"]);
    expect(layout.blocks.find((item) => item.name === "LET")?.children).toEqual(["FILTER", "MAP"]);
    expect(layout.blocks.find((item) => item.name === "MAP")?.children).toEqual(["LAMBDA"]);
    expect(layout.parameterHighlights).toEqual(expect.arrayContaining([
      { name: "src", role: "definition", sourceFunction: "LET", lineIndex: 1 },
      { name: "filtered", role: "definition", sourceFunction: "LET", lineIndex: 3 },
      { name: "src", role: "reference", sourceFunction: "LET", lineIndex: 5 },
      { name: "filtered", role: "reference", sourceFunction: "LET", lineIndex: 9 },
      { name: "row", role: "definition", sourceFunction: "LAMBDA", lineIndex: 11 },
      { name: "row", role: "reference", sourceFunction: "LAMBDA", lineIndex: 13 },
    ]));
    expect(layout.signals).toContain("跨表引用");
    expect(layout.signals).toContain("动态数组");
    expect(layout.signals).toContain("自定义函数结构");
  });

  it("adds formula layout and custom parameter references to copied text", () => {
    const response: FormulaExplainResponse = {
      formula: "=LET(src,Sales!A2:D100,FILTER(src,Sales!D2:D100=\"已成交\"))",
      normalizedFormula: "LET(src,Sales!A2:D100,FILTER(src,Sales!D2:D100=\"已成交\"))",
      summary: "筛选已成交销售记录。",
      segments: [],
      functions: [],
      warnings: [],
      suggestions: [],
    };

    const copyText = formatFormulaExplanationForCopy(response);

    expect(copyText).toContain("公式结构：");
    expect(copyText).toContain("LET(");
    expect(copyText).toContain("自定义参数：");
    expect(copyText).toContain("- 定义 LET 参数 src");
    expect(copyText).toContain("- 引用 LET 参数 src");
    expect(copyText).not.toContain("调用注释：");
    expect(copyText).not.toContain("LET 参数 3 调用 FILTER");
    expect(copyText).not.toContain("函数调用关系：");
  });

  it("hides gpt5.5 from copied model metadata", () => {
    const response: FormulaExplainResponse = {
      formula: "=SUM(A1:A10)",
      normalizedFormula: "SUM(A1:A10)",
      summary: "汇总 A1 到 A10。",
      segments: [],
      functions: [],
      warnings: [],
      suggestions: [],
      model: "gpt5.5",
      cacheHit: false,
    };

    const copyText = formatFormulaExplanationForCopy(response);

    expect(copyText).not.toContain("gpt5.5");
    expect(copyText).toContain("模型信息：实时生成");
  });

  it("adds code-comment style function annotations to formatted formulas", () => {
    const response: FormulaExplainResponse = {
      formula: '=LET(src,Sales!A2:D100,filtered,FILTER(src,Sales!D2:D100="已成交"),MAP(filtered,LAMBDA(row,INDEX(row,1))))',
      normalizedFormula: 'LET(src,Sales!A2:D100,filtered,FILTER(src,Sales!D2:D100="已成交"),MAP(filtered,LAMBDA(row,INDEX(row,1))))',
      summary: "筛选已成交销售记录。",
      segments: [],
      functions: [
        { name: "LET", purpose: "定义可复用的中间变量。" },
        { name: "FILTER", purpose: "筛选符合条件的销售记录。" },
        { name: "MAP", purpose: "逐行处理筛选后的结果。" },
        { name: "LAMBDA", purpose: "定义每一行的处理逻辑。" },
        { name: "INDEX", purpose: "取出当前行的第 1 列。" },
      ],
      warnings: [],
      suggestions: [],
    };

    const layout = buildFormulaLayout(response.formula);
    const annotations = buildFormulaFunctionAnnotations(layout, response.functions);
    const copyText = formatFormulaExplanationForCopy(response);

    expect(annotations).toEqual(expect.arrayContaining([
      { lineIndex: 0, name: "LET", comment: "定义可复用的中间变量。" },
      { lineIndex: 4, name: "FILTER", comment: "筛选符合条件的销售记录。" },
      { lineIndex: 8, name: "MAP", comment: "逐行处理筛选后的结果。" },
      { lineIndex: 10, name: "LAMBDA", comment: "定义每一行的处理逻辑。" },
      { lineIndex: 12, name: "INDEX", comment: "取出当前行的第 1 列。" },
    ]));
    expect(copyText).toContain("LET( // LET：定义可复用的中间变量。");
    expect(copyText).toContain("FILTER( // FILTER：筛选符合条件的销售记录。");
    expect(copyText).toContain("INDEX( // INDEX：取出当前行的第 1 列。");
  });

  it("adds formula-specific performance suggestions for dynamic array LET formulas", () => {
    const response: FormulaExplainResponse = {
      formula: "=LET(src,Sales!A2:D100,filtered,FILTER(src,Sales!D2:D100=\"已成交\"),MAP(filtered,LAMBDA(row,INDEX(row,1))))",
      normalizedFormula: "LET(src,Sales!A2:D100,filtered,FILTER(src,Sales!D2:D100=\"已成交\"),MAP(filtered,LAMBDA(row,INDEX(row,1))))",
      summary: "筛选已成交销售记录。",
      segments: [],
      functions: [],
      warnings: [],
      suggestions: [],
    };

    const suggestions = buildFormulaOptimizationSuggestions(response);
    const copyText = formatFormulaExplanationForCopy(response);

    expect(suggestions).toEqual(expect.arrayContaining([
      expect.stringContaining("src"),
      expect.stringContaining("filtered"),
      expect.stringContaining("FILTER、MAP"),
      expect.stringContaining("Sales!A2:D100"),
    ]));
    expect(suggestions.join("\n")).not.toContain("复杂公式建议用 LET 缓存重复计算结果");
    expect(copyText).toContain("优化建议：");
    expect(copyText).toContain("FILTER、MAP");
    expect(copyText).toContain("Sales!A2:D100");
  });

  it("points to exact full-column references instead of using broad performance advice", () => {
    const response: FormulaExplainResponse = {
      formula: "=SUMIFS(Sales!D:D,Sales!A:A,A2)",
      normalizedFormula: "SUMIFS(Sales!D:D,Sales!A:A,A2)",
      summary: "按销售表统计金额。",
      segments: [],
      functions: [],
      warnings: [],
      suggestions: ["性能优化：建议检查公式复杂度。"],
    };

    const suggestions = buildFormulaOptimizationSuggestions(response);

    expect(suggestions).toContain("性能优化：建议检查公式复杂度。");
    expect(suggestions).toEqual(expect.arrayContaining([
      expect.stringContaining("Sales!D:D、Sales!A:A"),
      expect.stringContaining("实际行区间"),
    ]));
  });

  it("names repeated calculated expressions that should be cached", () => {
    const response: FormulaExplainResponse = {
      formula: "=IF(SUM(A:A)>0,SUM(A:A),0)",
      normalizedFormula: "IF(SUM(A:A)>0,SUM(A:A),0)",
      summary: "判断并返回汇总值。",
      segments: [],
      functions: [],
      warnings: [],
      suggestions: [],
    };

    const suggestions = buildFormulaOptimizationSuggestions(response);

    expect(suggestions).toEqual(expect.arrayContaining([
      expect.stringContaining("SUM(A:A)"),
      expect.stringContaining("重复计算 2 次"),
      expect.stringContaining("LET"),
    ]));
  });
});
