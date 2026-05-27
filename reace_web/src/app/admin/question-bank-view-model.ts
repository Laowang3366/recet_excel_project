import { AlertTriangle, Bell, Blocks, CheckCircle2, ClipboardCheck, FileSpreadsheet, Flag, ShieldCheck, type LucideIcon } from "lucide-react";

export type QuestionBankTabKey = "questions" | "campaign" | "snapshots" | "exceptions";

export type QuestionBankTab = {
  key: QuestionBankTabKey;
  label: string;
};

export type QuestionEditorStepKey = "basic" | "template" | "answer" | "grading" | "preview";

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
  { key: "template", label: "上传模板", description: "题干模板、参考工作表", icon: ClipboardCheck },
  { key: "answer", label: "答题区域", description: "作答单元格、输入限制", icon: Blocks },
  { key: "grading", label: "判题规则", description: "公式校验、快照比对、一键测试", icon: ShieldCheck },
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

function isDynamicArrayQuestion(item: QuestionBankStatsInput["records"][number]) {
  if (item.gradingMode === "dynamic_array") return true;
  return String(item.gradingRuleJson || "").includes("dynamicArrayRules");
}
