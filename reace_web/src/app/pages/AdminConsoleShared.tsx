import { Component, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { ApiError } from "../lib/api";
import type { DynamicArrayHydrationRule } from "../lib/excel";
import { getDefaultAdminPath, hasAdminConsoleAccess, type AdminRole } from "../admin/config";
import { useSession } from "../lib/session";
import { formDialogBodyClassName, formDialogContentClassName, inputClassName, primaryButtonClassName, secondaryButtonClassName } from "../admin/shared";

export type AdminStatsGroup = Record<string, number | undefined>;

export type AdminStatsPayload = {
  overview?: AdminStatsGroup;
  users?: AdminStatsGroup;
  moderation?: AdminStatsGroup;
  practice?: AdminStatsGroup;
  pointsAndLevels?: AdminStatsGroup;
  notifications?: AdminStatsGroup;
  userCount?: number;
  pendingFeedback?: number;
};

export type PagedAdminResponse<T> = {
  records: T[];
  total: number;
};

export type AdminEditableUserRole = "admin" | "moderator" | "user";

export type AdminUserForm = {
  username: string;
  email: string;
  password: string;
  role: AdminEditableUserRole;
  status: number;
};

export type AdminUserRecord = {
  id: number;
  username: string;
  email?: string | null;
  avatar?: string | null;
  role?: string | null;
  status?: number | null;
  isMuted?: boolean;
  level?: number;
  points?: number;
  createTime?: string | null;
};

export type AdminUserToggleResponse = {
  locked?: boolean;
  muted?: boolean;
};

export type AdminNotificationForm = {
  title: string;
  content: string;
  type: string;
  status: string;
  targetType: string;
  targetRoles: string;
  attachments: string;
};

export type AdminNotificationRecord = AdminNotificationForm & {
  id: number;
  createTime?: string | null;
};

export type AdminNotificationStats = {
  total?: number;
  sent?: number;
  draft?: number;
  totalUsers?: number;
};

export type QuestionCategoryForm = {
  name: string;
  description: string;
  groupName: string;
  sortOrder: number | string;
  enabled: boolean;
};

export type QuestionCategoryRecord = QuestionCategoryForm & {
  id: number;
  questionCount?: number;
};

export type DailyChallengeForm = {
  challengeDate: string;
  levelId: string;
  rewardExp: string | number;
  rewardPoints: string | number;
  enabled: boolean;
};

export type PracticeCampaignLevelRecord = {
  id: number;
  title?: string | null;
  chapterName?: string | null;
  questionTitle?: string | null;
  levelType?: string | null;
  difficulty?: string | null;
  targetTimeSeconds?: number;
  rewardExp?: number;
  rewardPoints?: number;
  firstPassBonus?: number;
  enabled?: boolean;
};

export type LevelConfigForm = {
  levelType: string;
  difficulty: string;
  targetTimeSeconds: string;
  rewardExp: string;
  rewardPoints: string;
  firstPassBonus: string;
  enabled: boolean;
};

export type QuestionGradingMode = "simple" | "dynamic_array";

export type QuestionDynamicArrayRuleForm = DynamicArrayHydrationRule & {
  score: number | string;
  label: string;
  formulaKeywordsText: string;
  requireAnchorFormula: boolean;
  requireSpillCellsWithoutFormula: boolean;
};

export type AdminQuestionForm = {
  title: string;
  questionCategoryId: string | number;
  difficulty: string | number;
  points: string | number;
  explanation: string;
  enabled: boolean;
  templateFileUrl: string;
  answerSheet: string;
  answerRange: string;
  answerSnapshotJson: string;
  checkFormula: boolean;
  gradingMode: QuestionGradingMode;
  dynamicArrayRules: QuestionDynamicArrayRuleForm[];
  gradingRuleJson: string;
  sheetCountLimit: string | number;
  version: string | number;
};

export type AdminQuestionRecord = Partial<AdminQuestionForm> & {
  id: number;
  title: string;
  type?: string | null;
  categoryId?: number | string | null;
  questionCategoryId?: number | string | null;
  questionCategoryName?: string | null;
  expectedSnapshotJson?: string | null;
};

export type AdminQuestionsResponse = {
  questions: AdminQuestionRecord[];
  total: number;
};

export type PointsRuleForm = {
  name: string;
  description: string;
  taskKey: string;
  points: string | number;
  type: string;
  enabled: boolean;
  userVisible: boolean;
  sortOrder: string | number;
};

export type PointsRuleRecord = PointsRuleForm & {
  id: number;
};

export type PointsOptionKind = "type" | "task_key";

export type PointsOptionForm = {
  kind: PointsOptionKind;
  value: string;
  label: string;
  sortOrder: string | number;
};

export type PointsOptionRecord = PointsOptionForm & {
  id: number;
  optionValue?: string | null;
  usageCount?: number;
};

export type AdminOptionChoiceInput = {
  value?: string | null;
  optionValue?: string | null;
  label?: string | null;
};

export type PointsStatsResponse = {
  activeUsers?: number;
  totalPoints?: number;
  todayPoints?: number;
};

export type PointsOptionsResponse = {
  types: PointsOptionRecord[];
  taskKeys: PointsOptionRecord[];
};

export type PointsRecord = {
  id?: number;
  userId?: number;
  username?: string | null;
  user?: { username?: string | null } | null;
  change?: number;
  points?: number;
  reason?: string | null;
  bizLabel?: string | null;
  taskName?: string | null;
  createTime?: string | null;
};

export type PointsGrantResponse = {
  username?: string | null;
  points?: number;
};

export type LevelRuleForm = {
  level: string;
  name: string;
  threshold: string;
  enabled: boolean;
};

export type LevelRuleRecord = {
  level: number;
  name?: string | null;
  threshold?: number;
  enabled?: boolean;
};

export type ExpRuleForm = {
  key: string;
  name: string;
  description: string;
  minExp: string;
  maxExp: string;
  maxObtainCount: string;
  enabled: boolean;
};

export type ExpRuleRecord = {
  key: string;
  label?: string | null;
  description?: string | null;
  minExp?: number;
  maxExp?: number;
  maxObtainCount?: number | null;
  enabled?: boolean;
  rangeText?: string | null;
};

export type LevelsOverviewResponse = {
  stats?: {
    userCount?: number;
    totalExp?: number;
    todayExp?: number;
    highestLevelName?: string | null;
    highestLevel?: number;
    highestLevelUsers?: number;
  };
  levelRules?: LevelRuleRecord[];
  expRules?: ExpRuleRecord[];
};

export type LevelUserRecord = {
  id: number;
  username?: string | null;
  levelName?: string | null;
  level?: number;
  exp?: number;
  progress?: {
    current?: number;
    nextThreshold?: number;
  };
};

export type ExpLogRecord = {
  id: number;
  user?: { username?: string | null } | null;
  bizLabel?: string | null;
  bizType?: string | null;
  expChange?: number;
  reason?: string | null;
  createTime?: string | null;
};

export type FormDialogProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  contentClassName?: string;
  bodyClassName?: string;
  onSubmit: () => Promise<void> | void;
  children: React.ReactNode;
};

