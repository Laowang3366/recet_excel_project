import { AlertTriangle, Bell, Blocks, CheckCircle2, ClipboardCheck, FileSpreadsheet, Flag, ShieldCheck, type LucideIcon } from "lucide-react";
import {
  columnIndexToLabel,
  getCellDisplayValue,
  getCellSnapshot,
  getSheetSnapshot,
  parseRangeRef,
  resolveSheetBounds,
  toCellRef,
  type ExcelWorkbookSnapshot,
} from "../lib/excel";

export type QuestionBankTabKey = "questions" | "campaign" | "snapshots" | "exceptions";

export type QuestionBankTab = {
  key: QuestionBankTabKey;
  label: string;
};

export type QuestionEditorStepKey = "basic" | "template" | "answer" | "preview";

export type QuestionEditorStep = {
  key: QuestionEditorStepKey;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type QuestionBankStat = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
};

export type QuestionBankStatsInput = {
  totalQuestions: number;
  records: Array<{
    enabled?: boolean | null;
    gradingMode?: string | null;
    gradingRuleJson?: string | null;
  }>;
  campaignLevelCount: number;
  categoryCount: number;
};

export type QuestionBasicInfoValidationInput = {
  title?: unknown;
  questionCategoryId?: unknown;
  difficulty?: unknown;
  explanation?: unknown;
};

export type QuestionWorksheetPreviewCell = {
  ref: string;
  text: string;
  isAnswerCell: boolean;
  isStandardCell: boolean;
};

export type QuestionWorksheetPreviewRow = {
  rowNumber: number;
  cells: QuestionWorksheetPreviewCell[];
};

export type QuestionWorksheetPreviewGrid = {
  sheetName: string;
  headers: string[];
  rows: QuestionWorksheetPreviewRow[];
};

export type QuestionStatusMeta = {
  label: string;
  className: string;
};

export const QUESTION_BANK_TABS: QuestionBankTab[] = [
  { key: "questions", label: "题目列表" },
  { key: "campaign", label: "闯关关卡" },
  { key: "snapshots", label: "模板快照检查" },
  { key: "exceptions", label: "异常题目" },
];

export const QUESTION_EDITOR_STEPS: QuestionEditorStep[] = [
  { key: "basic", label: "基本信息", description: "标题、分类、奖励分值", icon: FileSpreadsheet },
  { key: "template", label: "上传模板", description: "模板文件、编辑器操作", icon: ClipboardCheck },
  { key: "answer", label: "答题与判题", description: "答题区域、判题规则、一键测试", icon: ShieldCheck },
  { key: "preview", label: "预览发布", description: "前台预览、发布确认", icon: Flag },
];

export const QUESTION_PUBLISH_CHECKS = [
  "模板文件已上传",
  "题目区域已标注",
  "公式校验通过",
  "快照检查完成",
  "一键测试待执行",
] as const;

export const QUESTION_BANK_SERVICE_ENDPOINTS = {
  batchImport: "/api/admin/questions/batch-import",
  templateSnapshotChecks: "/api/admin/questions/template-snapshot-checks",
  exceptions: "/api/admin/questions/exceptions",
  publishTests: "/api/admin/questions/publish-tests",
  publishTest: (id: number | string) => `/api/admin/questions/${id}/publish-test`,
} as const;

export function buildQuestionBankStats(input: QuestionBankStatsInput): QuestionBankStat[] {
  const enabledCount = input.records.filter((item) => item.enabled).length;
  const dynamicQuestionCount = input.records.filter(isDynamicArrayQuestion).length;

  return [
    {
      label: "题目总数",
      value: String(input.totalQuestions),
      hint: `启用 ${enabledCount}`,
      icon: ClipboardCheck,
      tone: "bg-[#1769ff] text-white",
    },
    {
      label: "动态数组题",
      value: String(dynamicQuestionCount),
      hint: "需重点验证",
      icon: Blocks,
      tone: "bg-[#31c879] text-white",
    },
    {
      label: "闯关关卡",
      value: String(input.campaignLevelCount),
      hint: "草稿 1",
      icon: Flag,
      tone: "bg-[#6757f5] text-white",
    },
    {
      label: "待审核投稿",
      value: "0",
      hint: "最长 18h",
      icon: Bell,
      tone: "bg-[#ff981a] text-white",
    },
  ];
}

