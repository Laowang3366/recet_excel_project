import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  LoaderCircle,
  Lock,
  Menu,
  MessageSquare,
  MousePointer2,
  Plus,
  RefreshCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud,
  UserCog,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api, ApiError } from "../lib/api";
import {
  buildWorkbookWithAnswerSnapshot,
  clearDynamicArraySpillChildren,
  columnIndexToLabel,
  detectFormulaAnswerRegion,
  extractRangeAnswerSnapshot,
  findMissingFormulaCellRefs,
  formatAnswerPreviewCellDisplay,
  ExcelRangeSelection,
  ExcelWorkbookSnapshot,
  DynamicArrayHydrationRule,
  normalizeSelection,
  parseRangeRef,
  selectionToRangeRef,
  toCellRef,
} from "../lib/excel";
import { adminKeys, practiceKeys } from "../lib/query-keys";
import { useSession } from "../lib/session";
import {
  canAccessAdminPath,
  getAdminModulesForRole,
  getDefaultAdminPath,
  hasAdminConsoleAccess,
  type AdminRole,
} from "../admin/config";
import {
  getAdminAvatarSrc,
  getAdminSidebarClassName,
  getAdminSidebarOverlayClassName,
} from "../admin/display";
import {
  AddButton,
  AdminEmptyState,
  AdminPageShell,
  AdminPagination,
  AdminSection,
  AdminStatCard,
  AdminStatGrid,
  FilterBar,
  FilterField,
  formatMaybeDate,
  formatAdminRole,
  formatAdminStatus,
  formatExperienceBizType,
  formatRoleList,
  formatNotificationTarget,
  formatNotificationType,
  EXPERIENCE_BIZ_TYPE_OPTIONS,
  NOTIFICATION_TARGET_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
  formatPointsTaskKey,
  formatPointsRuleType,
  formatQuestionType,
  POINTS_RULE_TYPE_OPTIONS,
  POINTS_TASK_KEY_OPTIONS,
  ROLE_OPTIONS,
  answerRangeButtonClassName,
  formDialogBodyClassName,
  formDialogContentClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  statusBadgeClassName,
  inputClassName,
  textareaClassName,
} from "../admin/shared";

const ExcelWorkbookEditor = lazy(() =>
  import("../components/ExcelWorkbookEditor").then((module) => ({ default: module.ExcelWorkbookEditor }))
);

type AdminStatsGroup = Record<string, number | undefined>;

type AdminStatsPayload = {
  overview?: AdminStatsGroup;
  users?: AdminStatsGroup;
  moderation?: AdminStatsGroup;
  practice?: AdminStatsGroup;
  pointsAndLevels?: AdminStatsGroup;
  notifications?: AdminStatsGroup;
  userCount?: number;
  pendingFeedback?: number;
};

type PagedAdminResponse<T> = {
  records: T[];
  total: number;
};

type AdminEditableUserRole = "admin" | "moderator" | "user";

type AdminUserForm = {
  username: string;
  email: string;
  password: string;
  role: AdminEditableUserRole;
  status: number;
};

type AdminUserRecord = {
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

type AdminUserToggleResponse = {
  locked?: boolean;
  muted?: boolean;
};

type AdminNotificationForm = {
  title: string;
  content: string;
  type: string;
  status: string;
  targetType: string;
  targetRoles: string;
  attachments: string;
};

type AdminNotificationRecord = AdminNotificationForm & {
  id: number;
  createTime?: string | null;
};

type AdminNotificationStats = {
  total?: number;
  sent?: number;
  draft?: number;
  totalUsers?: number;
};

type QuestionCategoryForm = {
  name: string;
  description: string;
  groupName: string;
  sortOrder: number | string;
  enabled: boolean;
};

type QuestionCategoryRecord = QuestionCategoryForm & {
  id: number;
  questionCount?: number;
};

type DailyChallengeForm = {
  challengeDate: string;
  levelId: string;
  rewardExp: string | number;
  rewardPoints: string | number;
  enabled: boolean;
};

type PracticeCampaignLevelRecord = {
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

type LevelConfigForm = {
  levelType: string;
  difficulty: string;
  targetTimeSeconds: string;
  rewardExp: string;
  rewardPoints: string;
  firstPassBonus: string;
  enabled: boolean;
};

type QuestionGradingMode = "simple" | "dynamic_array";

type QuestionDynamicArrayRuleForm = DynamicArrayHydrationRule & {
  score: number | string;
  label: string;
  formulaKeywordsText: string;
  requireAnchorFormula: boolean;
  requireSpillCellsWithoutFormula: boolean;
};

type AdminQuestionForm = {
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

type AdminQuestionRecord = Partial<AdminQuestionForm> & {
  id: number;
  title: string;
  type?: string | null;
  categoryId?: number | string | null;
  questionCategoryId?: number | string | null;
  questionCategoryName?: string | null;
  expectedSnapshotJson?: string | null;
};

type AdminQuestionsResponse = {
  questions: AdminQuestionRecord[];
  total: number;
};

type PointsRuleForm = {
  name: string;
  description: string;
  taskKey: string;
  points: string | number;
  type: string;
  enabled: boolean;
  userVisible: boolean;
  sortOrder: string | number;
};

type PointsRuleRecord = PointsRuleForm & {
  id: number;
};

type PointsOptionKind = "type" | "task_key";

type PointsOptionForm = {
  kind: PointsOptionKind;
  value: string;
  label: string;
  sortOrder: string | number;
};

type PointsOptionRecord = PointsOptionForm & {
  id: number;
  optionValue?: string | null;
  usageCount?: number;
};

type AdminOptionChoiceInput = {
  value?: string | null;
  optionValue?: string | null;
  label?: string | null;
};

type PointsStatsResponse = {
  activeUsers?: number;
  totalPoints?: number;
  todayPoints?: number;
};

type PointsOptionsResponse = {
  types: PointsOptionRecord[];
  taskKeys: PointsOptionRecord[];
};

type PointsRecord = {
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

type PointsGrantResponse = {
  username?: string | null;
  points?: number;
};

type LevelRuleForm = {
  level: string;
  name: string;
  threshold: string;
  enabled: boolean;
};

type LevelRuleRecord = {
  level: number;
  name?: string | null;
  threshold?: number;
  enabled?: boolean;
};

type ExpRuleForm = {
  key: string;
  name: string;
  description: string;
  minExp: string;
  maxExp: string;
  maxObtainCount: string;
  enabled: boolean;
};

type ExpRuleRecord = {
  key: string;
  label?: string | null;
  description?: string | null;
  minExp?: number;
  maxExp?: number;
  maxObtainCount?: number | null;
  enabled?: boolean;
  rangeText?: string | null;
};

type LevelsOverviewResponse = {
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

type LevelUserRecord = {
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

type ExpLogRecord = {
  id: number;
  user?: { username?: string | null } | null;
  bizLabel?: string | null;
  bizType?: string | null;
  expChange?: number;
  reason?: string | null;
  createTime?: string | null;
};

type FormDialogProps = {
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

type AdminConfirmRequest = {
  kind: "confirm";
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
};

type AdminPromptRequest = {
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

type AdminFeedbackRequest = {
  kind: "feedback";
  type: "success" | "error";
  title?: string;
  message: string;
  confirmLabel?: string;
  durationMs?: number;
};

type AdminDialogRequest = AdminConfirmRequest | AdminPromptRequest | AdminFeedbackRequest;
type AdminDialogController = {
  showFeedback: (request: AdminFeedbackRequest) => void;
  openConfirm: (options: Omit<AdminConfirmRequest, "kind" | "resolve">) => Promise<boolean>;
  openPrompt: (options: Omit<AdminPromptRequest, "kind" | "resolve">) => Promise<string | null>;
};

let adminDialogController: AdminDialogController | null = null;

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading } = useSession();
  const role = hasAdminConsoleAccess(user?.role) ? (user?.role as AdminRole) : null;
  const modules = useMemo(() => getAdminModulesForRole(role), [role]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
      return;
    }
    if (!hasAdminConsoleAccess(user?.role)) {
      navigate("/", { replace: true });
      return;
    }
    if (!canAccessAdminPath(user?.role, location.pathname)) {
      navigate(getDefaultAdminPath(user?.role), { replace: true });
    }
  }, [isAuthenticated, loading, location.pathname, navigate, user?.role]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  if (loading || !isAuthenticated || !role) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] lg:grid lg:grid-cols-[208px_minmax(0,1fr)]">
      <button
        type="button"
        aria-label="关闭后台导航"
        onClick={() => setIsMobileNavOpen(false)}
        className={getAdminSidebarOverlayClassName(isMobileNavOpen)}
      />
      <aside className={getAdminSidebarClassName(isMobileNavOpen)}>
        <div className="h-16 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#1677ff] text-white">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-white">Excel社区</div>
              <div className="text-xs text-white/45">Admin Console</div>
            </div>
            <button
              type="button"
              aria-label="关闭后台导航"
              onClick={() => setIsMobileNavOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <div className="mb-2 px-5 text-[11px] font-black uppercase tracking-[0.22em] text-white/35">模块导航</div>
          <div className="space-y-0.5">
              {modules.map((module) => {
                const isActive = location.pathname === module.path;
                const Icon = module.icon;
                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => {
                      navigate(module.path);
                      setIsMobileNavOpen(false);
                    }}
                    className={`group relative flex h-10 w-full items-center gap-3 px-5 text-left transition ${
                      isActive
                        ? "bg-[#1677ff] font-medium text-white"
                        : "text-white/65 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-[#69c0ff]" />}
                    <Icon size={16} className={isActive ? "text-white" : "text-white/45 group-hover:text-white/80"} />
                    <div className="min-w-0 text-sm">{module.label}</div>
                  </button>
                );
              })}
              </div>
          </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[#f0f0f0] bg-white shadow-[0_1px_4px_rgba(0,21,41,0.08)]">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-label="打开后台导航"
                onClick={() => setIsMobileNavOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-[#d9d9d9] bg-white text-[#595959] transition hover:border-[#4096ff] hover:text-[#1677ff] lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0 truncate text-[18px] font-medium text-[#262626]">站点管理后台</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2">
                <img
                  src={getAdminAvatarSrc(user)}
                  alt={user?.username || "admin"}
                  className="h-8 w-8 rounded-full border border-[#f0f0f0] object-cover"
                />
                <div className="hidden leading-tight sm:block">
                  <div className="text-sm font-medium text-[#262626]">{user?.username}</div>
                  <div className="text-xs text-[#8c8c8c]">{role === "admin" ? "管理员" : "运营"}</div>
                </div>
              </div>
              <Link to="/" className={secondaryButtonClassName()}>
                <ArrowLeft size={16} />
                返回站点
              </Link>
            </div>
          </div>
        </header>

        <div className="px-4 py-4 md:px-6 md:py-5">
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
      <AdminDialogHost />
    </div>
  );
}

export function AdminIndex() {
  const navigate = useNavigate();
  const { user } = useSession();

  useEffect(() => {
    navigate(getDefaultAdminPath(user?.role), { replace: true });
  }, [navigate, user?.role]);

  return null;
}

export function AdminOverview() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const statsQuery = useQuery({
    queryKey: adminKeys.stats(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest(api.get<{ stats: AdminStatsPayload }>("/api/admin/stats", { silent: true }), navigate, role);
      return result?.stats || null;
    },
  });
  const stats = statsQuery.data;
  const overviewStats = stats?.overview || {};
  const userStats = stats?.users || {};
  const moderationStats = stats?.moderation || {};
  const practiceStats = stats?.practice || {};
  const pointsStats = stats?.pointsAndLevels || {};

  const focusMetrics = [
    { label: "在线用户", value: overviewStats.onlineUsers ?? 0, hint: `管理员 ${userStats.admins ?? 0} / 运营 ${userStats.operators ?? userStats.moderators ?? 0}`, icon: Users, tone: "teal" },
    { label: "今日新增用户", value: overviewStats.todayNewUsers ?? 0, hint: `锁定 ${userStats.locked ?? 0} · 禁言 ${userStats.muted ?? 0}`, icon: UserCog, tone: "blue" },
    { label: "今日签到", value: overviewStats.todayCheckins ?? 0, hint: `练习记录 ${practiceStats.practiceRecords ?? 0}`, icon: CalendarCheck, tone: "amber" },
    { label: "待处理事项", value: (moderationStats.pendingFeedback ?? 0) + (moderationStats.pendingPracticeSubmissions ?? 0), hint: `反馈 ${moderationStats.pendingFeedback ?? 0} · 试题投稿 ${moderationStats.pendingPracticeSubmissions ?? 0}`, icon: ShieldAlert, tone: "rose" },
  ] as const;

  return (
    <AdminPageShell title="后台总览" description="集中查看本站核心数据、业务状态和待处理事项。">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#eff6ff,transparent_38%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#f1f5f9_100%)] p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-sky-700">
              <Sparkles size={14} />
              Dashboard
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">学习平台运营总览</h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              按用户、通知、题库、练习、积分和 AI 助手配置相关入口查看核心状态，优先暴露今日变化和待处理事项。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px]">
            {focusMetrics.map((item) => (
              <OverviewMetricCard key={item.label} {...item} />
            ))}
          </div>
        </div>
      </section>

      <AdminSection title="用户与通知概览">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewDataCard label="注册用户" value={userStats.total ?? stats?.userCount ?? 0} hint={`在线 ${userStats.online ?? 0}`} />
          <OverviewDataCard label="管理账号" value={`${userStats.admins ?? 0} / ${userStats.operators ?? userStats.moderators ?? 0}`} hint="管理员 / 运营" />
          <OverviewDataCard label="账号状态" value={`${userStats.locked ?? 0} / ${userStats.muted ?? 0}`} hint="锁定 / 禁言" />
          <OverviewDataCard label="站内通知" value={stats?.notifications?.total ?? 0} hint={`未读 ${stats?.notifications?.unread ?? 0} · 公告 ${stats?.notifications?.siteNotifications ?? 0}`} />
        </div>
      </AdminSection>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminSection title="练习与题库">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OverviewDataCard label="题目总数" value={practiceStats.questions ?? 0} hint={`启用 ${practiceStats.enabledQuestions ?? 0}`} />
            <OverviewDataCard label="题目分类" value={practiceStats.questionCategories ?? 0} hint={`模板 ${practiceStats.questionTemplates ?? 0}`} />
            <OverviewDataCard label="练习记录" value={practiceStats.practiceRecords ?? 0} hint={`答案 ${practiceStats.practiceAnswers ?? 0}`} />
            <OverviewDataCard label="用户投稿" value={practiceStats.submissions ?? 0} hint={`完成 ${practiceStats.completedSubmissions ?? 0} · 驳回 ${practiceStats.rejectedSubmissions ?? 0}`} />
          </div>
        </AdminSection>

        <AdminSection title="审核与待办">
          <div className="space-y-3">
            <OverviewProgressRow label="试题投稿待审核" value={moderationStats.pendingPracticeSubmissions ?? 0} tone="sky" />
            <OverviewProgressRow label="反馈待处理" value={moderationStats.pendingFeedback ?? stats?.pendingFeedback ?? 0} tone="teal" />
            <OverviewProgressRow label="反馈已处理 / 忽略" value={`${moderationStats.handledFeedback ?? 0} / ${moderationStats.ignoredFeedback ?? 0}`} tone="slate" textValue />
          </div>
        </AdminSection>
      </div>

      <AdminSection title="积分与等级">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewDataCard label="积分规则" value={pointsStats.pointsRules ?? 0} hint={`启用 ${pointsStats.enabledPointsRules ?? 0}`} />
          <OverviewDataCard label="积分记录" value={pointsStats.pointsRecords ?? 0} hint={`规则选项 ${pointsStats.pointsOptions ?? 0}`} />
          <OverviewDataCard label="经验规则 / 等级" value={`${pointsStats.expRules ?? 0} / ${pointsStats.levelRules ?? 0}`} hint={`经验日志 ${pointsStats.expLogs ?? 0}`} />
          <OverviewDataCard label="用户权益" value={pointsStats.entitlements ?? 0} />
        </div>
      </AdminSection>
    </AdminPageShell>
  );
}

function OverviewMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone: "teal" | "blue" | "amber" | "rose";
}) {
  const toneMap = {
    teal: "from-teal-500/12 via-white to-teal-50 text-teal-700",
    blue: "from-sky-500/12 via-white to-sky-50 text-sky-700",
    amber: "from-amber-500/12 via-white to-amber-50 text-amber-700",
    rose: "from-rose-500/12 via-white to-rose-50 text-rose-700",
  }[tone];

  return (
    <div className={`rounded-3xl border border-white/70 bg-gradient-to-br px-5 py-4 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.4)] ${toneMap}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</div>
          {hint ? <div className="mt-2 text-xs font-medium text-slate-500">{hint}</div> : null}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function OverviewDataCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-4">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-900">{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function OverviewProgressRow({
  label,
  value,
  tone,
  textValue = false,
}: {
  label: string;
  value: React.ReactNode;
  tone: "amber" | "sky" | "rose" | "teal" | "slate";
  textValue?: boolean;
}) {
  const toneMap = {
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    rose: "bg-rose-500",
    teal: "bg-teal-500",
    slate: "bg-slate-500",
  }[tone];
  const numericValue = typeof value === "number" ? value : 0;
  const width = textValue ? 100 : Math.min(100, Math.max(8, numericValue * 8));
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-black text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${toneMap}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function AdminUsers() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRecord | null>(null);
  const [pendingRemove, setPendingRemove] = useState<AdminUserRecord | null>(null);
  const [form, setForm] = useState<AdminUserForm>(defaultUserForm());
  const size = 10;
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (keyword.trim()) query.set("keyword", keyword.trim());
  if (roleFilter) query.set("role", roleFilter);
  if (statusFilter) query.set("status", statusFilter);
  const queryString = query.toString();

  const usersQuery = useQuery({
    queryKey: adminKeys.users({ page, size, keyword: keyword.trim(), role: roleFilter, status: statusFilter }),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PagedAdminResponse<AdminUserRecord>>(api.get(`/api/admin/users?${queryString}`, { silent: true }), navigate, role);
      return result || { records: [], total: 0 };
    },
  });

  const records = usersQuery.data?.records || [];
  const total = usersQuery.data?.total || 0;
  const refreshUsers = () =>
    queryClient.invalidateQueries({ queryKey: adminKeys.users({ page, size, keyword: keyword.trim(), role: roleFilter, status: statusFilter }) }).then(() => undefined);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultUserForm());
    setOpen(true);
  };

  const openEdit = (item: AdminUserRecord) => {
    setEditing(item);
    setForm({
      username: item.username || "",
      email: item.email || "",
      password: "",
      role: isEditableUserRole(item.role) ? item.role : "user",
      status: Number(item.status ?? 0),
    });
    setOpen(true);
  };

  const submit = async () => {
    const payload: Partial<AdminUserForm> = {
      email: form.email,
      role: form.role,
      status: Number(form.status),
    };
    if (editing) {
      const result = await adminRequest<AdminUserRecord>(api.put(`/api/admin/users/${editing.id}`, payload), navigate, role, "更新用户");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("用户", editing.username || result?.username || form.username, "已更新"));
    } else {
      payload.username = form.username;
      payload.password = form.password;
      const result = await adminRequest<AdminUserRecord>(api.post("/api/admin/users", payload), navigate, role, "创建用户");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("用户", result?.username || form.username, "已创建"));
    }
    await refreshUsers();
  };

  const resetPassword = async (item: AdminUserRecord) => {
    const password = await openAdminPrompt({
      title: "重置用户密码",
      message: `为 ${item.username} 设置新的登录密码。`,
      label: "新密码",
      defaultValue: "123456",
      confirmLabel: "确认重置",
      required: true,
    });
    if (!password) return;
    const result = await adminRequest(api.put(`/api/admin/users/${item.id}/password`, { password }), navigate, role, "重置用户密码");
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("用户", item.username, "密码已重置"));
  };

  const remove = (item: AdminUserRecord) => {
    setPendingRemove(item);
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    const item = pendingRemove;
    await runAdminDelete({
      request: api.delete(`/api/admin/users/${item.id}`),
      successMessage: formatAdminEntityMessage("用户", item.username, "已删除"),
      staleMessage: `用户《${item.username}》不存在，列表已刷新`,
      errorLabel: "删除用户",
      onRefresh: refreshUsers,
      onFinally: () => setPendingRemove(null),
    });
  };

  const toggleLock = async (item: AdminUserRecord) => {
    const result = await adminRequest<AdminUserToggleResponse>(api.put(`/api/admin/users/${item.id}/lock`, {}), navigate, role, item.status === 1 ? "解除用户锁定" : "锁定用户");
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("用户", item.username, result.locked ? "已锁定" : "已解锁"));
    await refreshUsers();
  };

  const toggleMute = async (item: AdminUserRecord) => {
    const result = await adminRequest<AdminUserToggleResponse>(api.put(`/api/admin/users/${item.id}/mute`, {}), navigate, role, item.isMuted ? "解除用户禁言" : "禁言用户");
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("用户", item.username, result.muted ? "已禁言" : "已解除禁言"));
    await refreshUsers();
  };

  return (
    <AdminPageShell
      title="用户管理"
      description="管理用户账号、角色与状态。"
    >
      <AdminSection title="用户列表" actions={<AddButton onClick={openCreate}>新建用户</AddButton>}>
        <FilterBar>
          <FilterField label="关键词">
            <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} className={inputClassName()} placeholder="用户名 / 邮箱" />
          </FilterField>
          <FilterField label="角色">
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className={inputClassName()}>
              <option value="">全部</option>
              <option value="user">用户</option>
              <option value="moderator">运营</option>
              <option value="admin">管理员</option>
            </select>
          </FilterField>
          <FilterField label="状态">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={inputClassName()}>
              <option value="">全部</option>
              <option value="0">正常</option>
              <option value="1">已锁定</option>
            </select>
          </FilterField>
        </FilterBar>

        <div className="mt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>等级 / 积分</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img src={getAdminAvatarSrc(item)} alt={item.username} className="h-10 w-10 rounded-xl object-cover" />
                      <div>
                        <div className="font-bold text-slate-800">{item.username}</div>
                        <div className="text-xs text-slate-400">{item.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatAdminRole(item.role)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <span className={statusBadgeClassName(item.status === 1 ? "locked" : "active")}>{item.status === 1 ? "已锁定" : "正常"}</span>
                      {item.isMuted ? <span className={statusBadgeClassName("pending")}>已禁言</span> : null}
                    </div>
                  </TableCell>
                  <TableCell>Lv.{item.level || 1} / {item.points || 0}</TableCell>
                  <TableCell>{formatMaybeDate(item.createTime)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openEdit(item)} className={secondaryButtonClassName()}><Edit3 size={14} />编辑</button>
                      <button type="button" onClick={() => resetPassword(item)} className={secondaryButtonClassName()}><UserCog size={14} />密码</button>
                      <button type="button" onClick={() => void toggleLock(item)} className={item.status === 1 ? primaryButtonClassName() : secondaryButtonClassName()}><Lock size={14} />{item.status === 1 ? "解锁" : "锁定"}</button>
                      <button type="button" onClick={() => void toggleMute(item)} className={item.isMuted ? primaryButtonClassName() : secondaryButtonClassName()}><MessageSquare size={14} />{item.isMuted ? "解除禁言" : "禁言"}</button>
                      <button type="button" onClick={() => remove(item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {records.length === 0 && <AdminEmptyState message="暂无用户数据。" />}
          <div className="mt-4">
            <AdminPagination current={page} size={size} total={total} onChange={setPage} />
          </div>
        </div>
      </AdminSection>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "编辑用户" : "新建用户"}
        description={editing ? "修改邮箱、角色和状态。" : "创建新的管理或普通账号。"}
        submitLabel={editing ? "保存修改" : "创建用户"}
        onSubmit={submit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {!editing && (
            <Field label="用户名">
              <input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} className={inputClassName()} />
            </Field>
          )}
          <Field label="邮箱">
            <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className={inputClassName()} />
          </Field>
          {!editing && (
            <Field label="初始密码">
              <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} className={inputClassName()} />
            </Field>
          )}
          <Field label="角色">
            <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as AdminEditableUserRole }))} className={inputClassName()}>
              <option value="user">用户</option>
              <option value="moderator">运营</option>
              <option value="admin">管理员</option>
            </select>
          </Field>
          <Field label="状态">
            <select value={String(form.status)} onChange={(e) => setForm((prev) => ({ ...prev, status: Number(e.target.value) }))} className={inputClassName()}>
              <option value="0">正常</option>
              <option value="1">已锁定</option>
            </select>
          </Field>
        </div>

      </FormDialog>
      <DeleteConfirmDialog
        open={Boolean(pendingRemove)}
        title="删除用户"
        message={pendingRemove ? `确认删除用户 ${pendingRemove.username}？删除后无法恢复。` : ""}
        confirmLabel="确认删除"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => void confirmRemove()}
      />
    </AdminPageShell>
  );
}

