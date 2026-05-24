import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormulaExplainResult } from "./FormulaExplainResult";
import type { FormulaExplainResponse } from "../../lib/formula-explainer";

describe("FormulaExplainResult", () => {
  it("shows custom parameter references as inline formula layout annotations", () => {
    const result: FormulaExplainResponse = {
      formula: '=LET(src,Sales!A2:D100,filtered,FILTER(src,Sales!D2:D100="已成交"),MAP(filtered,LAMBDA(row,INDEX(row,1))))',
      normalizedFormula: 'LET(src,Sales!A2:D100,filtered,FILTER(src,Sales!D2:D100="已成交"),MAP(filtered,LAMBDA(row,INDEX(row,1))))',
      summary: "筛选已成交销售记录。",
      model: "gpt5.5",
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

    const markup = renderToStaticMarkup(<FormulaExplainResult result={result} />);

    expect(markup).not.toContain("公式优化排版");
    expect(markup).not.toContain("gpt5.5");
    expect(markup).toContain("公式结构");
    expect(markup).toContain("LET");
    expect(markup).toContain("定义 LET 参数 src");
    expect(markup).toContain("引用 LET 参数 src");
    expect(markup).toContain("引用 LAMBDA 参数 row");
    expect(markup).toContain("// LET：定义可复用的中间变量。");
    expect(markup).toContain("// FILTER：筛选符合条件的销售记录。");
    expect(markup).toContain("// INDEX：取出当前行的第 1 列。");
    expect(markup).toContain("优化建议");
    expect(markup).toContain("src");
    expect(markup).toContain("filtered");
    expect(markup).toContain("FILTER、MAP");
    expect(markup).toContain("Sales!A2:D100");
    expect(markup).not.toContain("复杂公式建议用 LET 缓存重复计算结果");
    expect(markup).not.toContain("参数 4 调用 FILTER");
    expect(markup).not.toContain("MAP 参数 2 调用 LAMBDA");
    expect(markup).not.toContain("函数调用关系");
    expect(markup).not.toContain("未识别到嵌套函数调用");
  });

  it("keeps non-hidden model names visible", () => {
    const result: FormulaExplainResponse = {
      formula: "=SUM(A1:A10)",
      normalizedFormula: "SUM(A1:A10)",
      summary: "汇总 A1 到 A10。",
      model: "gpt-test",
      segments: [],
      functions: [],
      warnings: [],
      suggestions: [],
    };

    const markup = renderToStaticMarkup(<FormulaExplainResult result={result} />);

    expect(markup).toContain("gpt-test");
  });
});
