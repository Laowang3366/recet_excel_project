import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormulaExplainResult } from "./FormulaExplainResult";
import type { FormulaExplainResponse } from "../../lib/formula-explainer";

describe("FormulaExplainResult", () => {
  it("shows function call relationships as inline formula layout annotations", () => {
    const result: FormulaExplainResponse = {
      formula: '=LET(src,Sales!A2:D100,filtered,FILTER(src,Sales!D2:D100="已成交"),MAP(filtered,LAMBDA(row,INDEX(row,1))))',
      normalizedFormula: 'LET(src,Sales!A2:D100,filtered,FILTER(src,Sales!D2:D100="已成交"),MAP(filtered,LAMBDA(row,INDEX(row,1))))',
      summary: "筛选已成交销售记录。",
      segments: [],
      functions: [],
      warnings: [],
      suggestions: [],
    };

    const markup = renderToStaticMarkup(<FormulaExplainResult result={result} />);

    expect(markup).toContain("公式优化排版");
    expect(markup).toContain("LET");
    expect(markup).toContain("参数 4 调用 FILTER");
    expect(markup).toContain("MAP 参数 2 调用 LAMBDA");
    expect(markup).not.toContain("函数调用关系");
    expect(markup).not.toContain("未识别到嵌套函数调用");
  });
});
