import type { AdminQuestionForm, QuestionDynamicArrayRuleForm } from "./AdminConsoleTypes";

export const QUESTION_DIFFICULTY_POINT_OPTIONS = [
  { difficulty: 1, points: 12 },
  { difficulty: 2, points: 15 },
  { difficulty: 3, points: 18 },
  { difficulty: 4, points: 20 },
  { difficulty: 5, points: 22 },
  { difficulty: 6, points: 24 },
  { difficulty: 7, points: 26 },
  { difficulty: 8, points: 28 },
  { difficulty: 9, points: 30 },
  { difficulty: 10, points: 32 },
] as const;

const QUESTION_DIFFICULTY_POINTS = new Map<number, number>(
  QUESTION_DIFFICULTY_POINT_OPTIONS.map((item) => [item.difficulty, item.points]),
);

export function normalizeQuestionDifficulty(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(10, Math.max(1, Math.round(parsed)));
}

export function resolveQuestionPointsByDifficulty(value: unknown) {
  const difficulty = normalizeQuestionDifficulty(value);
  return QUESTION_DIFFICULTY_POINTS.get(difficulty) ?? 12;
}

export function applyQuestionDifficulty(form: AdminQuestionForm, value: unknown): AdminQuestionForm {
  const difficulty = normalizeQuestionDifficulty(value);
  return {
    ...form,
    difficulty,
    points: resolveQuestionPointsByDifficulty(difficulty),
  };
}

export function defaultQuestionForm(): AdminQuestionForm {
  return {
    title: "",
    questionCategoryId: "",
    difficulty: 1,
    points: resolveQuestionPointsByDifficulty(1),
    explanation: "",
    enabled: true,
    templateFileUrl: "",
    idealAnswerImageUrl: "",
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
