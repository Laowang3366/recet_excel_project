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

export type FormulaLayoutBlock = {
  id: string;
  name: string;
  depth: number;
  text: string;
  arguments: string[];
  children: string[];
};

export type FormulaCallEdge = {
  from: string;
  to: string;
  argumentIndex: number;
};

export type FormulaParameterHighlight = {
  name: string;
  role: "definition" | "reference";
  sourceFunction: "LET" | "LAMBDA";
  lineIndex: number;
};

export type FormulaLayout = {
  source: string;
  normalizedSource: string;
  formattedLines: string;
  blocks: FormulaLayoutBlock[];
  callEdges: FormulaCallEdge[];
  parameterHighlights: FormulaParameterHighlight[];
  signals: string[];
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

export function buildFormulaLayout(formula: string): FormulaLayout {
  const source = formula.trim();
  const normalizedSource = source.startsWith("=") ? source.slice(1).trim() : source;
  const blocks: FormulaLayoutBlock[] = [];
  const callEdges: FormulaCallEdge[] = [];
  const formattedLines = formatFormulaExpression(normalizedSource, 0).join("\n");

  collectFormulaBlocks(normalizedSource, 0, undefined, undefined, blocks, callEdges);

  return {
    source,
    normalizedSource,
    formattedLines,
    blocks,
    callEdges,
    parameterHighlights: collectFormulaParameterHighlights(normalizedSource, formattedLines),
    signals: detectFormulaSignals(normalizedSource, blocks),
  };
}

export function formatFormulaExplanationForCopy(response: FormulaExplainResponse) {
  const analysisText = formatFormulaAnalysis(response.analysis);
  const layout = buildFormulaLayout(response.formula || response.normalizedFormula);
  const parameterAnnotationLines = layout.parameterHighlights.map((item) => (
    `- ${item.role === "definition" ? "定义" : "引用"} ${item.sourceFunction} 参数 ${item.name}`
  ));
  const optimizationSuggestions = buildFormulaOptimizationSuggestions(response, layout);
  const lines = [
    `公式：${response.formula}`,
    "",
    "公式优化排版：",
    layout.formattedLines,
    ...(parameterAnnotationLines.length > 0 ? ["", "自定义参数：", ...parameterAnnotationLines] : []),
    ...(layout.signals.length > 0 ? ["", `审计标记：${layout.signals.join(" / ")}`] : []),
    "",
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
  if (optimizationSuggestions.length > 0) {
    lines.push("", "优化建议：", ...optimizationSuggestions.map((item) => `- ${item}`));
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

export function buildFormulaOptimizationSuggestions(
  response: Pick<FormulaExplainResponse, "formula" | "normalizedFormula" | "suggestions">,
  layout = buildFormulaLayout(response.formula || response.normalizedFormula),
) {
  const suggestions = [...(response.suggestions || [])];
  const performanceSuggestion = buildFormulaPerformanceSuggestion(layout);
  if (performanceSuggestion && !suggestions.some((item) => item.includes("性能优化"))) {
    suggestions.push(performanceSuggestion);
  }
  return suggestions;
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

type ParsedFormulaFunction = {
  name: string;
  raw: string;
  args: string[];
  closeIndex: number;
};

type FormulaParameterDefinition = Pick<FormulaParameterHighlight, "name" | "sourceFunction">;

const COMPLEX_FORMULA_PERFORMANCE_SUGGESTION = "性能优化：复杂公式建议用 LET 缓存重复计算结果，并先缩小 FILTER、MAP 等动态数组的输入范围，减少重复重算。";

const DYNAMIC_ARRAY_FUNCTIONS = new Set([
  "BYCOL",
  "BYROW",
  "CHOOSECOLS",
  "CHOOSEROWS",
  "DROP",
  "EXPAND",
  "FILTER",
  "HSTACK",
  "MAP",
  "RANDARRAY",
  "REDUCE",
  "SCAN",
  "SEQUENCE",
  "SORT",
  "SORTBY",
  "TAKE",
  "TOCOL",
  "TOROW",
  "UNIQUE",
  "VSTACK",
  "WRAPCOLS",
  "WRAPROWS",
  "XLOOKUP",
  "XMATCH",
]);

function collectFormulaBlocks(
  expression: string,
  depth: number,
  parent: FormulaLayoutBlock | undefined,
  argumentIndex: number | undefined,
  blocks: FormulaLayoutBlock[],
  callEdges: FormulaCallEdge[],
) {
  const parsed = parseEntireFunctionCall(expression);
  if (parsed) {
    const block: FormulaLayoutBlock = {
      id: `${parsed.name}-${blocks.length + 1}`,
      name: parsed.name,
      depth,
      text: parsed.raw,
      arguments: parsed.args.map((item) => item.trim()),
      children: [],
    };
    blocks.push(block);

    if (parent && typeof argumentIndex === "number") {
      parent.children.push(block.name);
      callEdges.push({ from: parent.name, to: block.name, argumentIndex });
    }

    parsed.args.forEach((arg, index) => {
      findDirectFunctionCalls(arg).forEach((child) => {
        collectFormulaBlocks(child.raw, depth + 1, block, index + 1, blocks, callEdges);
      });
    });
    return;
  }

  findDirectFunctionCalls(expression).forEach((child) => {
    collectFormulaBlocks(child.raw, depth, parent, argumentIndex, blocks, callEdges);
  });
}

function buildFormulaPerformanceSuggestion(layout: FormulaLayout) {
  const performanceSignals = new Set(["跨表引用", "动态数组", "自定义函数结构", "嵌套较深", "嵌套调用"]);
  const hasPerformanceSignal = layout.signals.some((signal) => performanceSignals.has(signal));
  const hasFullColumnReference = /(^|[^A-Z0-9_.])\$?[A-Z]{1,3}:\$?[A-Z]{1,3}($|[^A-Z0-9_.])/i.test(layout.normalizedSource);
  if (!hasPerformanceSignal && !hasFullColumnReference && layout.blocks.length < 2) return "";
  return COMPLEX_FORMULA_PERFORMANCE_SUGGESTION;
}

function collectFormulaParameterHighlights(expression: string, formattedLines: string): FormulaParameterHighlight[] {
  const definitions = dedupeParameterDefinitions(collectFormulaParameterDefinitions(expression));
  if (definitions.length === 0) return [];

  const lines = formattedLines.split("\n");
  const highlights: FormulaParameterHighlight[] = [];
  const definitionLineKeys = new Set<string>();
  const usedDefinitionLines = new Set<number>();

  definitions.forEach((definition) => {
    const lineIndex = findParameterDefinitionLine(lines, definition.name, usedDefinitionLines);
    if (lineIndex < 0) return;

    highlights.push({ ...definition, role: "definition", lineIndex });
    definitionLineKeys.add(getParameterHighlightKey(definition, "definition", lineIndex));
    usedDefinitionLines.add(lineIndex);
  });

  lines.forEach((line, lineIndex) => {
    definitions.forEach((definition) => {
      if (definitionLineKeys.has(getParameterHighlightKey(definition, "definition", lineIndex))) return;
      if (!lineContainsParameterToken(line, definition.name)) return;

      highlights.push({ ...definition, role: "reference", lineIndex });
    });
  });

  return dedupeParameterHighlights(highlights);
}

function collectFormulaParameterDefinitions(expression: string, definitions: FormulaParameterDefinition[] = []) {
  const parsed = parseEntireFunctionCall(expression);
  if (parsed) {
    if (parsed.name === "LET") {
      for (let index = 0; index < parsed.args.length - 1; index += 2) {
        const name = normalizeFormulaParameterName(parsed.args[index]);
        if (name) definitions.push({ name, sourceFunction: "LET" });
      }
    }

    if (parsed.name === "LAMBDA") {
      for (let index = 0; index < parsed.args.length - 1; index += 1) {
        const name = normalizeFormulaParameterName(parsed.args[index]);
        if (name) definitions.push({ name, sourceFunction: "LAMBDA" });
      }
    }

    parsed.args.forEach((arg) => collectFormulaParameterDefinitions(arg, definitions));
    return definitions;
  }

  findDirectFunctionCalls(expression).forEach((child) => {
    collectFormulaParameterDefinitions(child.raw, definitions);
  });
  return definitions;
}

function dedupeParameterDefinitions(definitions: FormulaParameterDefinition[]) {
  const seen = new Set<string>();
  return definitions.filter((definition) => {
    const key = `${definition.sourceFunction}:${definition.name.toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeParameterHighlights(highlights: FormulaParameterHighlight[]) {
  const seen = new Set<string>();
  return highlights.filter((highlight) => {
    const key = getParameterHighlightKey(highlight, highlight.role, highlight.lineIndex);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getParameterHighlightKey(
  item: Pick<FormulaParameterHighlight, "name" | "sourceFunction">,
  role: FormulaParameterHighlight["role"],
  lineIndex: number,
) {
  return `${lineIndex}:${role}:${item.sourceFunction}:${item.name.toUpperCase()}`;
}

function findParameterDefinitionLine(lines: string[], parameterName: string, usedLineIndexes: Set<number>) {
  const normalizedName = parameterName.toUpperCase();
  return lines.findIndex((line, index) => {
    if (usedLineIndexes.has(index)) return false;
    return normalizeFormulaLineToken(line).toUpperCase() === normalizedName;
  });
}

function normalizeFormulaLineToken(line: string) {
  const trimmed = line.trim();
  return trimmed.endsWith(",") ? trimmed.slice(0, -1).trim() : trimmed;
}

function normalizeFormulaParameterName(value: string) {
  const candidate = value.trim();
  if (!isIdentifierStart(candidate[0])) return "";
  for (let index = 1; index < candidate.length; index += 1) {
    if (!isIdentifierPart(candidate[index])) return "";
  }
  return candidate;
}

function lineContainsParameterToken(line: string, parameterName: string) {
  const normalizedLine = line.toUpperCase();
  const normalizedName = parameterName.toUpperCase();
  let inString = false;

  for (let index = 0; index <= line.length - parameterName.length; index += 1) {
    const current = line[index];
    if (current === "\"") {
      if (inString && line[index + 1] === "\"") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (normalizedLine.slice(index, index + normalizedName.length) !== normalizedName) continue;
    if (isIdentifierPart(line[index - 1]) || isIdentifierPart(line[index + parameterName.length])) continue;
    return true;
  }
  return false;
}

function formatFormulaExpression(expression: string, depth: number): string[] {
  const parsed = parseEntireFunctionCall(expression);
  const indent = "  ".repeat(depth);
  if (!parsed) {
    return [`${indent}${expression.trim()}`];
  }

  const lines = [`${indent}${parsed.name}(`];
  parsed.args.forEach((arg, index) => {
    const argLines = formatFormulaExpression(arg, depth + 1);
    if (index < parsed.args.length - 1) {
      argLines[argLines.length - 1] = `${argLines[argLines.length - 1]},`;
    }
    lines.push(...argLines);
  });
  lines.push(`${indent})`);
  return lines;
}

function parseEntireFunctionCall(expression: string) {
  const trimmed = expression.trim();
  const parsed = parseFunctionAt(trimmed, 0);
  if (!parsed) return null;
  return parsed.closeIndex === trimmed.length - 1 ? parsed : null;
}

function parseFunctionAt(expression: string, start: number): ParsedFormulaFunction | null {
  if (!isIdentifierStart(expression[start])) return null;

  let cursor = start + 1;
  while (cursor < expression.length && isIdentifierPart(expression[cursor])) {
    cursor += 1;
  }

  const name = expression.slice(start, cursor).toUpperCase();
  while (cursor < expression.length && /\s/.test(expression[cursor])) {
    cursor += 1;
  }
  if (expression[cursor] !== "(") return null;

  const closeIndex = findMatchingParen(expression, cursor);
  if (closeIndex === -1) return null;

  return {
    name,
    raw: expression.slice(start, closeIndex + 1),
    args: splitTopLevelArguments(expression.slice(cursor + 1, closeIndex)),
    closeIndex,
  };
}

function findDirectFunctionCalls(expression: string) {
  const calls: ParsedFormulaFunction[] = [];
  let inString = false;
  for (let index = 0; index < expression.length; index += 1) {
    const current = expression[index];
    if (current === "\"") {
      if (inString && expression[index + 1] === "\"") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString || !isIdentifierStart(current)) continue;

    const parsed = parseFunctionAt(expression, index);
    if (parsed) {
      calls.push(parsed);
      index = parsed.closeIndex;
    }
  }
  return calls;
}

function findMatchingParen(expression: string, openIndex: number) {
  let depth = 0;
  let inString = false;
  for (let index = openIndex; index < expression.length; index += 1) {
    const current = expression[index];
    if (current === "\"") {
      if (inString && expression[index + 1] === "\"") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (current === "(") depth += 1;
    if (current === ")") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function splitTopLevelArguments(expression: string) {
  const args: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let inString = false;

  for (let index = 0; index < expression.length; index += 1) {
    const current = expression[index];
    if (current === "\"") {
      if (inString && expression[index + 1] === "\"") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (current === "(") parenDepth += 1;
    if (current === ")") parenDepth -= 1;
    if (current === "[") bracketDepth += 1;
    if (current === "]") bracketDepth -= 1;
    if (current === "{") braceDepth += 1;
    if (current === "}") braceDepth -= 1;

    const isTopLevelSeparator = (current === "," || current === ";") && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0;
    if (isTopLevelSeparator) {
      args.push(expression.slice(start, index));
      start = index + 1;
    }
  }

  if (expression.length > 0 || start > 0) {
    args.push(expression.slice(start));
  }
  return args;
}

function detectFormulaSignals(expression: string, blocks: FormulaLayoutBlock[]) {
  const names = new Set(blocks.map((block) => block.name.replace(/^_XLFN\./, "")));
  const signals: string[] = [];

  if (expression.includes("!")) signals.push("跨表引用");
  if (/\[[^\]]+\]/.test(expression)) signals.push("结构化引用");
  if ([...names].some((name) => DYNAMIC_ARRAY_FUNCTIONS.has(name))) signals.push("动态数组");
  if (names.has("LET") || names.has("LAMBDA")) signals.push("自定义函数结构");
  if (blocks.some((block) => block.depth >= 3)) signals.push("嵌套较深");
  if (blocks.length > 1) signals.push("嵌套调用");

  return signals;
}

function isIdentifierStart(value: string | undefined) {
  return typeof value === "string" && /[A-Za-z_]/.test(value);
}

function isIdentifierPart(value: string | undefined) {
  return typeof value === "string" && /[A-Za-z0-9_.]/.test(value);
}