export function AdminNotifications() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminNotificationRecord | null>(null);
  const [pendingRemove, setPendingRemove] = useState<AdminNotificationRecord | null>(null);
  const [form, setForm] = useState<AdminNotificationForm>(defaultNotificationForm());
  const size = 10;
  const statsQuery = useQuery({
    queryKey: adminKeys.notificationsStats(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<AdminNotificationStats>(api.get("/api/admin/notifications/stats", { silent: true }), navigate, role);
      return result || null;
    },
  });
  const notificationsQuery = useQuery({
    queryKey: adminKeys.notifications({ page, size }),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PagedAdminResponse<AdminNotificationRecord>>(api.get(`/api/admin/notifications?page=${page}&size=${size}`, { silent: true }), navigate, role);
      return result || { records: [], total: 0 };
    },
  });
  const stats = statsQuery.data;
  const records = notificationsQuery.data?.records || [];
  const total = notificationsQuery.data?.total || 0;

  const openCreate = () => {
    setEditing(null);
    setForm(defaultNotificationForm());
    setOpen(true);
  };

  const openEdit = (item: AdminNotificationRecord) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      content: item.content || "",
      type: item.type || "system",
      status: item.status || "draft",
      targetType: item.targetType || "all",
      targetRoles: item.targetRoles || "",
      attachments: item.attachments || "",
    });
    setOpen(true);
  };

  const submit = async () => {
    const payload = { ...form };
    if (editing) {
      const result = await adminRequest<AdminNotificationRecord>(api.put(`/api/admin/notifications/${editing.id}`, payload), navigate, role, "更新通知");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("通知", editing.title || result?.title || form.title, "已更新"));
    } else {
      const result = await adminRequest<AdminNotificationRecord>(api.post("/api/admin/notifications", payload), navigate, role, "创建通知");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("通知", result?.title || form.title, "已创建"));
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.notificationsStats() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.notifications({ page, size }) }),
    ]);
  };

  const sendNow = async (item: AdminNotificationRecord) => {
    const result = await adminRequest(api.put(`/api/admin/notifications/${item.id}/send`, {}), navigate, role, "发送通知");
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("通知", item.title, "已发送"));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.notificationsStats() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.notifications({ page, size }) }),
    ]);
  };

  const remove = (item: AdminNotificationRecord) => {
    setPendingRemove(item);
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    const item = pendingRemove;
    await runAdminDelete({
      request: api.delete(`/api/admin/notifications/${item.id}`),
      successMessage: formatAdminEntityMessage("通知", item.title, "已删除"),
      staleMessage: `通知《${item.title}》不存在，列表已刷新`,
      errorLabel: "删除通知",
      onRefresh: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminKeys.notificationsStats() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.notifications({ page, size }) }),
        ]);
      },
      onFinally: () => setPendingRemove(null),
    });
  };

  return (
    <AdminPageShell
      title="站内通知"
      description="创建、编辑并发送面向全站或指定角色的站内公告。"
    >
      <AdminStatGrid>
        <AdminStatCard label="通知总数" value={stats?.total ?? "-"} />
        <AdminStatCard label="已发送" value={stats?.sent ?? "-"} />
        <AdminStatCard label="草稿" value={stats?.draft ?? "-"} />
        <AdminStatCard label="站内用户" value={stats?.totalUsers ?? "-"} />
      </AdminStatGrid>

      <AdminSection title="通知列表" actions={<AddButton onClick={openCreate}>新建通知</AddButton>}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>发送目标</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-[320px]">
                  <div className="font-bold text-slate-800">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-400 line-clamp-2">{item.content}</div>
                </TableCell>
                <TableCell>{formatNotificationType(item.type)}</TableCell>
                <TableCell>{formatNotificationTarget(item.targetType || "all")}{item.targetRoles ? ` / ${formatRoleList(item.targetRoles)}` : ""}</TableCell>
                <TableCell><span className={statusBadgeClassName(item.status)}>{formatAdminStatus(item.status)}</span></TableCell>
                <TableCell>{formatMaybeDate(item.createTime)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEdit(item)} className={secondaryButtonClassName()}><Edit3 size={14} />编辑</button>
                    {item.status !== "sent" && (
                      <button type="button" onClick={() => sendNow(item)} className={primaryButtonClassName()}><Send size={14} />发送</button>
                    )}
                    <button type="button" onClick={() => remove(item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {records.length === 0 && <AdminEmptyState message="暂无通知。" />}
        <div className="mt-4">
          <AdminPagination current={page} size={size} total={total} onChange={setPage} />
        </div>
      </AdminSection>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "编辑通知" : "新建通知"}
        description="填写通知内容与发送对象。"
        submitLabel={editing ? "保存通知" : "创建通知"}
        onSubmit={submit}
      >
        <Field label="标题"><input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className={inputClassName()} /></Field>
        <Field label="内容"><textarea value={form.content} onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))} className={textareaClassName()} /></Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="类型">
            <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))} className={inputClassName()}>
              {NOTIFICATION_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="状态">
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className={inputClassName()}>
              <option value="draft">草稿</option>
              <option value="sent">已发送</option>
            </select>
          </Field>
          <Field label="发送目标">
            <select value={form.targetType} onChange={(e) => setForm((prev) => ({ ...prev, targetType: e.target.value }))} className={inputClassName()}>
              {NOTIFICATION_TARGET_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
        </div>
        {form.targetType === "role" && (
          <Field label="目标角色">
            <div className="grid gap-3 md:grid-cols-3">
              {ROLE_OPTIONS.map((item) => {
                const selected = String(form.targetRoles || "").split(",").map((value) => value.trim()).filter(Boolean);
                const checked = selected.includes(item.value);
                return (
                  <label key={item.value} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) {
                          next.add(item.value);
                        } else {
                          next.delete(item.value);
                        }
                        setForm((prev) => ({ ...prev, targetRoles: Array.from(next).join(",") }));
                      }}
                    />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </Field>
        )}
        <Field label="附件 JSON / 链接">
          <textarea value={form.attachments} onChange={(e) => setForm((prev) => ({ ...prev, attachments: e.target.value }))} className={textareaClassName()} />
        </Field>
      </FormDialog>
      <DeleteConfirmDialog
        open={Boolean(pendingRemove)}
        title="删除通知"
        message={pendingRemove ? `确认删除通知《${pendingRemove.title}》？` : ""}
        confirmLabel="确认删除"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => void confirmRemove()}
      />
    </AdminPageShell>
  );
}