export type AdminConfirmRequest = {
  kind: "confirm";
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
};

export type AdminPromptRequest = {
  kind: "prompt";
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  resolve: (value: string | null) => void;
};

export type AdminFeedbackRequest = {
  kind: "feedback";
  type: "success" | "error";
  title?: string;
  message: string;
  confirmLabel?: string;
  durationMs?: number;
};

export type AdminDialogRequest = AdminConfirmRequest | AdminPromptRequest | AdminFeedbackRequest;
export type AdminDialogController = {
  showFeedback: (request: AdminFeedbackRequest) => void;
  openConfirm: (options: Omit<AdminConfirmRequest, "kind" | "resolve">) => Promise<boolean>;
  openPrompt: (options: Omit<AdminPromptRequest, "kind" | "resolve">) => Promise<string | null>;
};

let adminDialogController: AdminDialogController | null = null;

export async function adminRequest<T>(
  promise: Promise<T>,
  navigate: ReturnType<typeof useNavigate>,
  role: string | null,
  actionLabel?: string,
) {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        showAdminError("登录已过期，请重新登录");
        navigate("/auth", { replace: true });
        return null;
      }
      if (error.status === 403) {
        showAdminError("当前账号无权限执行该操作");
        navigate(getDefaultAdminPath(role), { replace: true });
        return null;
      }
      showAdminError(actionLabel ? `${actionLabel}失败：${error.message || "操作失败"}` : error.message || "操作失败");
      return null;
    }
    showAdminError(actionLabel ? `${actionLabel}失败：系统异常，请稍后重试` : "系统异常，请稍后重试");
    return null;
  }
}

export type ExcelEditorErrorBoundaryProps = {
  resetKey: string;
  fallback: React.ReactNode;
  children: React.ReactNode;
};