export function getQuestionStatusMeta(value: unknown): QuestionStatusMeta {
  if (value === true || value === "true" || value === 1 || value === "1" || value === "enabled") {
    return { label: "启用", className: "bg-[#dcfce7] text-[#16a34a]" };
  }
  if (value === false || value === "false" || value === 0 || value === "0" || value === "disabled") {
    return { label: "停用", className: "bg-[#fee2e2] text-[#ef4444]" };
  }
  if (value === "draft") {
    return { label: "草稿", className: "bg-[#eef2f7] text-[#64748b]" };
  }
  if (value === "pending") {
    return { label: "待验证", className: "bg-[#ffedd5] text-[#f97316]" };
  }
  return { label: "启用", className: "bg-[#dcfce7] text-[#16a34a]" };
}

export function getQuestionRiskIcon(index: number) {
  return index < 4 ? CheckCircle2 : AlertTriangle;
}

export function getQuestionBasicInfoValidationErrors(input: QuestionBasicInfoValidationInput) {
  const errors: string[] = [];
  if (!String(input.title || "").trim()) {
    errors.push("请填写题目标题");
  }
  if (!String(input.questionCategoryId || "").trim()) {
    errors.push("请选择题目分类");
  }
  const difficulty = Number(input.difficulty);
  if (!Number.isFinite(difficulty) || difficulty < 1) {
    errors.push("请选择题目难度");
  }
  if (!String(input.explanation || "").trim()) {
    errors.push("请填写题目说明");
  }
  return errors;
}

function isCellInsideRange(cellRef: string, rangeRef: string | null | undefined) {
  const cell = parseRangeRef(cellRef);
  const range = rangeRef ? parseRangeRef(rangeRef) : null;
  if (!cell || !range) return false;
  return cell.startRow >= range.startRow
    && cell.endRow <= range.endRow
    && cell.startCol >= range.startCol
    && cell.endCol <= range.endCol;
}

export function buildQuestionWorksheetPreviewGrid({
  workbook,
  sheetName,
  answerRange,
  standardRange,
  maxRows = 12,
  maxCols = 14,
}: {
  workbook: ExcelWorkbookSnapshot | null | undefined;
  sheetName?: string | null;
  answerRange?: string | null;
  standardRange?: string | null;
  maxRows?: number;
  maxCols?: number;
}): QuestionWorksheetPreviewGrid {
  const resolvedSheetName = sheetName || workbook?.sheets?.[0]?.name || "";
  const sheet = getSheetSnapshot(workbook, resolvedSheetName);
  if (!sheet) {
    return { sheetName: "", headers: [""], rows: [] };
  }

  const bounds = resolveSheetBounds(sheet);
  const rowCount = Math.min(bounds.rowCount, Math.max(1, maxRows));
  const columnCount = Math.min(bounds.columnCount, Math.max(1, maxCols));
  const headers = ["", ...Array.from({ length: columnCount }, (_, index) => columnIndexToLabel(index + 1))];
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = Array.from({ length: columnCount }, (_, colIndex) => {
      const cellRef = toCellRef(rowNumber, colIndex + 1);
      const cell = getCellSnapshot(sheet, cellRef);
      return {
        ref: cellRef,
        text: cell ? getCellDisplayValue(cell) : "",
        isAnswerCell: isCellInsideRange(cellRef, answerRange),
        isStandardCell: isCellInsideRange(cellRef, standardRange),
      };
    });
    return { rowNumber, cells };
  });

  return { sheetName: sheet.name, headers, rows };
}

function isDynamicArrayQuestion(item: QuestionBankStatsInput["records"][number]) {
  if (item.gradingMode === "dynamic_array") return true;
  return String(item.gradingRuleJson || "").includes("dynamicArrayRules");
}