export function AdminQuestionCategories() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionCategoryRecord | null>(null);
  const [form, setForm] = useState<QuestionCategoryForm>(defaultQuestionCategoryForm());
  const questionCategoriesQuery = useQuery({
    queryKey: adminKeys.questionCategories(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<QuestionCategoryRecord[]>(api.get("/api/admin/question-categories", { silent: true }), navigate, role);
      return result || [];
    },
  });
  const records = questionCategoriesQuery.data || [];

  const openCreate = () => {
    setEditing(null);
    setForm(defaultQuestionCategoryForm());
    setOpen(true);
  };

  const openEdit = (item: QuestionCategoryRecord) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      description: item.description || "",
      groupName: item.groupName || "",
      sortOrder: Number(item.sortOrder || 0),
      enabled: item.enabled ?? true,
    });
    setOpen(true);
  };

  const submit = async () => {
    const payload = {
      name: form.name,
      description: form.description,
      groupName: form.groupName,
      sortOrder: Number(form.sortOrder || 0),
      enabled: Boolean(form.enabled),
    };
    if (editing) {
      const result = await adminRequest<QuestionCategoryRecord>(api.put(`/api/admin/question-categories/${editing.id}`, payload), navigate, role, "更新题目分类");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("题目分类", editing.name || result?.name || form.name, "已更新"));
    } else {
      const result = await adminRequest<QuestionCategoryRecord>(api.post("/api/admin/question-categories", payload), navigate, role, "创建题目分类");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("题目分类", result?.name || form.name, "已创建"));
    }
    await queryClient.invalidateQueries({ queryKey: adminKeys.questionCategories() });
  };

  const toggleEnabled = async (item: QuestionCategoryRecord, nextEnabled: boolean) => {
    const result = await adminRequest(
      api.put(`/api/admin/question-categories/${item.id}`, {
        name: item.name,
        description: item.description,
        groupName: item.groupName,
        sortOrder: Number(item.sortOrder || 0),
        enabled: nextEnabled,
      }),
      navigate,
      role,
      nextEnabled ? "启用题目分类" : "停用题目分类",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("题目分类", item.name, nextEnabled ? "已启用" : "已停用"));
    await queryClient.invalidateQueries({ queryKey: adminKeys.questionCategories() });
  };

  const remove = async (item: QuestionCategoryRecord) => {
    const confirmed = await openAdminConfirm({
      title: "删除题目分类",
      message: `确认删除题目分类 ${item.name}？`,
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (!confirmed) return;
    await runAdminDelete({
      request: api.delete(`/api/admin/question-categories/${item.id}`),
      successMessage: formatAdminEntityMessage("题目分类", item.name, "已删除"),
      staleMessage: `题目分类《${item.name}》不存在，列表已刷新`,
      errorLabel: "删除题目分类",
      onRefresh: () => queryClient.invalidateQueries({ queryKey: adminKeys.questionCategories() }).then(() => undefined),
    });
  };

  return (
    <AdminPageShell
      title="题目分类"
      description="维护练习题目分类，同时控制前台章节板块的名称、描述、排序与启用状态。"
    >
      <AdminSection title="分类列表" actions={<AddButton onClick={openCreate}>新增题目分类</AddButton>}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>分组</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>题目数</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                <TableCell>{item.groupName || "-"}</TableCell>
                <TableCell className="max-w-[320px] truncate">{item.description || "-"}</TableCell>
                <TableCell>{item.questionCount ?? 0}</TableCell>
                <TableCell>
                  <AdminTableSwitch
                    checked={Boolean(item.enabled)}
                    onCheckedChange={(next) => void toggleEnabled(item, next)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(item)} className={secondaryButtonClassName()}><Edit3 size={14} />编辑</button>
                    <button type="button" onClick={() => remove(item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {records.length === 0 && <AdminEmptyState message="暂无题目分类。" />}
      </AdminSection>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "编辑题目分类" : "新增题目分类"}
        description="分类名称、描述、排序和启用状态会同步到前台章节板块。"
        submitLabel={editing ? "保存分类" : "创建分类"}
        onSubmit={submit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="名称"><input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className={inputClassName()} /></Field>
          <Field label="分组"><input value={form.groupName} onChange={(e) => setForm((prev) => ({ ...prev, groupName: e.target.value }))} className={inputClassName()} /></Field>
        </div>
        <Field label="描述"><textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className={textareaClassName()} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="排序"><input type="number" value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))} className={inputClassName()} /></Field>
          <AdminFormSwitch
            label="启用该分类"
            checked={Boolean(form.enabled)}
            onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
          />
        </div>
      </FormDialog>
    </AdminPageShell>
  );
}