export class ExcelEditorErrorBoundary extends Component<ExcelEditorErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: ExcelEditorErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function AdminDialogHost() {
  const [request, setRequest] = useState<AdminDialogRequest | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const controller: AdminDialogController = {
    showFeedback: (feedback) => {
      setRequest(feedback);
    },
    openConfirm: (options) => new Promise<boolean>((resolve) => {
      setRequest({ kind: "confirm", ...options, resolve });
    }),
    openPrompt: (options) => new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue ?? "");
      setRequest({ kind: "prompt", ...options, resolve });
    }),
  };

  adminDialogController = controller;

  useEffect(() => {
    return () => {
      if (adminDialogController === controller) {
        adminDialogController = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!request || request.kind !== "feedback") return;
    if (request.type === "error" && request.durationMs === undefined) return;

    const timeoutId = window.setTimeout(() => {
      setRequest((current) => current === request ? null : current);
    }, request.durationMs ?? 2000);

    return () => window.clearTimeout(timeoutId);
  }, [request]);

  const dismiss = () => {
    if (!request) return;
    if (request.kind === "confirm") {
      request.resolve(false);
    } else if (request.kind === "prompt") {
      request.resolve(null);
    }
    setRequest(null);
  };

  const confirm = () => {
    if (!request) return;
    if (request.kind === "confirm") {
      request.resolve(true);
      setRequest(null);
      return;
    }
    if (request.kind === "prompt") {
      if (request.required && !promptValue.trim()) return;
      request.resolve(promptValue);
      setRequest(null);
    }
  };

  if (!request) return null;

  const isFeedback = request.kind === "feedback";
  const isPrompt = request.kind === "prompt";
  const isConfirm = request.kind === "confirm";
  const isError = isFeedback && request.type === "error";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onClick={() => {
      if (isFeedback) {
        setRequest(null);
        return;
      }
      dismiss();
    }}>
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`h-1.5 ${isError ? "bg-rose-500" : "bg-emerald-500"}`} />
        <div className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isError ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              {isError ? <XCircle size={22} /> : isFeedback ? <CheckCircle2 size={22} /> : <Sparkles size={20} />}
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-slate-900">
                {isConfirm ? request.title : isPrompt ? request.title : request.title || (isError ? "操作失败，请检查后重试" : "操作成功")}
              </div>
              {((isConfirm && request.message) || (isPrompt && request.message) || (isFeedback && request.message)) ? (
                <div className="mt-1 text-sm leading-6 text-slate-500">
                  {isConfirm ? request.message : isPrompt ? request.message : request.message}
                </div>
              ) : null}
            </div>
          </div>

          {isPrompt ? (
            <label className="block">
              <div className="mb-1.5 text-sm font-bold text-slate-700">{request.label || "请输入内容"}</div>
              <input
                autoFocus
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirm();
                  }
                }}
                placeholder={request.placeholder}
                className={inputClassName()}
              />
            </label>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {isFeedback ? null : (
              <button type="button" onClick={dismiss} className={secondaryButtonClassName()}>
                {isConfirm ? request.cancelLabel || "取消" : isPrompt ? request.cancelLabel || "取消" : "取消"}
              </button>
            )}
            <button
              type="button"
              onClick={isFeedback ? () => setRequest(null) : confirm}
              className={isFeedback
                ? `inline-flex h-10 min-w-24 items-center justify-center rounded-xl px-5 text-sm font-bold text-white transition ${isError ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800"}`
                : `${primaryButtonClassName()} ${isConfirm && request.destructive ? "!bg-rose-600 hover:!bg-rose-700" : ""}`}
            >
              {isFeedback
                ? request.confirmLabel || (isError ? "知道了" : "完成")
                : isConfirm
                  ? request.confirmLabel || "确认"
                  : request.confirmLabel || "确认"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function showAdminSuccess(message: string) {
  adminDialogController?.showFeedback({ kind: "feedback", type: "success", message });
}

export function showAdminError(message: string) {
  toast.error(message);
}

export async function runAdminDelete(options: {
  request: Promise<unknown>;
  successMessage: string;
  staleMessage: string;
  errorLabel: string;
  onDeleted?: () => void;
  onRefresh?: () => Promise<void>;
  onFinally?: () => void;
}) {
  const { request, successMessage, staleMessage, errorLabel, onDeleted, onRefresh, onFinally } = options;
  try {
    await request;
    onDeleted?.();
    toast.success(successMessage);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      toast.info(staleMessage);
      return false;
    }
    if (error instanceof ApiError) {
      if (error.status === 401) {
        toast.error("登录已过期，请重新登录");
        return false;
      }
      if (error.status === 403) {
        toast.error("当前账号无权限执行该操作");
        return false;
      }
      toast.error(`${errorLabel}失败：${error.message || "操作失败"}`);
      return false;
    }
    toast.error(`${errorLabel}失败：系统异常，请稍后重试`);
    return false;
  } finally {
    onFinally?.();
    if (onRefresh) {
      await onRefresh();
    }
  }
}

