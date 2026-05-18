import type { AdminQuestionForm, QuestionDynamicArrayRuleForm } from "./AdminConsoleTypes";

export function defaultQuestionForm(): AdminQuestionForm {
  return {
    title: "",
    questionCategoryId: "",
    difficulty: 1,
    points: 0,
    explanation: "",
    enabled: true,
    templateFileUrl: "",
    answerSheet: "",
    answerRange: "",
    answerSnapshotJson: "",
    checkFormula: false,
    gradingMode: "simple",
    dynamicArrayRules: [defaultDynamicArrayRule()],
    gradingRuleJson: "",
    sheetCountLimit: 5,
    version: 1,
  };
}

export function defaultDynamicArrayRule(sheet = ""): QuestionDynamicArrayRuleForm {
  return {
    sheet,
    anchorCell: "",
    spillRange: "",
    score: 1,
    label: "",
    formulaKeywordsText: "",
    requireAnchorFormula: true,
    requireSpillCellsWithoutFormula: true,
  };
}

export function parseFormulaKeywords(value: unknown) {
  return String(value || "")
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseDynamicArrayRulesFromJson(gradingRuleJson: unknown, fallbackSheet = ""): QuestionDynamicArrayRuleForm[] {
  if (!gradingRuleJson) {
    return [defaultDynamicArrayRule(fallbackSheet)];
  }
  try {
    const parsed = JSON.parse(String(gradingRuleJson)) as { dynamicArrayRules?: unknown[] };
    const rules = Array.isArray(parsed?.dynamicArrayRules) ? parsed.dynamicArrayRules : [];
    if (rules.length === 0) {
      return [defaultDynamicArrayRule(fallbackSheet)];
    }
    return rules.map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        sheet: String(record.sheet || fallbackSheet || ""),
        anchorCell: String(record.anchorCell || ""),
        spillRange: String(record.spillRange || ""),
        score: Number(record.score || 1),
        label: String(record.label || ""),
        formulaKeywordsText: Array.isArray(record.formulaKeywords) ? record.formulaKeywords.join(", ") : "",
        requireAnchorFormula: record.requireAnchorFormula !== false,
        requireSpillCellsWithoutFormula: record.requireSpillCellsWithoutFormula !== false,
      };
    });
  } catch {
    return [defaultDynamicArrayRule(fallbackSheet)];
  }
}

export function buildDynamicArrayRuleJson(rules: QuestionDynamicArrayRuleForm[]) {
  const normalizedRules = (rules || [])
    .map((item) => ({
      sheet: String(item?.sheet || "").trim(),
      anchorCell: String(item?.anchorCell || "").trim().toUpperCase(),
      spillRange: String(item?.spillRange || "").trim().toUpperCase(),
      score: Math.max(1, Number(item?.score || 1)),
      label: String(item?.label || "").trim(),
      requireAnchorFormula: item?.requireAnchorFormula !== false,
      requireSpillCellsWithoutFormula: item?.requireSpillCellsWithoutFormula !== false,
      formulaKeywords: parseFormulaKeywords(item?.formulaKeywordsText),
    }))
    .filter((item) => item.sheet && item.anchorCell && item.spillRange);
  return JSON.stringify({ dynamicArrayRules: normalizedRules });
}