export function AdminQuestions() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [questionCategoryId, setQuestionCategoryId] = useState("");
  const [dailyChallengeForm, setDailyChallengeForm] = useState<DailyChallengeForm>({
    challengeDate: "",
    levelId: "",
    rewardExp: "",
    rewardPoints: "",
    enabled: true,
  });
  const [levelConfigOpen, setLevelConfigOpen] = useState(false);
  const [levelConfigEditing, setLevelConfigEditing] = useState<PracticeCampaignLevelRecord | null>(null);
  const [levelConfigForm, setLevelConfigForm] = useState<LevelConfigForm>({
    levelType: "normal",
    difficulty: "easy",
    targetTimeSeconds: "300",
    rewardExp: "10",
    rewardPoints: "5",
    firstPassBonus: "0",
    enabled: true,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminQuestionRecord | null>(null);
  const [form, setForm] = useState<AdminQuestionForm>(defaultQuestionForm());
  const [templateWorkbook, setTemplateWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [editorWorkbook, setEditorWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [selection, setSelection] = useState<ExcelRangeSelection | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState("");
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [isTemplateEditMode, setIsTemplateEditMode] = useState(true);
  const [isSelectingAnswerRange, setIsSelectingAnswerRange] = useState(false);
  const [formulaDetectionNotice, setFormulaDetectionNotice] = useState("");
  const [editorFullscreenVersion, setEditorFullscreenVersion] = useState(0);
  const editorSnapshotGetterRef = useRef<(() => ExcelWorkbookSnapshot | null) | null>(null);
  const size = 10;
  const query = new URLSearchParams({ page: String(page), size: String(size), type: "excel_template" });
  if (questionCategoryId) query.set("questionCategoryId", questionCategoryId);
  const queryString = query.toString();

  const questionsQuery = useQuery({
    queryKey: adminKeys.questions({ page, size, type: "excel_template", questionCategoryId }),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<AdminQuestionsResponse>(api.get(`/api/admin/questions?${queryString}`, { silent: true }), navigate, role);
      return result || { questions: [], total: 0 };
    },
  });

  const questionCategoriesQuery = useQuery({
    queryKey: adminKeys.questionCategories(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<QuestionCategoryRecord[]>(api.get("/api/admin/question-categories", { silent: true }), navigate, role);
      return result || [];
    },
  });

  const records = questionsQuery.data?.questions || [];
  const total = questionsQuery.data?.total || 0;
  const questionCategories = questionCategoriesQuery.data || [];
  const campaignLevelsQuery = useQuery({
    queryKey: adminKeys.practiceCampaignLevels(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PagedAdminResponse<PracticeCampaignLevelRecord>>(api.get("/api/admin/practice-campaign/levels", { silent: true }), navigate, role);
      return result || { records: [] };
    },
  });
  const campaignDailyQuery = useQuery({
    queryKey: adminKeys.practiceCampaignDaily(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<{ record?: Partial<DailyChallengeForm> & { levelId?: number | string | null } }>(api.get("/api/admin/practice-campaign/daily-challenge", { silent: true }), navigate, role);
      return result || { record: {} };
    },
  });
  const campaignLevels = campaignLevelsQuery.data?.records || [];

  useEffect(() => {
    const record = campaignDailyQuery.data?.record;
    if (!record) return;
    setDailyChallengeForm({
      challengeDate: record.challengeDate || "",
      levelId: record.levelId ? String(record.levelId) : "",
      rewardExp: record.rewardExp ?? "",
      rewardPoints: record.rewardPoints ?? "",
      enabled: record.enabled ?? true,
    });
  }, [campaignDailyQuery.data]);

  const resetEditorState = () => {
    setTemplateWorkbook({ sheets: [] });
    setEditorWorkbook({ sheets: [] });
    setSelectedSheetName("");
    setSelection(null);
    setTemplateLoadError("");
    setIsTemplateEditMode(true);
    setIsSelectingAnswerRange(false);
    setFormulaDetectionNotice("");
  };

  const loadTemplateWorkbook = async (
    fileUrl: string,
    answerSheet?: string | null,
    answerRange?: string | null,
    answerSnapshotJson?: string | null,
    dynamicArrayRules?: DynamicArrayHydrationRule[] | null,
  ) => {
    setTemplateLoading(true);
    setTemplateLoadError("");
    try {
      const snapshot = await adminRequest<ExcelWorkbookSnapshot>(
        api.get(`/api/admin/questions/template-snapshot?fileUrl=${encodeURIComponent(fileUrl)}`, { silent: true }),
        navigate,
        role,
      );
      if (!snapshot?.sheets?.length) {
        setTemplateWorkbook({ sheets: [] });
        setEditorWorkbook({ sheets: [] });
        setSelectedSheetName("");
        setSelection(null);
        setTemplateLoadError("模板加载失败，请稍后重试或重新上传模板。");
        return null;
      }
      const sheetName = answerSheet || snapshot.sheets?.[0]?.name || "";
      const workbookWithAnswer = buildWorkbookWithAnswerSnapshot(snapshot, answerSheet, answerRange, answerSnapshotJson, {
        dynamicArrayRules: Array.isArray(dynamicArrayRules) ? dynamicArrayRules : [],
      });
      setTemplateWorkbook(snapshot);
      setEditorWorkbook(workbookWithAnswer);
      setSelectedSheetName(sheetName);
      const parsedRange = answerRange ? parseRangeRef(answerRange) : null;
      setSelection(parsedRange && sheetName
        ? normalizeSelection(sheetName, parsedRange.startRow, parsedRange.startCol, parsedRange.endRow, parsedRange.endCol)
        : null);
      return snapshot as ExcelWorkbookSnapshot;
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "模板解析失败";
      setTemplateWorkbook({ sheets: [] });
      setEditorWorkbook({ sheets: [] });
      setSelectedSheetName("");
      setSelection(null);
      setTemplateLoadError(`模板加载失败：${message}`);
      showAdminError(`模板加载失败：${message}`);
      return null;
    } finally {
      setTemplateLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultQuestionForm());
    resetEditorState();
    setIsTemplateEditMode(true);
    setOpen(true);
  };

  const openEdit = async (item: AdminQuestionRecord) => {
    const dynamicArrayRules = parseDynamicArrayRulesFromJson(item.gradingRuleJson, item.answerSheet || "");
    const gradingMode = dynamicArrayRules.some((rule) => rule.anchorCell && rule.spillRange) ? "dynamic_array" : "simple";
    setFormulaDetectionNotice("");
    setEditing(item);
    setForm({
      title: item.title || "",
      questionCategoryId: item.questionCategoryId || "",
      difficulty: item.difficulty ?? 1,
      points: item.points ?? 0,
      explanation: item.explanation || "",
      enabled: item.enabled ?? true,
      templateFileUrl: item.templateFileUrl || "",
      answerSheet: item.answerSheet || "",
      answerRange: item.answerRange || "",
      answerSnapshotJson: item.answerSnapshotJson || "",
      checkFormula: item.checkFormula ?? false,
      gradingMode,
      dynamicArrayRules,
      gradingRuleJson: item.gradingRuleJson || "",
      sheetCountLimit: item.sheetCountLimit ?? 5,
      version: item.version ?? 1,
    });
    setIsTemplateEditMode(false);
    setIsSelectingAnswerRange(false);
    setOpen(true);
    if (item.templateFileUrl) {
      await loadTemplateWorkbook(item.templateFileUrl, item.answerSheet, item.answerRange, item.answerSnapshotJson, dynamicArrayRules);
    } else {
      resetEditorState();
    }
  };

  const submit = async () => {
    const primaryDynamicRule = Array.isArray(form.dynamicArrayRules) && form.dynamicArrayRules.length > 0
      ? form.dynamicArrayRules[0]
      : defaultDynamicArrayRule();
    const isDynamicArrayMode = form.gradingMode === "dynamic_array";
    const resolvedSheetName = isDynamicArrayMode
      ? (primaryDynamicRule.sheet || selectedSheetName || selection?.sheetName || "")
      : (form.answerSheet || selection?.sheetName || selectedSheetName);
    const resolvedRange = isDynamicArrayMode
      ? (primaryDynamicRule.spillRange || selectionToRangeRef(selection) || form.answerRange)
      : (isTemplateEditMode ? (selectionToRangeRef(selection) || form.answerRange) : form.answerRange);
    if (!form.templateFileUrl) {
      toast.error("请先上传 Excel 模板");
      return;
    }
    if (!resolvedSheetName) {
      toast.error("请选择答题工作表");
      return;
    }
    if (!resolvedRange) {
      toast.error("请先在表格中框选答题区域");
      return;
    }
    const normalizedDynamicRules = isDynamicArrayMode
      ? (form.dynamicArrayRules || []).map((item) => ({
        ...item,
        sheet: String(item?.sheet || "").trim(),
        anchorCell: String(item?.anchorCell || "").trim().toUpperCase(),
        spillRange: String(item?.spillRange || "").trim().toUpperCase(),
        score: Math.max(1, Number(item?.score || 1)),
      }))
      : [];
    if (isDynamicArrayMode) {
      if (normalizedDynamicRules.length === 0) {
        toast.error("请至少配置一条动态数组判题规则");
        return;
      }
      if (normalizedDynamicRules.some((item) => !item.sheet || !item.anchorCell || !item.spillRange)) {
        toast.error("动态数组规则必须填写工作表、锚点单元格和溢出区域");
        return;
      }
    }
    const latestWorkbook = editorSnapshotGetterRef.current?.() || editorWorkbook;
    if (latestWorkbook !== editorWorkbook) {
      setEditorWorkbook(latestWorkbook);
    }
    const answerSnapshot = extractRangeAnswerSnapshot(latestWorkbook, resolvedSheetName, resolvedRange);
    const hasEmptyAnswerCell = answerSnapshot.values.some((row) =>
      row.some((value) => String(value ?? "").trim().length === 0),
    );
    if (hasEmptyAnswerCell) {
      toast.error("标准答案存在空白单元格，请补全答题区域内的值");
      return;
    }
    const missingFormulaCells = !isDynamicArrayMode && Boolean(form.checkFormula)
      ? findMissingFormulaCellRefs(answerSnapshot, resolvedRange)
      : [];
    if (missingFormulaCells.length > 0) {
      const visibleCells = missingFormulaCells.slice(0, 6).join("、");
      const suffix = missingFormulaCells.length > 6 ? ` 等 ${missingFormulaCells.length} 个单元格` : "";
      toast.error(`检测函数公式已开启，${visibleCells}${suffix} 必须填写公式`);
      return;
    }
    const payload = {
      title: form.title,
      type: "excel_template",
      questionCategoryId: toNullableNumber(form.questionCategoryId),
      difficulty: Number(form.difficulty || 1),
      points: Number(form.points || 0),
      explanation: form.explanation,
      enabled: form.enabled,
      templateFileUrl: form.templateFileUrl,
      answerSheet: resolvedSheetName,
      answerRange: resolvedRange,
      answerSnapshotJson: JSON.stringify(answerSnapshot),
      checkFormula: isDynamicArrayMode ? Boolean(primaryDynamicRule.requireAnchorFormula) : Boolean(form.checkFormula),
      gradingRuleJson: isDynamicArrayMode ? buildDynamicArrayRuleJson(normalizedDynamicRules) : "",
      sheetCountLimit: Number(form.sheetCountLimit || 5),
      version: Number(form.version || 1),
    };
    const request = editing
      ? api.put<AdminQuestionRecord>(`/api/admin/questions/${editing.id}`, payload)
      : api.post<AdminQuestionRecord>("/api/admin/questions", payload);
    const result = await adminRequest(request, navigate, role, editing ? "更新题目" : "创建题目");
    if (!result) return;
    setOpen(false);
    showAdminSuccess(formatAdminEntityMessage("题目", editing?.title || result?.title || form.title, editing ? "已更新" : "已创建"));
    await queryClient.invalidateQueries({ queryKey: adminKeys.questions({ page, size, type: "excel_template", questionCategoryId }) });
  };

  const toggleEnabled = async (item: AdminQuestionRecord, nextEnabled: boolean) => {
    const result = await adminRequest(
      api.put(`/api/admin/questions/${item.id}`, {
        title: item.title,
        type: item.type || "excel_template",
        categoryId: item.categoryId,
        questionCategoryId: item.questionCategoryId,
        difficulty: item.difficulty,
        points: item.points,
        explanation: item.explanation,
        enabled: nextEnabled,
        templateFileUrl: item.templateFileUrl,
        answerSheet: item.answerSheet,
        answerRange: item.answerRange,
        answerSnapshotJson: item.answerSnapshotJson,
        checkFormula: item.checkFormula,
        gradingRuleJson: item.gradingRuleJson,
        expectedSnapshotJson: item.expectedSnapshotJson,
        sheetCountLimit: item.sheetCountLimit,
        version: item.version,
      }),
      navigate,
      role,
      nextEnabled ? "启用题目" : "停用题目",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("题目", item.title, nextEnabled ? "已启用" : "已停用"));
    await queryClient.invalidateQueries({ queryKey: adminKeys.questions({ page, size, type: "excel_template", questionCategoryId }) });
  };

  const remove = async (item: AdminQuestionRecord) => {
    const confirmed = await openAdminConfirm({
      title: "删除题目",
      message: `确认删除题目《${item.title}》？`,
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (!confirmed) return;
    await runAdminDelete({
      request: api.delete(`/api/admin/questions/${item.id}`),
      successMessage: formatAdminEntityMessage("题目", item.title, "已删除"),
      staleMessage: `题目《${item.title}》不存在，列表已刷新`,
      errorLabel: "删除题目",
      onRefresh: () => queryClient.invalidateQueries({ queryKey: adminKeys.questions({ page, size, type: "excel_template", questionCategoryId }) }).then(() => undefined),
    });
  };

  const submitDailyChallenge = async () => {
    const payload = {
      challengeDate: dailyChallengeForm.challengeDate || undefined,
      levelId: Number(dailyChallengeForm.levelId || 0),
      rewardExp: Number(dailyChallengeForm.rewardExp || 0),
      rewardPoints: Number(dailyChallengeForm.rewardPoints || 0),
      enabled: Boolean(dailyChallengeForm.enabled),
    };
    const result = await adminRequest(
      api.put("/api/admin/practice-campaign/daily-challenge", payload),
      navigate,
      role,
      "更新每日挑战",
    );
    if (!result) return;
    showAdminSuccess("每日挑战配置已更新");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.practiceCampaignDaily() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignDaily() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignOverview() }),
    ]);
  };

  const openLevelConfig = (item: PracticeCampaignLevelRecord) => {
    setLevelConfigEditing(item);
    setLevelConfigForm({
      levelType: item.levelType || "normal",
      difficulty: item.difficulty || "easy",
      targetTimeSeconds: String(item.targetTimeSeconds ?? 300),
      rewardExp: String(item.rewardExp ?? 10),
      rewardPoints: String(item.rewardPoints ?? 5),
      firstPassBonus: String(item.firstPassBonus ?? 0),
      enabled: item.enabled ?? true,
    });
    setLevelConfigOpen(true);
  };

  const submitLevelConfig = async () => {
    if (!levelConfigEditing?.id) return;
    const payload = {
      levelType: levelConfigForm.levelType,
      difficulty: levelConfigForm.difficulty,
      targetTimeSeconds: Number(levelConfigForm.targetTimeSeconds || 300),
      rewardExp: Number(levelConfigForm.rewardExp || 0),
      rewardPoints: Number(levelConfigForm.rewardPoints || 0),
      firstPassBonus: Number(levelConfigForm.firstPassBonus || 0),
      enabled: Boolean(levelConfigForm.enabled),
    };
    const result = await adminRequest(
      api.put(`/api/admin/practice-campaign/levels/${levelConfigEditing.id}`, payload),
      navigate,
      role,
      "更新闯关关卡",
    );
    if (!result) return;
    setLevelConfigOpen(false);
    showAdminSuccess(`关卡《${levelConfigEditing.title}》已更新`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.practiceCampaignLevels() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignOverview() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignChapters() }),
    ]);
  };

  const handleTemplateUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("仅支持上传 .xlsx 或 .xls 模板");
      return;
    }
    setUploadingTemplate(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await api.post<{ url: string }>("/api/upload", formData);
      setIsTemplateEditMode(true);
      const snapshot = await loadTemplateWorkbook(uploadResult.url);
      const detectedRegion = detectFormulaAnswerRegion(snapshot, {
        mode: form.gradingMode === "dynamic_array" ? "dynamic_array" : "simple",
      });
      if (!detectedRegion) {
        setForm({
          ...form,
          templateFileUrl: uploadResult.url,
          answerSheet: "",
          answerRange: "",
          answerSnapshotJson: "",
          dynamicArrayRules: [defaultDynamicArrayRule()],
          gradingRuleJson: "",
        });
        setFormulaDetectionNotice("未识别到含函数公式的答题区域，请在模板编辑器中手动选择。");
        toast.success("模板上传完成");
        return;
      }

      const detectedRange = form.gradingMode === "dynamic_array"
        ? detectedRegion.dynamicSpillRange
        : detectedRegion.rangeRef;
      const detectedRangeBounds = parseRangeRef(detectedRange);
      const nextDynamicRule = {
        ...defaultDynamicArrayRule(detectedRegion.sheetName),
        sheet: detectedRegion.sheetName,
        anchorCell: detectedRegion.anchorCell,
        spillRange: detectedRegion.dynamicSpillRange,
      };
      if (form.gradingMode === "dynamic_array") {
        setEditorWorkbook(clearDynamicArraySpillChildren(snapshot, [nextDynamicRule]));
      }
      setForm({
        ...form,
        templateFileUrl: uploadResult.url,
        answerSheet: detectedRegion.sheetName,
        answerRange: detectedRange,
        answerSnapshotJson: "",
        checkFormula: true,
        dynamicArrayRules: [nextDynamicRule],
        gradingRuleJson: "",
      });
      setSelectedSheetName(detectedRegion.sheetName);
      setSelection(detectedRangeBounds
        ? normalizeSelection(
          detectedRegion.sheetName,
          detectedRangeBounds.startRow,
          detectedRangeBounds.startCol,
          detectedRangeBounds.endRow,
          detectedRangeBounds.endCol,
        )
        : null);
      setFormulaDetectionNotice(
        form.gradingMode === "dynamic_array"
          ? `已自动识别动态数组：${detectedRegion.sheetName}!${detectedRegion.dynamicSpillRange}，锚点 ${detectedRegion.anchorCell}。可继续手动修正。`
          : `已自动识别公式区域：${detectedRegion.sheetName}!${detectedRegion.rangeRef}。动态数组锚点 ${detectedRegion.anchorCell}，溢出区域 ${detectedRegion.dynamicSpillRange} 已同步到动态规则。`,
      );
      toast.success("模板上传完成，已自动识别公式区域");
    } finally {
      setUploadingTemplate(false);
    }
  };

  const isDynamicArrayMode = form.gradingMode === "dynamic_array";
  const primaryDynamicRule = Array.isArray(form.dynamicArrayRules) && form.dynamicArrayRules.length > 0
    ? form.dynamicArrayRules[0]
    : defaultDynamicArrayRule();
  const primarySheetName = isDynamicArrayMode
    ? (primaryDynamicRule.sheet || form.answerSheet || selectedSheetName)
    : (form.answerSheet || selectedSheetName);
  const primaryRangeRef = isDynamicArrayMode
    ? primaryDynamicRule.spillRange
    : form.answerRange;
  const currentSelectionText = isTemplateEditMode
    ? (selectionToRangeRef(selection) || primaryRangeRef || "未选择")
    : (primaryRangeRef || "未选择");
  const sheetOptions = templateWorkbook.sheets || [];
  const templateEditorResetKey = `${form.templateFileUrl || "empty"}:${selectedSheetName || "none"}:${sheetOptions.length}:${templateLoadError || "ok"}`;
  const currentPreviewWorkbook = editorSnapshotGetterRef.current?.() || editorWorkbook;
  const answerPreview = extractRangeAnswerSnapshot(
    currentPreviewWorkbook,
    primarySheetName,
    isTemplateEditMode ? (selectionToRangeRef(selection) || primaryRangeRef) : primaryRangeRef,
  );
  const previewRangeRef = isTemplateEditMode ? (selectionToRangeRef(selection) || primaryRangeRef) : primaryRangeRef;
  const previewRange = previewRangeRef ? parseRangeRef(previewRangeRef) : null;
  const persistedRange = primaryRangeRef ? parseRangeRef(primaryRangeRef) : null;
  const persistedFocusRange = primarySheetName && persistedRange
    ? normalizeSelection(primarySheetName, persistedRange.startRow, persistedRange.startCol, persistedRange.endRow, persistedRange.endCol)
    : null;
  const prevSelectionForSheet = (sheetName: string, rangeText: string) => {
    const parsed = rangeText ? parseRangeRef(rangeText) : null;
    if (!parsed || !sheetName) return null;
    return normalizeSelection(sheetName, parsed.startRow, parsed.startCol, parsed.endRow, parsed.endCol);
  };
  const answerPreviewText = answerPreview.values.flatMap((valueRow, rowIndex) =>
    valueRow.map((value, colIndex) => {
      const formula = answerPreview.formulas?.[rowIndex]?.[colIndex];
      return formatAnswerPreviewCellDisplay(value, formula);
    }),
  ).filter((item) => item.trim().length > 0).join(" | ");
  const answerPreviewHasEmptyCell = answerPreview.values.some((row) =>
    row.some((value) => String(value ?? "").trim().length === 0),
  );
  const missingFormulaCellRefs = !isDynamicArrayMode && Boolean(form.checkFormula)
    ? findMissingFormulaCellRefs(answerPreview, previewRangeRef)
    : [];
  const missingFormulaCellRefSet = new Set(missingFormulaCellRefs);
  const previewColumnLabels = previewRange
    ? Array.from({ length: previewRange.endCol - previewRange.startCol + 1 }, (_, index) => columnIndexToLabel(previewRange.startCol + index))
    : [];
  const previewRowLabels = previewRange
    ? Array.from({ length: previewRange.endRow - previewRange.startRow + 1 }, (_, index) => previewRange.startRow + index)
    : [];
  const openAnswerRangeEditor = () => {
    if (!isTemplateEditMode) return;
    const sheetName = primarySheetName;
    if (!sheetName) {
      toast.error("请先选择答题工作表");
      return;
    }
    const parsedRange = primaryRangeRef ? parseRangeRef(primaryRangeRef) : null;
    const nextSelection = parsedRange
      ? normalizeSelection(sheetName, parsedRange.startRow, parsedRange.startCol, parsedRange.endRow, parsedRange.endCol)
      : normalizeSelection(sheetName, 1, 1, 1, 1);
    setSelectedSheetName(sheetName);
    setSelection(nextSelection);
    setIsSelectingAnswerRange(true);
    setEditorFullscreenVersion((current) => current + 1);
  };
  const confirmAnswerRange = () => {
    const nextRange = selectionToRangeRef(selection);
    if (!selection || !nextRange) {
      toast.error("请先在模板编辑器中选择答题区域");
      return;
    }
    setForm((prev) => ({
      ...prev,
      answerSheet: selection.sheetName,
      answerRange: nextRange,
      dynamicArrayRules: prev.gradingMode === "dynamic_array"
        ? (prev.dynamicArrayRules || []).map((item, index) => (index === 0
          ? { ...item, sheet: selection.sheetName, spillRange: nextRange }
          : item))
        : prev.dynamicArrayRules,
    }));
    setSelectedSheetName(selection.sheetName);
    setFormulaDetectionNotice("");
    setIsSelectingAnswerRange(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
  };

  return (
    <AdminPageShell
      title="题库管理"
      description="管理 Excel 模板题，配置答题区域、标准答案与判题方式。"
    >
      <AdminSection title="闯关每日挑战配置">
        <FilterBar>
          <FilterField label="挑战日期">
            <input
              type="date"
              value={dailyChallengeForm.challengeDate}
              onChange={(e) => setDailyChallengeForm((prev) => ({ ...prev, challengeDate: e.target.value }))}
              className={inputClassName()}
            />
          </FilterField>
          <FilterField label="挑战关卡">
            <select
              value={dailyChallengeForm.levelId}
              onChange={(e) => setDailyChallengeForm((prev) => ({ ...prev, levelId: e.target.value }))}
              className={inputClassName()}
            >
              <option value="">请选择关卡</option>
              {campaignLevels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.chapterName} / {item.title}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="奖励经验">
            <input
              type="number"
              value={dailyChallengeForm.rewardExp}
              onChange={(e) => setDailyChallengeForm((prev) => ({ ...prev, rewardExp: e.target.value }))}
              className={inputClassName()}
            />
          </FilterField>
          <FilterField label="奖励积分">
            <input
              type="number"
              value={dailyChallengeForm.rewardPoints}
              onChange={(e) => setDailyChallengeForm((prev) => ({ ...prev, rewardPoints: e.target.value }))}
              className={inputClassName()}
            />
          </FilterField>
          <div className="flex items-end">
            <button type="button" onClick={() => void submitDailyChallenge()} className={primaryButtonClassName()}>
              <Sparkles size={14} />
              保存每日挑战
            </button>
          </div>
        </FilterBar>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          当前每日挑战会展示在闯关大厅的“每日挑战”入口中。未配置时，前台会自动回退到当前可挑战关卡。
        </div>
      </AdminSection>

      <AdminSection title="闯关关卡配置" description="统一调整关卡类型、目标时间、奖励经验、奖励积分和首通额外奖励。">
        <div className="mt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>关卡</TableHead>
                <TableHead>章节 / 题目</TableHead>
                <TableHead>类型 / 难度</TableHead>
                <TableHead>目标 / 奖励</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignLevels.map((item) => (
                <TableRow key={`campaign-level-${item.id}`}>
                  <TableCell>
                    <div className="font-bold text-slate-800">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-400">ID {item.id}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-700">{item.chapterName || "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.questionTitle || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <div>{item.levelType || "normal"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.difficulty || "easy"}</div>
                  </TableCell>
                  <TableCell>
                    <div>目标 {item.targetTimeSeconds || 0}s</div>
                    <div className="mt-1 text-xs text-slate-400">
                      经验 {item.rewardExp || 0} · 积分 {item.rewardPoints || 0} · 首通 {item.firstPassBonus || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    <AdminTableSwitch
                      checked={Boolean(item.enabled)}
                      onCheckedChange={(next) => {
                        openLevelConfig({ ...item, enabled: next });
                        setLevelConfigForm((prev) => ({ ...prev, enabled: next }));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => openLevelConfig(item)} className={secondaryButtonClassName()}>
                      <Edit3 size={14} />
                      配置
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {campaignLevels.length === 0 && <AdminEmptyState message="暂无闯关关卡数据。" />}
        </div>
      </AdminSection>

      <AdminSection title="题目列表" actions={<AddButton onClick={openCreate}>新增题目</AddButton>}>
        <FilterBar>
          <FilterField label="题目分类">
            <select value={questionCategoryId} onChange={(e) => { setQuestionCategoryId(e.target.value); setPage(1); }} className={inputClassName()}>
              <option value="">全部</option>
              {questionCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </FilterField>
        </FilterBar>

        <div className="mt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>题目</TableHead>
                <TableHead>工作表 / 区域</TableHead>
                <TableHead>难度 / 奖励</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[320px]">
                    <div className="font-bold text-slate-800">{item.title}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{item.questionCategoryName || "未分类"}</span>
                      <span>·</span>
                      <span>{formatQuestionType(item.type || "excel_template")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-700">{item.answerSheet || "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.answerRange || "未配置区域"}</div>
                  </TableCell>
                  <TableCell>{item.difficulty || 1} / {item.points || 0}</TableCell>
                  <TableCell>
                    <AdminTableSwitch
                      checked={Boolean(item.enabled)}
                      onCheckedChange={(next) => void toggleEnabled(item, next)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void openEdit(item)} className={secondaryButtonClassName()}><Edit3 size={14} />编辑</button>
                      <button type="button" onClick={() => remove(item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {records.length === 0 && <AdminEmptyState message="暂无题目数据。" />}
          <div className="mt-4">
            <AdminPagination current={page} size={size} total={total} onChange={setPage} />
          </div>
        </div>
      </AdminSection>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "编辑 Excel 模板题" : "新增 Excel 模板题"}
        description="上传模板后，直接在表格里选择答题工作表、框选区域，并填写标准答案。"
        submitLabel={editing ? "保存题目" : "创建题目"}
        contentClassName="w-[min(1120px,calc(100vw-2rem))]"
        bodyClassName="px-6 py-5"
        onSubmit={submit}
      >
        <Field label="题目标题"><textarea value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className={textareaClassName()} /></Field>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="题目分类">
            <select value={String(form.questionCategoryId)} onChange={(e) => setForm((prev) => ({ ...prev, questionCategoryId: e.target.value }))} className={inputClassName()}>
              <option value="">请选择</option>
              {questionCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="题型"><input value={formatQuestionType("excel_template")} readOnly className={inputClassName()} /></Field>
          <Field label="难度"><input type="number" value={form.difficulty} onChange={(e) => setForm((prev) => ({ ...prev, difficulty: e.target.value }))} className={inputClassName()} /></Field>
          <Field label="奖励积分"><input type="number" value={form.points} onChange={(e) => setForm((prev) => ({ ...prev, points: e.target.value }))} className={inputClassName()} /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-[220px,1fr]">
          <Field label="判题模式">
            <select
              value={form.gradingMode}
              onChange={(e) => setForm((prev) => ({
                ...prev,
                gradingMode: e.target.value as QuestionGradingMode,
                dynamicArrayRules: e.target.value === "dynamic_array"
                  ? ((prev.dynamicArrayRules?.length && prev.dynamicArrayRules.some((item) => item.anchorCell || item.spillRange))
                    ? prev.dynamicArrayRules
                    : [{
                      ...defaultDynamicArrayRule(prev.answerSheet || selectedSheetName),
                      sheet: prev.answerSheet || selectedSheetName || "",
                      spillRange: prev.answerRange || "",
                      requireAnchorFormula: prev.checkFormula !== false,
                    }])
                  : prev.dynamicArrayRules,
              }))}
              className={inputClassName()}
            >
              <option value="simple">普通区域判题</option>
              <option value="dynamic_array">动态数组判题</option>
            </select>
          </Field>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {form.gradingMode === "dynamic_array"
              ? "动态数组模式会同时校验溢出结果、锚点公式以及扩展区域是否被手工改写。"
              : "普通区域模式会按答题区域逐格比对值，勾选后会额外校验函数公式。"}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-900">Excel 模板</div>
              <div className="mt-1 text-xs text-slate-500">{form.templateFileUrl || "尚未上传模板文件"}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={() => setIsTemplateEditMode((current) => !current)}
                  className={secondaryButtonClassName()}
                >
                  <Edit3 size={14} />
                  {isTemplateEditMode ? "完成修改" : "修改规则"}
                </button>
              )}
              <label className={`${primaryButtonClassName()} cursor-pointer ${!isTemplateEditMode ? "opacity-50 pointer-events-none" : ""}`}>
                {uploadingTemplate ? <LoaderCircle size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                上传模板
                <input type="file" accept=".xlsx,.xls" className="hidden" disabled={!isTemplateEditMode} onChange={(e) => void handleTemplateUpload(e.target.files)} />
              </label>
            </div>
          </div>
          {formulaDetectionNotice && (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
              {formulaDetectionNotice}
            </div>
          )}
          {templateLoadError && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              <span>{templateLoadError}</span>
              {form.templateFileUrl ? (
                <button
                  type="button"
                  onClick={() => void loadTemplateWorkbook(form.templateFileUrl, form.answerSheet, form.answerRange, form.answerSnapshotJson, form.dynamicArrayRules)}
                  className="inline-flex h-8 items-center justify-center rounded-[2px] border border-amber-300 bg-white px-3 text-xs font-bold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
                >
                  重新加载
                </button>
              ) : null}
            </div>
          )}
          {sheetOptions.length > 0 && (
            <div className="grid gap-4 md:grid-cols-4">
              <Field label={isDynamicArrayMode ? "首条规则工作表" : "答题工作表"}>
                <select
                  value={primarySheetName}
                  disabled={!isTemplateEditMode}
                  onChange={(e) => {
                    const nextSheetName = e.target.value;
                    setSelectedSheetName(nextSheetName);
                    setForm((prev) => ({
                      ...prev,
                      answerSheet: nextSheetName,
                      dynamicArrayRules: prev.gradingMode === "dynamic_array"
                        ? (prev.dynamicArrayRules || []).map((item, index) => (index === 0 ? { ...item, sheet: nextSheetName } : item))
                        : prev.dynamicArrayRules,
                    }));
                    const persistedForSheet = prevSelectionForSheet(nextSheetName, primaryRangeRef);
                    setSelection(persistedForSheet);
                  }}
                  className={inputClassName()}
                >
                  <option value="">请选择</option>
                  {sheetOptions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </Field>
              <Field label={isDynamicArrayMode ? "首条规则溢出区域" : "答题区域"}>
                <div className="flex gap-2">
                  <input value={currentSelectionText} readOnly className={inputClassName()} />
                  <button
                    type="button"
                    onClick={openAnswerRangeEditor}
                    disabled={!isTemplateEditMode}
                    className={answerRangeButtonClassName()}
                  >
                    <MousePointer2 size={14} />
                    选择区域
                  </button>
                </div>
              </Field>
              <Field label="标准答案">
                <div className="space-y-2">
                  <input
                    value={answerPreviewText || "未填写"}
                    readOnly
                    className={inputClassName()}
                  />
                  {answerPreviewHasEmptyCell && (
                    <div className="text-xs font-medium text-amber-600">答题区域中存在空白单元格，保存前请补全标准答案。</div>
                  )}
                  {missingFormulaCellRefs.length > 0 && (
                    <div className="text-xs font-medium text-rose-600">
                      检测函数公式已开启，{missingFormulaCellRefs.slice(0, 6).join("、")}{missingFormulaCellRefs.length > 6 ? ` 等 ${missingFormulaCellRefs.length} 个单元格` : ""} 不是公式。
                    </div>
                  )}
                </div>
              </Field>
              {isDynamicArrayMode ? (
                <Field label="首条规则锚点">
                  <input
                    value={primaryDynamicRule.anchorCell}
                    disabled={!isTemplateEditMode}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, index) => (index === 0
                        ? { ...item, anchorCell: e.target.value.toUpperCase() }
                        : item)),
                    }))}
                    className={inputClassName()}
                    placeholder="例如 F2"
                  />
                </Field>
              ) : (
                <label className="flex items-end">
                  <span className={`inline-flex h-9 items-center gap-2 rounded-[2px] border border-[#d9d9d9] bg-white px-3 text-sm font-medium text-slate-700 ${!isTemplateEditMode ? "opacity-60" : ""}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.checkFormula)}
                      disabled={!isTemplateEditMode}
                      onChange={(e) => setForm((prev) => ({ ...prev, checkFormula: e.target.checked }))}
                    />
                    检测函数公式
                  </span>
                </label>
              )}
            </div>
          )}
          {isDynamicArrayMode && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900">动态数组规则</div>
                  <div className="mt-1 text-xs text-slate-500">支持多条规则统一判题，首条规则会同步到模板编辑器预览。</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({
                    ...prev,
                    dynamicArrayRules: [...(prev.dynamicArrayRules || []), defaultDynamicArrayRule(primarySheetName)],
                  }))}
                  className={secondaryButtonClassName()}
                >
                  <Plus size={14} />
                  新增规则
                </button>
              </div>
              <div className="space-y-4">
                {(form.dynamicArrayRules || []).map((rule, index) => (
                  <div key={`dynamic-rule-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-black text-slate-800">规则 {index + 1}</div>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => {
                          const nextRules = (prev.dynamicArrayRules || []).filter((_, ruleIndex) => ruleIndex !== index);
                          return { ...prev, dynamicArrayRules: nextRules.length > 0 ? nextRules : [defaultDynamicArrayRule(primarySheetName)] };
                        })}
                        className={secondaryButtonClassName()}
                        disabled={(form.dynamicArrayRules || []).length <= 1}
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <Field label="工作表">
                        <select
                          value={rule.sheet}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, sheet: e.target.value }
                              : item)),
                          }))}
                          className={inputClassName()}
                        >
                          <option value="">请选择</option>
                          {sheetOptions.map((item) => <option key={`dynamic-sheet-${index}-${item.name}`} value={item.name}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="锚点单元格">
                        <input
                          value={rule.anchorCell}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, anchorCell: e.target.value.toUpperCase() }
                              : item)),
                          }))}
                          className={inputClassName()}
                          placeholder="例如 F2"
                        />
                      </Field>
                      <Field label="溢出区域">
                        <input
                          value={rule.spillRange}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, spillRange: e.target.value.toUpperCase() }
                              : item)),
                          }))}
                          className={inputClassName()}
                          placeholder="例如 F2:G6"
                        />
                      </Field>
                      <Field label="分值">
                        <input
                          type="number"
                          min="1"
                          value={rule.score}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, score: e.target.value }
                              : item)),
                          }))}
                          className={inputClassName()}
                        />
                      </Field>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="规则名称">
                        <input
                          value={rule.label}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, label: e.target.value }
                              : item)),
                          }))}
                          className={inputClassName()}
                          placeholder="例如 按条件筛选结果"
                        />
                      </Field>
                      <Field label="公式关键字">
                        <input
                          value={rule.formulaKeywordsText}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, formulaKeywordsText: e.target.value }
                              : item)),
                          }))}
                          className={inputClassName()}
                          placeholder="例如 FILTER, SORT"
                        />
                      </Field>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <AdminFormSwitch
                        label="首格必须包含公式"
                        checked={Boolean(rule.requireAnchorFormula)}
                        onCheckedChange={(next) => setForm((prev) => ({
                          ...prev,
                          dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                            ? { ...item, requireAnchorFormula: next }
                            : item)),
                        }))}
                      />
                      <AdminFormSwitch
                        label="溢出子单元格不允许手填公式"
                        checked={Boolean(rule.requireSpillCellsWithoutFormula)}
                        onCheckedChange={(next) => setForm((prev) => ({
                          ...prev,
                          dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                            ? { ...item, requireSpillCellsWithoutFormula: next }
                            : item)),
                        }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 text-xs text-slate-500">
            {isTemplateEditMode
              ? (isDynamicArrayMode
                ? "先维护动态数组规则，首条规则可借助模板编辑器框选溢出区域；框选后请补充锚点单元格与公式关键字。"
                : "先选工作表，再在表格里拖拽框选答题区域；框选完成后，在表格中直接填写标准答案或公式。")
              : "当前为查看态。点击“修改规则”后才允许调整工作表、判题区域和标准答案。"}
          </div>
          {previewRange && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900">标准答案预览</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {primarySheetName || "-"} / {previewRangeRef || "-"}
                  </div>
                </div>
                {answerPreviewHasEmptyCell ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">存在空白单元格</span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">答案已完整</span>
                )}
              </div>
              <div className="overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-20 min-w-14 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        #
                      </th>
                      {previewColumnLabels.map((label) => (
                        <th
                          key={`preview-col-${label}`}
                          className="min-w-[120px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-500"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {answerPreview.values.map((row, rowIndex) => (
                      <tr key={`preview-row-${previewRowLabels[rowIndex] || rowIndex}`}>
                        <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-black text-slate-500">
                          {previewRowLabels[rowIndex] || rowIndex + 1}
                        </th>
                        {row.map((value, colIndex) => {
                          const formula = answerPreview.formulas?.[rowIndex]?.[colIndex];
                          const cellRef = previewRange ? toCellRef(previewRange.startRow + rowIndex, previewRange.startCol + colIndex) : "";
                          const missingFormula = missingFormulaCellRefSet.has(cellRef);
                          const displayValue = formatAnswerPreviewCellDisplay(value, formula);
                          return (
                            <td
                              key={`preview-cell-${rowIndex}-${colIndex}`}
                              className={`border-b border-r border-slate-200 px-3 py-2 align-top ${!displayValue.trim() ? "bg-amber-50/70" : missingFormula ? "bg-rose-50/70" : "bg-white"}`}
                            >
                              <div className="flex flex-col gap-1">
                                {formula && (
                                  <span className="inline-flex w-fit rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                                    fx
                                  </span>
                                )}
                                {missingFormula && (
                                  <span className="inline-flex w-fit rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
                                    缺少公式
                                  </span>
                                )}
                                <span className={`break-all font-medium ${formula ? "text-cyan-700" : missingFormula ? "text-rose-700" : "text-slate-700"} ${!displayValue.trim() ? "text-amber-700" : ""}`}>
                                  {displayValue || "空"}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
            <FileSpreadsheet size={16} />
            模板编辑器
          </div>
          {templateLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">正在加载模板...</div>
          ) : templateLoadError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-5 text-center text-sm text-amber-800">
              <div>{templateLoadError}</div>
              {form.templateFileUrl ? (
                <button
                  type="button"
                  onClick={() => void loadTemplateWorkbook(form.templateFileUrl, form.answerSheet, form.answerRange, form.answerSnapshotJson, form.dynamicArrayRules)}
                  className={secondaryButtonClassName()}
                >
                  重新加载模板
                </button>
              ) : null}
            </div>
          ) : sheetOptions.length > 0 ? (
            <ExcelEditorErrorBoundary
              resetKey={templateEditorResetKey}
              fallback={(
                <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-rose-200 bg-rose-50 px-5 text-center text-sm text-rose-700">
                  <div>模板编辑器加载失败，请重新加载模板后再修改答案。</div>
                  <button
                    type="button"
                    onClick={() => void loadTemplateWorkbook(form.templateFileUrl, form.answerSheet, form.answerRange, form.answerSnapshotJson, form.dynamicArrayRules)}
                    className={secondaryButtonClassName()}
                  >
                    重新加载模板
                  </button>
                </div>
              )}
            >
              <Suspense fallback={<div className="flex h-[460px] items-center justify-center text-sm text-slate-400">正在加载编辑器...</div>}>
                <ExcelWorkbookEditor
                  workbook={editorWorkbook}
                  onWorkbookChange={isTemplateEditMode ? setEditorWorkbook : undefined}
                  selectedSheetName={selectedSheetName}
                  onSelectedSheetNameChange={(sheetName) => {
                    setSelectedSheetName(sheetName);
                    if (isTemplateEditMode) {
                      setForm((prev) => ({ ...prev, answerSheet: sheetName }));
                    }
                  }}
                  selection={isTemplateEditMode && isSelectingAnswerRange ? selection : undefined}
                  onSelectionChange={isTemplateEditMode && isSelectingAnswerRange ? ((nextSelection) => {
                    setSelection(nextSelection);
                  }) : undefined}
                  editableRange={isTemplateEditMode && isSelectingAnswerRange ? selection : undefined}
                  selectionEnabled={isTemplateEditMode && isSelectingAnswerRange}
                  focusRange={isSelectingAnswerRange ? selection : persistedFocusRange}
                  focusRequestVersion={editorFullscreenVersion}
                  requestFullscreenVersion={editorFullscreenVersion}
                  showConfirmSelectionButton={isSelectingAnswerRange}
                  confirmSelectionLabel="确认区域"
                  onConfirmSelection={confirmAnswerRange}
                  onSnapshotCaptureReady={(capture) => {
                    editorSnapshotGetterRef.current = capture;
                  }}
                />
              </Suspense>
            </ExcelEditorErrorBoundary>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
              上传 Excel 模板后即可开始配置
            </div>
          )}
        </div>
        <Field label="解析说明"><textarea value={form.explanation} onChange={(e) => setForm((prev) => ({ ...prev, explanation: e.target.value }))} className={textareaClassName()} /></Field>
        <AdminFormSwitch
          label="启用该题目"
          checked={Boolean(form.enabled)}
          onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
        />
      </FormDialog>

      <FormDialog
        open={levelConfigOpen}
        onOpenChange={setLevelConfigOpen}
        title={levelConfigEditing ? `配置关卡：${levelConfigEditing.title}` : "配置闯关关卡"}
        description="调整关卡类型、目标时间、奖励经验、奖励积分与首通额外奖励。"
        submitLabel="保存关卡配置"
        onSubmit={submitLevelConfig}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="关卡类型">
            <select value={levelConfigForm.levelType} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, levelType: e.target.value }))} className={inputClassName()}>
              <option value="normal">普通关</option>
              <option value="elite">精英关</option>
              <option value="exam">测验关</option>
              <option value="boss">Boss关</option>
              <option value="daily">每日挑战</option>
            </select>
          </Field>
          <Field label="难度">
            <select value={levelConfigForm.difficulty} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, difficulty: e.target.value }))} className={inputClassName()}>
              <option value="easy">简单</option>
              <option value="medium">普通</option>
              <option value="hard">困难</option>
              <option value="expert">专家</option>
            </select>
          </Field>
          <Field label="目标时间（秒）">
            <input type="number" value={levelConfigForm.targetTimeSeconds} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, targetTimeSeconds: e.target.value }))} className={inputClassName()} />
          </Field>
          <Field label="奖励经验">
            <input type="number" value={levelConfigForm.rewardExp} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, rewardExp: e.target.value }))} className={inputClassName()} />
          </Field>
          <Field label="奖励积分">
            <input type="number" value={levelConfigForm.rewardPoints} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, rewardPoints: e.target.value }))} className={inputClassName()} />
          </Field>
          <Field label="首通额外奖励">
            <input type="number" value={levelConfigForm.firstPassBonus} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, firstPassBonus: e.target.value }))} className={inputClassName()} />
          </Field>
        </div>
        <AdminFormSwitch
          label="启用该关卡"
          checked={Boolean(levelConfigForm.enabled)}
          onCheckedChange={(next) => setLevelConfigForm((prev) => ({ ...prev, enabled: next }))}
        />
      </FormDialog>
    </AdminPageShell>
  );
}