export function openAdminConfirm(options: Omit<AdminConfirmRequest, "kind" | "resolve">) {
  return adminDialogController?.openConfirm(options) ?? Promise.resolve(false);
}

export function openAdminPrompt(options: Omit<AdminPromptRequest, "kind" | "resolve">) {
  return adminDialogController?.openPrompt(options) ?? Promise.resolve<string | null>(null);
}

export function formatAdminEntityMessage(entity: string, value: unknown, suffix: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? `${entity}《${text}》${suffix}` : `${entity}${suffix}`;
}

export function useAdminRole() {
  const { user } = useSession();
  return hasAdminConsoleAccess(user?.role) ? (user?.role as AdminRole) : null;
}

export function DeleteConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认删除",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" onClick={onCancel} className={secondaryButtonClassName()}>
            取消
          </button>
          <button type="button" onClick={onConfirm} className={`${primaryButtonClassName()} !bg-rose-600 hover:!bg-rose-700`}>
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "保存",
  contentClassName,
  bodyClassName,
  onSubmit,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={formDialogContentClassName(contentClassName)}>
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={formDialogBodyClassName(bodyClassName)}>
          <div className="space-y-4">{children}</div>
        </div>
        <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4 bg-white">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>
            取消
          </button>
          <button type="button" onClick={() => void onSubmit()} className={primaryButtonClassName()}>
            {submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-bold text-slate-700">{label}</div>
      {children}
    </label>
  );
}

export function AdminFormSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function AdminTableSwitch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      <span className={`text-xs font-bold ${checked ? "text-emerald-600" : "text-slate-400"}`}>
        {checked ? "已启用" : "未启用"}
      </span>
    </div>
  );
}

export function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

export function isEditableUserRole(value: unknown): value is AdminEditableUserRole {
  return value === "admin" || value === "moderator" || value === "user";
}

export function defaultUserForm(): AdminUserForm {
  return { username: "", email: "", password: "", role: "user", status: 0 };
}

export function defaultNotificationForm(): AdminNotificationForm {
  return { title: "", content: "", type: "system", status: "draft", targetType: "all", targetRoles: "", attachments: "" };
}

export function defaultQuestionCategoryForm(): QuestionCategoryForm {
  return { name: "", description: "", groupName: "", sortOrder: 0, enabled: true };
}

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

export function defaultPointsRuleForm(defaultType = "daily"): PointsRuleForm {
  return { name: "", description: "", taskKey: "", points: 0, type: defaultType, enabled: true, userVisible: true, sortOrder: 0 };
}

export function defaultPointsOptionForm(kind: PointsOptionKind): PointsOptionForm {
  return { kind, value: "", label: "", sortOrder: 0 };
}

export function buildAdminOptionChoices(
  source: PointsOptionRecord[] | undefined,
  fallback: AdminOptionChoiceInput[],
  currentValue?: unknown,
) {
  const sourceItems: AdminOptionChoiceInput[] = source && source.length > 0 ? source : fallback;
  const normalizedSource = sourceItems.map((item) => ({
    value: String(item.value ?? item.optionValue ?? "").trim(),
    label: String(item.label ?? item.value ?? item.optionValue ?? "").trim(),
  })).filter((item) => item.value);
  const normalizedCurrent = String(currentValue ?? "").trim();
  if (!normalizedCurrent) return normalizedSource;
  return normalizedSource.some((item) => item.value === normalizedCurrent)
    ? normalizedSource
    : [...normalizedSource, { value: normalizedCurrent, label: normalizedCurrent }];
}

export function buildAdminOptionLabelMap(options: Array<{ value: string; label: string }>) {
  return new Map(options.map((item) => [item.value, item.label]));
}

export function generateMachineIdentifier(label: unknown, prefix: string, existingValues: string[]) {
  const normalizedLabel = String(label || "").trim().toLowerCase();
  const asciiChars = normalizedLabel
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .split("")
    .flatMap((char) => {
      if (/[a-z0-9]/.test(char)) return [char];
      if (char === "_") return ["_"];
      if (/[\u4e00-\u9fa5]/.test(char)) return [`u${char.codePointAt(0)?.toString(16) || ""}`];
      return [];
    })
    .join("_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const base = asciiChars || prefix;
  const safePrefix = prefix.replace(/[^a-z0-9_]/g, "_") || "id";
  const seed = /^[a-z]/.test(base) ? base : `${safePrefix}_${base}`;
  const used = new Set(existingValues.map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (!used.has(seed)) return seed;
  let index = 2;
  while (used.has(`${seed}_${index}`)) {
    index += 1;
  }
  return `${seed}_${index}`;
}
