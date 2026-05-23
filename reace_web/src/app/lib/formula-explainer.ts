export type FormulaExplainSegment = {
  text: string;
  title: string;
  explanation: string;
};

export type FormulaExplainFunction = {
  name: string;
  purpose: string;
};

export type FormulaAnalysis = {
  functions?: string[];
  parenthesesDepth?: number;
  nestingDepth?: number;
  structuredReference?: boolean;
  dynamicArrayFunction?: boolean;
  riskFlags?: string[];
};

export type FormulaExplainRequest = {
  formula: string;
  locale?: string;
  detailLevel?: "brief" | "standard" | "detailed";
  workbookContext?: string;
  expectedResult?: string;
  errorMessageInput?: string;
};

export type FormulaExplainResponse = {
  recordId?: number | string;
  formula: string;
  normalizedFormula: string;
  summary: string;
  segments: FormulaExplainSegment[];
  functions: FormulaExplainFunction[];
  warnings: string[];
  suggestions: string[];
  analysis?: FormulaAnalysis | null;
  fixes?: string[];
  cacheHit?: boolean;
  pointsCost?: number;
  currentPoints?: number;
  createTime?: string | null;
  model?: string;
  fallbackUsed?: boolean;
};

export function validateFormulaInput(value: string, context: Pick<FormulaExplainRequest, "workbookContext" | "expectedResult" | "errorMessageInput"> = {}) {
  const formula = value.trim();
  if (!formula) {
    return { ok: false as const, message: "请输入需要解释的 Excel 公式" };
  }
  if (formula.length > 2000) {
    return { ok: false as const, message: "公式长度不能超过 2000 个字符" };
  }
  if ((context.workbookContext || "").trim().length > 4000) {
    return { ok: false as const, message: "表格上下文不能超过 4000 个字符" };
  }
  if ((context.expectedResult || "").trim().length > 1000) {
    return { ok: false as const, message: "期望结果不能超过 1000 个字符" };
  }
  if ((context.errorMessageInput || "").trim().length > 1000) {
    return { ok: false as const, message: "错误信息不能超过 1000 个字符" };
  }
  if (!hasBalancedFormulaParentheses(formula)) {
    return { ok: false as const, message: "公式括号不完整，请检查后再解释" };
  }
  return { ok: true as const };
}

export function hasBalancedFormulaParentheses(formula: string) {
  let depth = 0;
  let inString = false;
  for (let index = 0; index < formula.length; index += 1) {
    const current = formula[index];
    if (current === "\"") {
      if (inString && formula[index + 1] === "\"") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (current === "(") depth += 1;
    if (current === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0 && !inString;
}

export function formatFormulaExplanationForCopy(response: FormulaExplainResponse) {
  const analysisText = formatFormulaAnalysis(response.analysis);
  const lines = [
    `公式：${response.formula}`,
    `整体解释：${response.summary}`,
    "",
    "分段说明：",
    ...response.segments.map((item, index) => `${index + 1}. ${item.title}\n${item.text}\n${item.explanation}`),
    "",
    "函数说明：",
    ...response.functions.map((item) => `${item.name}：${item.purpose}`),
  ];
  if (response.warnings.length > 0) {
    lines.push("", "注意事项：", ...response.warnings.map((item) => `- ${item}`));
  }
  if (response.suggestions.length > 0) {
    lines.push("", "优化建议：", ...response.suggestions.map((item) => `- ${item}`));
  }
  if (analysisText) {
    lines.push("", "公式分析：", analysisText);
  }
  if (response.fixes && response.fixes.length > 0) {
    lines.push("", "修复建议：", ...response.fixes.map((item) => `- ${item}`));
  }
  const metadata = [
    response.model,
    response.cacheHit === true ? "缓存命中" : response.cacheHit === false ? "实时生成" : "",
    typeof response.pointsCost === "number" ? `消耗 ${response.pointsCost} 积分` : "",
    typeof response.currentPoints === "number" ? `当前 ${response.currentPoints} 积分` : "",
  ].filter(Boolean);
  if (metadata.length > 0) {
    lines.push("", `模型信息：${metadata.join(" / ")}`);
  }
  return lines.join("\n").trim();
}

export function formatFormulaAnalysis(analysis?: FormulaAnalysis | null) {
  if (!analysis) return "";
  const lines = [
    analysis.functions && analysis.functions.length > 0 ? `函数：${analysis.functions.join("、")}` : "",
    typeof analysis.parenthesesDepth === "number" ? `括号深度：${analysis.parenthesesDepth}` : "",
    typeof analysis.nestingDepth === "number" ? `嵌套深度：${analysis.nestingDepth}` : "",
    analysis.structuredReference ? "包含结构化引用" : "",
    analysis.dynamicArrayFunction ? "包含动态数组函数" : "",
    analysis.riskFlags && analysis.riskFlags.length > 0 ? `风险标记：${analysis.riskFlags.join("、")}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}