export function AdminPoints() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsKeyword, setRecordsKeyword] = useState("");
  const [grantForm, setGrantForm] = useState({ username: "", points: "", reason: "" });
  const [showGrantUserSuggestions, setShowGrantUserSuggestions] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PointsRuleRecord | null>(null);
  const [form, setForm] = useState<PointsRuleForm>(defaultPointsRuleForm());
  const [optionOpen, setOptionOpen] = useState(false);
  const [optionEditing, setOptionEditing] = useState<PointsOptionRecord | null>(null);
  const [optionKind, setOptionKind] = useState<PointsOptionKind>("type");
  const [optionForm, setOptionForm] = useState<PointsOptionForm>(defaultPointsOptionForm("type"));
  const grantUsernameRef = useRef<HTMLDivElement | null>(null);
  const size = 10;
  const recordsQueryPath = `/api/admin/points/records?page=${recordsPage}&size=${size}${recordsKeyword.trim() ? `&username=${encodeURIComponent(recordsKeyword.trim())}` : ""}`;
  const statsQuery = useQuery({
    queryKey: adminKeys.pointsStats(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PointsStatsResponse>(api.get("/api/admin/points/stats", { silent: true }), navigate, role);
      return result || null;
    },
  });
  const grantUsersQuery = useQuery({
    queryKey: adminKeys.pointsGrantUsers({ keyword: grantForm.username.trim() }),
    enabled: Boolean(role && grantForm.username.trim()),
    queryFn: async () => {
      const result = await adminRequest<PagedAdminResponse<AdminUserRecord>>(
        api.get(`/api/admin/users?page=1&size=8&keyword=${encodeURIComponent(grantForm.username.trim())}`, { silent: true }),
        navigate,
        role
      );
      return result || { records: [] };
    },
  });
  const optionsQuery = useQuery({
    queryKey: adminKeys.pointsOptions(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PointsOptionsResponse>(api.get("/api/admin/points/options", { silent: true }), navigate, role);
      return result || { types: [], taskKeys: [] };
    },
  });
  const rulesQuery = useQuery({
    queryKey: adminKeys.pointsRules(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PointsRuleRecord[]>(api.get("/api/admin/points/rules", { silent: true }), navigate, role);
      return result || [];
    },
  });
  const recordsQuery = useQuery({
    queryKey: adminKeys.pointsRecords({ page: recordsPage, size, keyword: recordsKeyword.trim() }),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PagedAdminResponse<PointsRecord>>(api.get(recordsQueryPath, { silent: true }), navigate, role);
      return result || { records: [], total: 0 };
    },
  });
  const stats = statsQuery.data;
  const pointsOptions = optionsQuery.data || { types: [], taskKeys: [] };
  const rules = rulesQuery.data || [];
  const records = recordsQuery.data?.records || [];
  const grantUserOptions = grantUsersQuery.data?.records || [];
  const existingTypeValues = useMemo(() => (pointsOptions.types || []).map((item) => String(item.value || item.optionValue || "").trim()).filter(Boolean), [pointsOptions.types]);
  const existingTaskKeyValues = useMemo(() => (pointsOptions.taskKeys || []).map((item) => String(item.value || item.optionValue || "").trim()).filter(Boolean), [pointsOptions.taskKeys]);
  const typeOptions = useMemo(
    () => buildAdminOptionChoices(pointsOptions.types, POINTS_RULE_TYPE_OPTIONS, form.type),
    [pointsOptions.types, form.type],
  );
  const taskKeyOptions = useMemo(
    () => buildAdminOptionChoices(pointsOptions.taskKeys, POINTS_TASK_KEY_OPTIONS, form.taskKey),
    [pointsOptions.taskKeys, form.taskKey],
  );
  const typeDictionary = useMemo(() => buildAdminOptionLabelMap(typeOptions), [typeOptions]);
  const taskKeyDictionary = useMemo(() => buildAdminOptionLabelMap(taskKeyOptions), [taskKeyOptions]);

  useEffect(() => {
    setRecordsTotal(recordsQuery.data?.total || 0);
  }, [recordsQuery.data?.total]);

  useEffect(() => {
    if (!showGrantUserSuggestions) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (grantUsernameRef.current && !grantUsernameRef.current.contains(event.target as Node)) {
        setShowGrantUserSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGrantUserSuggestions]);

  const resolveRuleTypeLabel = (value: unknown) => {
    const normalized = String(value ?? "").trim();
    return typeDictionary.get(normalized) || formatPointsRuleType(value);
  };

  const resolveTaskKeyLabel = (value: unknown) => {
    const normalized = String(value ?? "").trim();
    return taskKeyDictionary.get(normalized) || formatPointsTaskKey(value);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultPointsRuleForm(typeOptions[0]?.value || "daily"));
    setOpen(true);
  };

  const openEdit = (item: PointsRuleRecord) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      description: item.description || "",
      taskKey: item.taskKey || "",
      points: item.points ?? 0,
      type: item.type || "daily",
      enabled: item.enabled ?? true,
      userVisible: item.userVisible ?? true,
      sortOrder: item.sortOrder ?? 0,
    });
    setOpen(true);
  };

  const openOptionCreate = (kind: PointsOptionKind) => {
    setOptionEditing(null);
    setOptionKind(kind);
    setOptionForm(defaultPointsOptionForm(kind));
    setOptionOpen(true);
  };

  const openOptionEdit = (kind: PointsOptionKind, item: PointsOptionRecord) => {
    setOptionEditing(item);
    setOptionKind(kind);
    setOptionForm({
      kind,
      value: item.value || "",
      label: item.label || "",
      sortOrder: item.sortOrder ?? 0,
    });
    setOptionOpen(true);
  };

  const submit = async () => {
    const payload = {
      ...form,
      points: Number(form.points || 0),
      sortOrder: Number(form.sortOrder || 0),
    };
    const request = editing ? api.put<PointsRuleRecord>(`/api/admin/points/rules/${editing.id}`, payload) : api.post<PointsRuleRecord>("/api/admin/points/rules", payload);
    const result = await adminRequest(request, navigate, role, editing ? "更新积分规则" : "创建积分规则");
    if (!result) return;
    setOpen(false);
    showAdminSuccess(formatAdminEntityMessage("积分规则", editing?.name || result?.name || form.name, editing ? "已更新" : "已创建"));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsRules() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsStats() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsRecords({ page: recordsPage, size, keyword: recordsKeyword.trim() }) }),
    ]);
  };

  const submitOption = async () => {
    const payload = {
      kind: optionKind,
      optionValue: String(optionForm.value || "").trim(),
      label: String(optionForm.label || "").trim(),
      sortOrder: Number(optionForm.sortOrder || 0),
    };
    const request = optionEditing
      ? api.put(`/api/admin/points/options/${optionEditing.id}`, payload)
      : api.post("/api/admin/points/options", payload);
    const result = await adminRequest(request, navigate, role, optionEditing ? "更新积分规则选项" : "创建积分规则选项");
    if (!result) return;
    setOptionOpen(false);
    showAdminSuccess(formatAdminEntityMessage(optionKind === "type" ? "规则类型" : "任务类型", optionForm.label || optionForm.value, optionEditing ? "已更新" : "已创建"));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsOptions() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsRules() }),
    ]);
  };

  const toggleRuleEnabled = async (item: PointsRuleRecord, nextEnabled: boolean) => {
    const result = await adminRequest(
      api.put(`/api/admin/points/rules/${item.id}`, {
        name: item.name,
        description: item.description,
        taskKey: item.taskKey,
        points: Number(item.points || 0),
        type: item.type,
        enabled: nextEnabled,
        userVisible: item.userVisible ?? true,
        sortOrder: Number(item.sortOrder || 0),
      }),
      navigate,
      role,
      nextEnabled ? "启用积分规则" : "停用积分规则",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("积分规则", item.name, nextEnabled ? "已启用" : "已停用"));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsRules() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsStats() }),
    ]);
  };

  const remove = async (item: PointsRuleRecord) => {
    const confirmed = await openAdminConfirm({
      title: "删除积分规则",
      message: `确认删除积分规则 ${item.name}？`,
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (!confirmed) return;
    await runAdminDelete({
      request: api.delete(`/api/admin/points/rules/${item.id}`),
      successMessage: formatAdminEntityMessage("积分规则", item.name, "已删除"),
      staleMessage: `积分规则《${item.name}》不存在，列表已刷新`,
      errorLabel: "删除积分规则",
      onRefresh: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsRules() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsStats() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsRecords({ page: recordsPage, size, keyword: recordsKeyword.trim() }) }),
        ]);
      },
    });
  };

  const removeOption = async (kind: PointsOptionKind, item: PointsOptionRecord) => {
    const confirmed = await openAdminConfirm({
      title: kind === "type" ? "删除规则类型" : "删除任务类型",
      message: `确认删除${kind === "type" ? "规则类型" : "任务类型"} ${item.label}？`,
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (!confirmed) return;
    await runAdminDelete({
      request: api.delete(`/api/admin/points/options/${item.id}`),
      successMessage: formatAdminEntityMessage(kind === "type" ? "规则类型" : "任务类型", item.label, "已删除"),
      staleMessage: `${kind === "type" ? "规则类型" : "任务类型"}《${item.label}》不存在，列表已刷新`,
      errorLabel: kind === "type" ? "删除规则类型" : "删除任务类型",
      onRefresh: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsOptions() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsRules() }),
        ]);
      },
    });
  };

  const grantPoints = async () => {
    const payload = {
      username: grantForm.username.trim(),
      points: Number(grantForm.points || 0),
      reason: grantForm.reason.trim(),
    };
    const result = await adminRequest(
      api.post<PointsGrantResponse>("/api/admin/points/grant", payload),
      navigate,
      role,
      "手动发放积分",
    );
    if (!result) return;
    setGrantForm({ username: "", points: "", reason: "" });
    showAdminSuccess(`已向用户 ${result.username || payload.username} 发放 ${result.points || payload.points} 积分`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsStats() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsRecords({ page: recordsPage, size, keyword: recordsKeyword.trim() }) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.users({ page: 1, size: 10, keyword: payload.username, role: "", status: "" }) }),
    ]);
  };

  return (
    <AdminPageShell
      title="积分体系"
      description="查看积分统计、维护积分规则并浏览积分记录。"
    >
      <AdminStatGrid>
        <AdminStatCard label="活跃积分用户" value={stats?.activeUsers ?? "-"} />
        <AdminStatCard label="累计积分变化" value={stats?.totalPoints ?? "-"} />
        <AdminStatCard label="今日积分变化" value={stats?.todayPoints ?? "-"} />
      </AdminStatGrid>

      <AdminSection title="手动发放积分">
        <FilterBar>
          <FilterField label="用户名">
            <div className="relative" ref={grantUsernameRef}>
              <input
                value={grantForm.username}
                onFocus={() => {
                  if (grantForm.username.trim()) {
                    setShowGrantUserSuggestions(true);
                  }
                }}
                onChange={(e) => {
                  const username = e.target.value;
                  setGrantForm((prev) => ({ ...prev, username }));
                  setShowGrantUserSuggestions(Boolean(username.trim()));
                }}
                className={inputClassName()}
                placeholder="输入用户名，自动联想匹配用户"
              />
              {showGrantUserSuggestions && grantUserOptions.length > 0 && (
                <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-[8px] border border-[#d9d9d9] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                  {grantUserOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setGrantForm((prev) => ({ ...prev, username: item.username || "" }));
                        setShowGrantUserSuggestions(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#262626] transition hover:bg-[#f5f5f5]"
                    >
                      <span className="truncate font-medium">{item.username}</span>
                      <span className="truncate text-xs text-[#8c8c8c]">{item.email || "-"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FilterField>
          <FilterField label="积分值">
            <input
              type="number"
              min="1"
              value={grantForm.points}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, points: e.target.value }))}
              className={inputClassName()}
              placeholder="输入发放积分"
            />
          </FilterField>
          <FilterField label="发放原因">
            <input
              value={grantForm.reason}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, reason: e.target.value }))}
              className={inputClassName()}
              placeholder="输入发放原因"
            />
          </FilterField>
          <div className="flex items-end">
            <button type="button" onClick={() => void grantPoints()} className={primaryButtonClassName()}>
              <Send size={14} />
              发放积分
            </button>
          </div>
        </FilterBar>
      </AdminSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminSection title="积分规则" actions={<AddButton onClick={openCreate}>新增积分规则</AddButton>}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>规则名称</TableHead>
                <TableHead>任务标识</TableHead>
                <TableHead>分值</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.description || "-"}</div>
                  </TableCell>
                  <TableCell>{resolveTaskKeyLabel(item.taskKey)}</TableCell>
                  <TableCell>{item.points}</TableCell>
                  <TableCell>{resolveRuleTypeLabel(item.type)}</TableCell>
                  <TableCell>
                    <AdminTableSwitch
                      checked={Boolean(item.enabled)}
                      onCheckedChange={(next) => void toggleRuleEnabled(item, next)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(item)} className={secondaryButtonClassName()}><Edit3 size={14} />编辑</button>
                      <button type="button" onClick={() => remove(item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rules.length === 0 && <AdminEmptyState message="暂无积分规则。" />}
        </AdminSection>

        <AdminSection title="规则类型管理" actions={<AddButton onClick={() => openOptionCreate("type")}>新增类型</AddButton>}>
          <div className="mb-4 text-xs text-slate-500">每日任务和一次性任务带有内置积分去重逻辑；新增类型会按通用规则处理。</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>显示名称</TableHead>
                <TableHead>中文显示</TableHead>
                <TableHead>使用规则</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pointsOptions.types || []).map((item) => (
                <TableRow key={`type-${item.id}`}>
                  <TableCell>{item.label}</TableCell>
                  <TableCell>{resolveRuleTypeLabel(item.value)}</TableCell>
                  <TableCell>{item.usageCount ?? 0}</TableCell>
                  <TableCell>{item.sortOrder ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openOptionEdit("type", item)} className={secondaryButtonClassName()}><Edit3 size={14} />编辑</button>
                      <button type="button" onClick={() => removeOption("type", item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(pointsOptions.types || []).length === 0 && <AdminEmptyState message="暂无规则类型。" />}
        </AdminSection>

        <AdminSection title="任务类型管理" actions={<AddButton onClick={() => openOptionCreate("task_key")}>新增任务类型</AddButton>}>
          <div className="mb-4 text-xs text-slate-500">新增任务类型只会进入规则配置选项；如需自动发放积分，还需要业务代码调用对应任务标识。</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>显示名称</TableHead>
                <TableHead>中文显示</TableHead>
                <TableHead>使用规则</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pointsOptions.taskKeys || []).map((item) => (
                <TableRow key={`task-${item.id}`}>
                  <TableCell>{item.label}</TableCell>
                  <TableCell>{resolveTaskKeyLabel(item.value)}</TableCell>
                  <TableCell>{item.usageCount ?? 0}</TableCell>
                  <TableCell>{item.sortOrder ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openOptionEdit("task_key", item)} className={secondaryButtonClassName()}><Edit3 size={14} />编辑</button>
                      <button type="button" onClick={() => removeOption("task_key", item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(pointsOptions.taskKeys || []).length === 0 && <AdminEmptyState message="暂无任务类型。" />}
        </AdminSection>

        <AdminSection title="积分记录" description="按用户名检索积分变化历史。">
          <FilterBar>
            <FilterField label="用户名">
              <input value={recordsKeyword} onChange={(e) => { setRecordsKeyword(e.target.value); setRecordsPage(1); }} className={inputClassName()} />
            </FilterField>
          </FilterBar>
          <div className="mt-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>变动</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((item, index) => (
                  <TableRow key={item.id ?? `${item.userId}-${index}`}>
                    <TableCell>{item.username || item.user?.username || "-"}</TableCell>
                    <TableCell>{item.change ?? item.points ?? "-"}</TableCell>
                    <TableCell>{item.reason || item.bizLabel || item.taskName || "-"}</TableCell>
                    <TableCell>{formatMaybeDate(item.createTime)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {records.length === 0 && <AdminEmptyState message="暂无积分记录。" />}
            <div className="mt-4">
              <AdminPagination current={recordsPage} size={size} total={recordsTotal} onChange={setRecordsPage} />
            </div>
          </div>
        </AdminSection>
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "编辑积分规则" : "新增积分规则"}
        submitLabel={editing ? "保存规则" : "创建规则"}
        onSubmit={submit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="规则名称"><input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className={inputClassName()} /></Field>
          <Field label="任务标识">
            <select value={form.taskKey} onChange={(e) => setForm((prev) => ({ ...prev, taskKey: e.target.value }))} className={inputClassName()}>
              <option value="">无任务标识</option>
              {taskKeyOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="描述"><textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className={textareaClassName()} /></Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="分值"><input type="number" value={form.points} onChange={(e) => setForm((prev) => ({ ...prev, points: e.target.value }))} className={inputClassName()} /></Field>
          <Field label="类型">
            <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))} className={inputClassName()}>
              {typeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="排序"><input type="number" value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))} className={inputClassName()} /></Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <AdminFormSwitch
            label="启用规则"
            checked={Boolean(form.enabled)}
            onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
          />
          <AdminFormSwitch
            label="用户可见"
            checked={Boolean(form.userVisible)}
            onCheckedChange={(next) => setForm((prev) => ({ ...prev, userVisible: next }))}
          />
        </div>
      </FormDialog>

      <FormDialog
        open={optionOpen}
        onOpenChange={setOptionOpen}
        title={`${optionEditing ? "编辑" : "新增"}${optionKind === "type" ? "规则类型" : "任务类型"}`}
        submitLabel={optionEditing ? "保存选项" : "创建选项"}
        onSubmit={submitOption}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="显示名称">
            <input
              value={optionForm.label}
              onChange={(e) => {
                const nextLabel = e.target.value;
                setOptionForm((prev) => ({
                  ...prev,
                  label: nextLabel,
                  value: optionEditing
                    ? prev.value
                    : generateMachineIdentifier(
                      nextLabel,
                      optionKind === "type" ? "type" : "task",
                      optionKind === "type" ? existingTypeValues : existingTaskKeyValues,
                    ),
                }));
              }}
              className={inputClassName()}
              placeholder={optionKind === "type" ? "如：每日任务" : "如：每日签到"}
            />
          </Field>
          <Field label="标识值">
            <input value={optionForm.value} readOnly className={`${inputClassName()} bg-slate-50 text-slate-500`} placeholder={optionKind === "type" ? "将根据显示名称自动生成" : "将根据显示名称自动生成"} />
          </Field>
        </div>
        <Field label="排序">
          <input type="number" value={optionForm.sortOrder} onChange={(e) => setOptionForm((prev) => ({ ...prev, sortOrder: e.target.value }))} className={inputClassName()} />
        </Field>
        <div className="rounded-[2px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-xs text-slate-500">
          {optionKind === "type"
            ? "提示：标识值建议使用英文小写和下划线。只有 daily / once 内置了明确的发放频率语义。"
            : "提示：新增任务类型后，只有在后端业务代码调用同名任务标识时，用户才会真正触发积分奖励。"}
        </div>
      </FormDialog>
    </AdminPageShell>
  );
}

export function AdminLevels() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [userPage, setUserPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [levelRuleOpen, setLevelRuleOpen] = useState(false);
  const [levelRuleEditing, setLevelRuleEditing] = useState<LevelRuleRecord | null>(null);
  const [pendingLevelRuleRemove, setPendingLevelRuleRemove] = useState<LevelRuleRecord | null>(null);
  const [levelRuleForm, setLevelRuleForm] = useState<LevelRuleForm>({ level: "", name: "", threshold: "0", enabled: true });
  const [expRuleOpen, setExpRuleOpen] = useState(false);
  const [expRuleEditing, setExpRuleEditing] = useState<ExpRuleRecord | null>(null);
  const [pendingExpRuleRemove, setPendingExpRuleRemove] = useState<ExpRuleRecord | null>(null);
  const [expRuleForm, setExpRuleForm] = useState<ExpRuleForm>({ key: "", name: "", description: "", minExp: "0", maxExp: "0", maxObtainCount: "", enabled: true });
  const [userKeyword, setUserKeyword] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [logUsername, setLogUsername] = useState("");
  const [bizType, setBizType] = useState("");
  const size = 10;
  const userQuery = new URLSearchParams({ page: String(userPage), size: String(size) });
  if (userKeyword.trim()) userQuery.set("keyword", userKeyword.trim());
  if (levelFilter) userQuery.set("level", levelFilter);
  const logQuery = new URLSearchParams({ page: String(logPage), size: String(size) });
  if (logUsername.trim()) logQuery.set("username", logUsername.trim());
  if (bizType.trim()) logQuery.set("bizType", bizType.trim());

  const overviewQuery = useQuery({
    queryKey: adminKeys.levelsOverview(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<LevelsOverviewResponse>(api.get("/api/admin/levels/overview", { silent: true }), navigate, role);
      return result || null;
    },
  });
  const usersQuery = useQuery({
    queryKey: adminKeys.levelsUsers({ page: userPage, size, keyword: userKeyword.trim(), level: levelFilter }),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PagedAdminResponse<LevelUserRecord>>(api.get(`/api/admin/levels/users?${userQuery.toString()}`, { silent: true }), navigate, role);
      return result || { records: [], total: 0 };
    },
  });
  const logsQuery = useQuery({
    queryKey: adminKeys.levelsLogs({ page: logPage, size, username: logUsername.trim(), bizType: bizType.trim() }),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PagedAdminResponse<ExpLogRecord>>(api.get(`/api/admin/levels/logs?${logQuery.toString()}`, { silent: true }), navigate, role);
      return result || { records: [], total: 0 };
    },
  });

  const overview = overviewQuery.data;
  const users = usersQuery.data?.records || [];
  const userTotal = usersQuery.data?.total || 0;
  const logs = logsQuery.data?.records || [];
  const logTotal = logsQuery.data?.total || 0;
  const existingExpRuleKeys = useMemo(() => (overview?.expRules || []).map((item) => String(item.key || "").trim()).filter(Boolean), [overview?.expRules]);
  const experienceBizTypeOptions = useMemo(() => {
    const normalizedCurrentBizType = String(bizType || "").trim();
    if (!normalizedCurrentBizType) return EXPERIENCE_BIZ_TYPE_OPTIONS;
    return EXPERIENCE_BIZ_TYPE_OPTIONS.some((item) => item.value === normalizedCurrentBizType)
      ? EXPERIENCE_BIZ_TYPE_OPTIONS
      : [...EXPERIENCE_BIZ_TYPE_OPTIONS, { value: normalizedCurrentBizType, label: normalizedCurrentBizType }];
  }, [bizType]);

  const refreshOverview = () => queryClient.invalidateQueries({ queryKey: adminKeys.levelsOverview() }).then(() => undefined);
  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: adminKeys.levelsUsers({ page: userPage, size, keyword: userKeyword.trim(), level: levelFilter }) }).then(() => undefined);
  const refreshLogs = () => queryClient.invalidateQueries({ queryKey: adminKeys.levelsLogs({ page: logPage, size, username: logUsername.trim(), bizType: bizType.trim() }) }).then(() => undefined);

  const openCreateLevelRule = () => {
    setLevelRuleEditing(null);
    setLevelRuleForm({ level: "", name: "", threshold: "0", enabled: true });
    setLevelRuleOpen(true);
  };

  const updateLevelRule = (item: LevelRuleRecord) => {
    setLevelRuleEditing(item);
    setLevelRuleForm({
      level: String(item.level ?? ""),
      name: String(item.name ?? ""),
      threshold: String(item.threshold ?? 0),
      enabled: item.enabled ?? true,
    });
    setLevelRuleOpen(true);
  };

  const submitLevelRule = async () => {
    const payload = {
      level: Number(levelRuleForm.level),
      name: String(levelRuleForm.name || "").trim(),
      threshold: Number(levelRuleForm.threshold),
      enabled: Boolean(levelRuleForm.enabled),
    };
    const result = levelRuleEditing
      ? await adminRequest(
        api.put(`/api/admin/levels/rules/${levelRuleEditing.level}`, {
          name: payload.name,
          threshold: payload.threshold,
          enabled: payload.enabled,
        }),
        navigate,
        role,
        "更新等级定义",
      )
      : await adminRequest(
        api.post("/api/admin/levels/rules", payload),
        navigate,
        role,
        "新增等级定义",
      );
    if (!result) return;
    setLevelRuleOpen(false);
    showAdminSuccess(formatAdminEntityMessage("等级定义", payload.name || `Lv.${payload.level}`, levelRuleEditing ? "已更新" : "已创建"));
    await Promise.all([refreshOverview(), refreshUsers()]);
  };

  const removeLevelRule = (item: LevelRuleRecord) => {
    setPendingLevelRuleRemove(item);
  };

  const confirmRemoveLevelRule = async () => {
    if (!pendingLevelRuleRemove) return;
    const result = await adminRequest(
      api.delete(`/api/admin/levels/rules/${pendingLevelRuleRemove.level}`),
      navigate,
      role,
      "删除等级定义",
    );
    if (!result) return;
    setPendingLevelRuleRemove(null);
    showAdminSuccess(formatAdminEntityMessage("等级定义", pendingLevelRuleRemove.name || `Lv.${pendingLevelRuleRemove.level}`, "已删除"));
    await Promise.all([refreshOverview(), refreshUsers()]);
  };

  const toggleLevelRuleEnabled = async (item: LevelRuleRecord, nextEnabled: boolean) => {
    const result = await adminRequest(
      api.put(`/api/admin/levels/rules/${item.level}`, {
        name: item.name,
        threshold: Number(item.threshold || 0),
        enabled: nextEnabled,
      }),
      navigate,
      role,
      nextEnabled ? "启用等级定义" : "停用等级定义",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("等级定义", item.name || `Lv.${item.level}`, nextEnabled ? "已启用" : "已停用"));
    await Promise.all([refreshOverview(), refreshUsers()]);
  };

  const openCreateExpRule = () => {
    setExpRuleEditing(null);
    setExpRuleForm({ key: "", name: "", description: "", minExp: "0", maxExp: "0", maxObtainCount: "", enabled: true });
    setExpRuleOpen(true);
  };

  const updateExpRule = (item: ExpRuleRecord) => {
    setExpRuleEditing(item);
    setExpRuleForm({
      key: String(item.key ?? ""),
      name: String(item.label ?? ""),
      description: String(item.description ?? ""),
      minExp: String(item.minExp ?? 0),
      maxExp: String(item.maxExp ?? 0),
      maxObtainCount: item.maxObtainCount === null || item.maxObtainCount === undefined ? "" : String(item.maxObtainCount),
      enabled: item.enabled ?? true,
    });
    setExpRuleOpen(true);
  };

  const submitExpRule = async () => {
    const payload = {
      ruleKey: String(expRuleForm.key || "").trim(),
      name: String(expRuleForm.name || "").trim(),
      description: String(expRuleForm.description || "").trim(),
      minExp: Number(expRuleForm.minExp),
      maxExp: Number(expRuleForm.maxExp),
      maxObtainCount: expRuleForm.maxObtainCount === "" ? null : Number(expRuleForm.maxObtainCount),
      enabled: Boolean(expRuleForm.enabled),
    };
    const result = expRuleEditing
      ? await adminRequest(
        api.put(`/api/admin/levels/exp-rules/${expRuleEditing.key}`, {
          name: payload.name,
          description: payload.description,
          minExp: payload.minExp,
          maxExp: payload.maxExp,
          maxObtainCount: payload.maxObtainCount,
          enabled: payload.enabled,
        }),
        navigate,
        role,
        "更新经验规则",
      )
      : await adminRequest(
        api.post("/api/admin/levels/exp-rules", payload),
        navigate,
        role,
        "新增经验规则",
      );
    if (!result) return;
    setExpRuleOpen(false);
    showAdminSuccess(formatAdminEntityMessage("经验规则", payload.name || payload.ruleKey, expRuleEditing ? "已更新" : "已创建"));
    await refreshOverview();
  };

  const removeExpRule = (item: ExpRuleRecord) => {
    setPendingExpRuleRemove(item);
  };

  const confirmRemoveExpRule = async () => {
    if (!pendingExpRuleRemove) return;
    const result = await adminRequest(
      api.delete(`/api/admin/levels/exp-rules/${pendingExpRuleRemove.key}`),
      navigate,
      role,
      "删除经验规则",
    );
    if (!result) return;
    setPendingExpRuleRemove(null);
    showAdminSuccess(formatAdminEntityMessage("经验规则", pendingExpRuleRemove.label || pendingExpRuleRemove.key, "已删除"));
    await refreshOverview();
  };

  const toggleExpRuleEnabled = async (item: ExpRuleRecord, nextEnabled: boolean) => {
    const result = await adminRequest(
      api.put(`/api/admin/levels/exp-rules/${item.key}`, {
        name: item.label,
        description: item.description,
        minExp: Number(item.minExp || 0),
        maxExp: Number(item.maxExp || 0),
        maxObtainCount: item.maxObtainCount,
        enabled: nextEnabled,
      }),
      navigate,
      role,
      nextEnabled ? "启用经验规则" : "停用经验规则",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("经验规则", item.label || item.key, nextEnabled ? "已启用" : "已停用"));
    await refreshOverview();
  };

  const updateUser = async (item: LevelUserRecord) => {
    const level = await openAdminPrompt({
      title: "更新用户等级",
      message: `设置 ${item.username} 的等级。`,
      label: "用户等级",
      defaultValue: String(item.level ?? 1),
      confirmLabel: "下一步",
      required: true,
    });
    if (level === null) return;
    const exp = await openAdminPrompt({
      title: "更新用户等级",
      message: `设置 ${item.username} 的经验值。`,
      label: "经验值",
      defaultValue: String(item.exp ?? 0),
      confirmLabel: "确认更新",
      required: true,
    });
    if (exp === null) return;
    const result = await adminRequest(
      api.put(`/api/admin/levels/users/${item.id}`, { level: Number(level), exp: Number(exp) }),
      navigate,
      role,
      "更新用户等级",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("用户", item.username, "等级已更新"));
    await refreshUsers();
  };

  const recalculate = async () => {
    const result = await adminRequest(api.post("/api/admin/levels/recalculate", {}), navigate, role, "重算等级");
    if (!result) return;
    showAdminSuccess("等级重算已完成");
    await Promise.all([refreshOverview(), refreshUsers(), refreshLogs()]);
  };

  return (
    <AdminPageShell
      title="等级体系"
      description="查看等级分布、经验规则，并校准用户等级。"
    >
      <AdminStatGrid>
        <AdminStatCard label="用户数" value={overview?.stats?.userCount ?? "-"} />
        <AdminStatCard label="总经验值" value={overview?.stats?.totalExp ?? "-"} />
        <AdminStatCard label="今日经验变化" value={overview?.stats?.todayExp ?? "-"} />
        <AdminStatCard label="最高等级" value={`${overview?.stats?.highestLevelName || "-"} / Lv.${overview?.stats?.highestLevel || "-"}`} hint={`人数 ${overview?.stats?.highestLevelUsers ?? "-"}`} />
      </AdminStatGrid>

      <div className="mb-6 flex items-center justify-end">
        <button type="button" onClick={recalculate} className={primaryButtonClassName()}>
          <RefreshCcw size={16} />
          重算等级
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.82),rgba(255,255,255,0.96))] p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-black text-slate-900">等级定义</h3>
              <p className="mt-1 text-sm text-slate-500">定义每一级的名称、阈值与启用状态。</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                {(overview?.levelRules || []).length} 条定义
              </span>
              <AddButton onClick={openCreateLevelRule}>新增定义</AddButton>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>等级</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>经验阈值</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(overview?.levelRules || []).map((item) => (
                <TableRow key={item.level}>
                  <TableCell>Lv.{item.level}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.threshold}</TableCell>
                      <TableCell>
                        <AdminTableSwitch
                          checked={Boolean(item.enabled ?? true)}
                          onCheckedChange={(next) => void toggleLevelRuleEnabled(item, next)}
                        />
                      </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => updateLevelRule(item)} className={secondaryButtonClassName()}><Edit3 size={14} />调整定义</button>
                      <button type="button" onClick={() => removeLevelRule(item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-[32px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-black text-slate-900">等级用户</h3>
              <p className="mt-1 text-sm text-slate-500">按用户或等级快速筛查，并校准异常等级。</p>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
              共 {userTotal} 人
            </span>
          </div>
          <FilterBar>
            <FilterField label="关键词">
              <input value={userKeyword} onChange={(e) => { setUserKeyword(e.target.value); setUserPage(1); }} className={inputClassName()} placeholder="用户名 / 邮箱" />
            </FilterField>
            <FilterField label="等级">
              <input value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setUserPage(1); }} className={inputClassName()} placeholder="如 3" />
            </FilterField>
          </FilterBar>
          <div className="mt-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>经验</TableHead>
                  <TableHead>进度</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.username}</TableCell>
                    <TableCell>{item.levelName} / Lv.{item.level}</TableCell>
                    <TableCell>{item.exp}</TableCell>
                    <TableCell>{item.progress?.current ?? 0} / {item.progress?.nextThreshold ?? "-"}</TableCell>
                    <TableCell>
                      <button type="button" onClick={() => updateUser(item)} className={secondaryButtonClassName()}><Edit3 size={14} />调整</button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {users.length === 0 && <AdminEmptyState message="暂无等级用户数据。" />}
            <div className="mt-4">
              <AdminPagination current={userPage} size={size} total={userTotal} onChange={setUserPage} />
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.88),rgba(255,255,255,0.98))] p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-black text-slate-900">经验规则</h3>
              <p className="mt-1 text-sm text-slate-500">配置每种行为的经验变化区间与启用状态。</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                {(overview?.expRules || []).length} 条规则
              </span>
              <AddButton onClick={openCreateExpRule}>新增规则</AddButton>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>规则</TableHead>
                <TableHead>经验范围</TableHead>
                <TableHead>最多可获得</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(overview?.expRules || []).map((item) => (
                <TableRow key={item.key}>
                  <TableCell>
                    <div className="font-bold text-slate-800">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.description || "-"}</div>
                  </TableCell>
                  <TableCell>{item.rangeText}</TableCell>
                  <TableCell>{item.maxObtainCount && item.maxObtainCount > 0 ? `${item.maxObtainCount} 次` : "不限制"}</TableCell>
                      <TableCell>
                        <AdminTableSwitch
                          checked={Boolean(item.enabled)}
                          onCheckedChange={(next) => void toggleExpRuleEnabled(item, next)}
                        />
                      </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => updateExpRule(item)} className={secondaryButtonClassName()}><Edit3 size={14} />调整规则</button>
                      <button type="button" onClick={() => removeExpRule(item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-[32px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-black text-slate-900">经验日志</h3>
              <p className="mt-1 text-sm text-slate-500">从日志维度回看经验流转，验证规则是否按预期生效。</p>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
              共 {logTotal} 条
            </span>
          </div>
          <FilterBar>
            <FilterField label="用户名">
              <input value={logUsername} onChange={(e) => { setLogUsername(e.target.value); setLogPage(1); }} className={inputClassName()} />
            </FilterField>
            <FilterField label="业务类型">
              <select value={bizType} onChange={(e) => { setBizType(e.target.value); setLogPage(1); }} className={inputClassName()}>
                <option value="">全部业务</option>
                {experienceBizTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </FilterField>
          </FilterBar>
          <div className="mt-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>业务</TableHead>
                  <TableHead>经验变化</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.user?.username || "-"}</TableCell>
                    <TableCell>{formatExperienceBizType(item.bizLabel || item.bizType)}</TableCell>
                    <TableCell>{item.expChange}</TableCell>
                    <TableCell>{item.reason || "-"}</TableCell>
                    <TableCell>{formatMaybeDate(item.createTime)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {logs.length === 0 && <AdminEmptyState message="暂无经验日志。" />}
            <div className="mt-4">
              <AdminPagination current={logPage} size={size} total={logTotal} onChange={setLogPage} />
            </div>
          </div>
        </section>
      </div>

      <FormDialog
        open={levelRuleOpen}
        onOpenChange={setLevelRuleOpen}
        title={levelRuleEditing ? `编辑 Lv.${levelRuleEditing.level} 等级定义` : "新增等级定义"}
        description="可配置等级名称、经验阈值与启用状态。新增或删除后会自动重算受影响用户等级。"
        submitLabel={levelRuleEditing ? "保存定义" : "创建定义"}
        contentClassName="w-[min(640px,calc(100vw-2rem))]"
        bodyClassName="px-5 py-4"
        onSubmit={submitLevelRule}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="等级值">
            <input
              type="number"
              min={1}
              value={levelRuleForm.level}
              disabled={Boolean(levelRuleEditing)}
              onChange={(e) => setLevelRuleForm((prev) => ({ ...prev, level: e.target.value }))}
              className={inputClassName()}
            />
          </Field>
          <Field label="等级名称">
            <input
              value={levelRuleForm.name}
              onChange={(e) => setLevelRuleForm((prev) => ({ ...prev, name: e.target.value }))}
              className={inputClassName()}
            />
          </Field>
          <Field label="经验阈值">
            <input
              type="number"
              min={0}
              value={levelRuleForm.threshold}
              onChange={(e) => setLevelRuleForm((prev) => ({ ...prev, threshold: e.target.value }))}
              className={inputClassName()}
            />
          </Field>
          <Field label="启用状态">
            <AdminFormSwitch
              label="启用该等级定义"
              checked={Boolean(levelRuleForm.enabled)}
              onCheckedChange={(next) => setLevelRuleForm((prev) => ({ ...prev, enabled: next }))}
            />
          </Field>
        </div>
      </FormDialog>

      <FormDialog
        open={expRuleOpen}
        onOpenChange={setExpRuleOpen}
        title={expRuleEditing ? `编辑经验规则 ${expRuleEditing.label}` : "新增经验规则"}
        description="固定奖励规则可将最小值和最大值设置成一致；随机奖励规则可设置一个范围。"
        submitLabel={expRuleEditing ? "保存规则" : "创建规则"}
        contentClassName="w-[min(760px,calc(100vw-2rem))]"
        bodyClassName="px-5 py-4"
        onSubmit={submitExpRule}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="规则标识">
            <input
              value={expRuleForm.key}
              readOnly
              className={`${inputClassName()} bg-slate-50 text-slate-500`}
              placeholder="将根据规则名称自动生成"
            />
          </Field>
          <Field label="规则名称">
            <input
              value={expRuleForm.name}
              onChange={(e) => {
                const nextName = e.target.value;
                setExpRuleForm((prev) => ({
                  ...prev,
                  name: nextName,
                  key: expRuleEditing ? prev.key : generateMachineIdentifier(nextName, "exp_rule", existingExpRuleKeys),
                }));
              }}
              className={inputClassName()}
            />
          </Field>
          <Field label="最小经验值">
            <input
              type="number"
              min={0}
              value={expRuleForm.minExp}
              onChange={(e) => setExpRuleForm((prev) => ({ ...prev, minExp: e.target.value }))}
              className={inputClassName()}
            />
          </Field>
          <Field label="最大经验值">
            <input
              type="number"
              min={0}
              value={expRuleForm.maxExp}
              onChange={(e) => setExpRuleForm((prev) => ({ ...prev, maxExp: e.target.value }))}
              className={inputClassName()}
            />
          </Field>
          <Field label="最多可获得次数">
            <input
              type="number"
              min={0}
              value={expRuleForm.maxObtainCount}
              onChange={(e) => setExpRuleForm((prev) => ({ ...prev, maxObtainCount: e.target.value }))}
              className={inputClassName()}
              placeholder="留空或 0 表示不限制"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="规则说明">
              <textarea
                value={expRuleForm.description}
                onChange={(e) => setExpRuleForm((prev) => ({ ...prev, description: e.target.value }))}
                className={textareaClassName()}
              />
            </Field>
          </div>
          <Field label="启用状态">
            <AdminFormSwitch
              label="启用该经验规则"
              checked={Boolean(expRuleForm.enabled)}
              onCheckedChange={(next) => setExpRuleForm((prev) => ({ ...prev, enabled: next }))}
            />
          </Field>
        </div>
      </FormDialog>

      <DeleteConfirmDialog
        open={Boolean(pendingLevelRuleRemove)}
        title="删除等级定义"
        message={pendingLevelRuleRemove ? `确认删除 Lv.${pendingLevelRuleRemove.level} ${pendingLevelRuleRemove.name}？删除后会自动重算受影响用户等级。` : ""}
        confirmLabel="确认删除"
        onCancel={() => setPendingLevelRuleRemove(null)}
        onConfirm={() => void confirmRemoveLevelRule()}
      />

      <DeleteConfirmDialog
        open={Boolean(pendingExpRuleRemove)}
        title="删除经验规则"
        message={pendingExpRuleRemove ? `确认删除经验规则 ${pendingExpRuleRemove.label || pendingExpRuleRemove.key}？` : ""}
        confirmLabel="确认删除"
        onCancel={() => setPendingExpRuleRemove(null)}
        onConfirm={() => void confirmRemoveExpRule()}
      />
    </AdminPageShell>
  );
}

async function adminRequest<T>(
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

type ExcelEditorErrorBoundaryProps = {
  resetKey: string;
  fallback: React.ReactNode;
  children: React.ReactNode;
};

class ExcelEditorErrorBoundary extends Component<ExcelEditorErrorBoundaryProps, { hasError: boolean }> {
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

function AdminDialogHost() {
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

function showAdminSuccess(message: string) {
  adminDialogController?.showFeedback({ kind: "feedback", type: "success", message });
}

function showAdminError(message: string) {
  toast.error(message);
}

async function runAdminDelete(options: {
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

function openAdminConfirm(options: Omit<AdminConfirmRequest, "kind" | "resolve">) {
  return adminDialogController?.openConfirm(options) ?? Promise.resolve(false);
}

function openAdminPrompt(options: Omit<AdminPromptRequest, "kind" | "resolve">) {
  return adminDialogController?.openPrompt(options) ?? Promise.resolve<string | null>(null);
}

function formatAdminEntityMessage(entity: string, value: unknown, suffix: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? `${entity}《${text}》${suffix}` : `${entity}${suffix}`;
}

function useAdminRole() {
  const { user } = useSession();
  return hasAdminConsoleAccess(user?.role) ? (user?.role as AdminRole) : null;
}

function DeleteConfirmDialog({
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

function FormDialog({
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-bold text-slate-700">{label}</div>
      {children}
    </label>
  );
}

function AdminFormSwitch({
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

function AdminTableSwitch({
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

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function isEditableUserRole(value: unknown): value is AdminEditableUserRole {
  return value === "admin" || value === "moderator" || value === "user";
}

function defaultUserForm(): AdminUserForm {
  return { username: "", email: "", password: "", role: "user", status: 0 };
}

function defaultNotificationForm(): AdminNotificationForm {
  return { title: "", content: "", type: "system", status: "draft", targetType: "all", targetRoles: "", attachments: "" };
}

function defaultQuestionCategoryForm(): QuestionCategoryForm {
  return { name: "", description: "", groupName: "", sortOrder: 0, enabled: true };
}

function defaultQuestionForm(): AdminQuestionForm {
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

function defaultDynamicArrayRule(sheet = ""): QuestionDynamicArrayRuleForm {
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

function parseFormulaKeywords(value: unknown) {
  return String(value || "")
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDynamicArrayRulesFromJson(gradingRuleJson: unknown, fallbackSheet = ""): QuestionDynamicArrayRuleForm[] {
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

function buildDynamicArrayRuleJson(rules: QuestionDynamicArrayRuleForm[]) {
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

function defaultPointsRuleForm(defaultType = "daily"): PointsRuleForm {
  return { name: "", description: "", taskKey: "", points: 0, type: defaultType, enabled: true, userVisible: true, sortOrder: 0 };
}

function defaultPointsOptionForm(kind: PointsOptionKind): PointsOptionForm {
  return { kind, value: "", label: "", sortOrder: 0 };
}

function buildAdminOptionChoices(
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

function buildAdminOptionLabelMap(options: Array<{ value: string; label: string }>) {
  return new Map(options.map((item) => [item.value, item.label]));
}

function generateMachineIdentifier(label: unknown, prefix: string, existingValues: string[]) {
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

