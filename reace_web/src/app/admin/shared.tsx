import { Activity, AlertTriangle, BarChart3, BellRing, BookOpenCheck, ChevronLeft, ChevronRight, Coins, FileText, Plus, ShieldCheck, Trash2, Users, type LucideIcon } from "lucide-react";
import { useLocation } from "react-router";
import { getAdminModuleByPath, type AdminModuleKey } from "./config";
import { formatDateTime } from "../lib/format";

export const POINTS_TASK_KEY_OPTIONS = [
  { value: "daily_checkin", label: "每日签到" },
  { value: "daily_practice", label: "今日练习" },
  { value: "first_practice", label: "首次练习" },
];

export const POINTS_RULE_TYPE_OPTIONS = [
  { value: "daily", label: "每日任务" },
  { value: "once", label: "一次性任务" },
  { value: "system", label: "系统规则" },
];

export const EXPERIENCE_BIZ_TYPE_OPTIONS = [
  { value: "daily_checkin", label: "每日签到" },
  { value: "practice_complete", label: "完成练习" },
];

export const NOTIFICATION_TYPE_OPTIONS = [
  { value: "system", label: "系统通知" },
  { value: "announcement", label: "站内公告" },
  { value: "activity", label: "活动通知" },
  { value: "popup", label: "弹窗通知" },
];

export const NOTIFICATION_TARGET_OPTIONS = [
  { value: "all", label: "全体用户" },
  { value: "role", label: "指定角色" },
  { value: "user", label: "指定用户" },
];

export const ROLE_OPTIONS = [
  { value: "admin", label: "管理员" },
  { value: "moderator", label: "运营" },
  { value: "user", label: "普通用户" },
];

export const FEEDBACK_TYPE_OPTIONS = [
  { value: "performance_optimization", label: "性能优化" },
  { value: "feature_optimization", label: "功能优化" },
  { value: "new_feature", label: "新增功能" },
  { value: "other", label: "其他" },
];

const ADMIN_PAGE_DESCRIPTIONS: Record<AdminModuleKey, string> = {
  overview: "集中查看平台运营、题库状态、待办事项与整体健康情况。",
  "home-content": "统一管理首页教程内容、分类结构与发布编排。",
  notifications: "管理站内通知的创建、发布、触达与效果统计。",
  users: "统一管理平台用户信息、积分等级与账号状态。",
  questions: "统一管理题目、模板校验、闯关关卡与发布验证流程。",
  "question-categories": "统一管理分类结构、前台章节映射与题目归类状态。",
  templates: "管理平台模板资源，配置积分与上下架状态。",
  points: "统一管理积分规则、手动发放与积分流水。",
  levels: "查看等级分布、经验规则，并校准用户等级。",
  assistant: "统一管理模型配置、调用安全、失败分析与用户调用统计。",
  qa: "统一管理案例求助、答疑审核、精选沉淀与答疑者协作流程。",
  "file-recycle-bin": "统一管理已删除文件，支持恢复、过期清理与风险控制。",
};

export function AdminPageShell({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const module = getAdminModuleByPath(location.pathname);
  const resolvedTitle = title || module?.label || "后台管理";
  const resolvedDescription = description || (module ? ADMIN_PAGE_DESCRIPTIONS[module.key] : "");

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight text-[#1f1f1f] md:text-[30px]">{resolvedTitle}</h1>
          {resolvedDescription ? <p className="mt-1.5 text-[15px] leading-6 text-[#667085]">{resolvedDescription}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] md:p-5">
      <div className="mb-4 flex flex-col gap-2 border-b border-[#edf0f5] pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-[#1f1f1f]">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[#667085]">{description}</p> : null}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function AdminStatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function AdminStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  const Icon = getStatIcon(label);
  const tone = getStatTone(label);
  return (
    <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tone.bg} ${tone.text}`}>
          <Icon size={24} />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[#475467]">{label}</div>
          <div className="mt-2 text-[30px] font-semibold leading-none text-[#101828]">{value}</div>
          {hint ? <div className="mt-2 text-sm text-[#667085]">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 rounded-[8px] border border-[#e5e7eb] bg-[#fbfcfe] p-4">{children}</div>;
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="min-w-[140px] flex-1">
      <div className="mb-1.5 text-sm font-medium text-[#344054]">{label}</div>
      {children}
    </label>
  );
}

export function inputClassName() {
  return "h-10 w-full rounded-[4px] border border-[#d0d5dd] bg-white px-3 text-sm text-[#1f2937] outline-none transition placeholder:text-[#98a2b3] focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10";
}

export function textareaClassName() {
  return "min-h-[112px] w-full rounded-[4px] border border-[#d0d5dd] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none transition placeholder:text-[#98a2b3] focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10";
}

export function primaryButtonClassName() {
  return "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] bg-[#1677ff] px-4 text-sm font-semibold text-white shadow-[0_2px_6px_rgba(22,119,255,0.22)] transition hover:bg-[#0958d9] disabled:cursor-not-allowed disabled:opacity-60";
}

export function secondaryButtonClassName() {
  return "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border border-[#d0d5dd] bg-white px-4 text-sm font-semibold text-[#344054] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#4096ff] hover:text-[#1677ff] disabled:cursor-not-allowed disabled:opacity-60";
}

export function answerRangeButtonClassName() {
  return "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[2px] border border-[#1677ff] bg-[#1677ff] px-3 text-sm font-normal text-white shadow-sm transition hover:border-[#4096ff] hover:bg-[#4096ff] disabled:cursor-not-allowed disabled:border-[#d9d9d9] disabled:bg-[#f5f5f5] disabled:text-[#bfbfbf] disabled:shadow-none";
}

export function formDialogContentClassName(contentClassName = "") {
  return `!flex max-h-[92vh] w-[min(760px,calc(100vw-2rem))] !flex-col !gap-0 overflow-hidden p-0 sm:max-w-none ${contentClassName}`;
}

export function formDialogBodyClassName(bodyClassName = "") {
  return `min-h-0 grow overflow-y-auto px-5 py-4 ${bodyClassName}`;
}

export function AddButton({
  children = "新建",
  onClick,
  disabled,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={primaryButtonClassName()}>
      <Plus size={16} />
      {children}
    </button>
  );
}

export function AdminEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[#d0d5dd] bg-[#fbfcfe] px-6 py-12 text-center text-sm text-[#667085]">
      {message}
    </div>
  );
}

export function AdminPermissionNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[8px] border border-[#ffd666] bg-[#fffbe6] px-4 py-3 text-sm text-[#ad6800]">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function AdminPagination({
  current,
  size,
  total,
  onChange,
}: {
  current: number;
  size: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / Math.max(size, 1)));

  return (
    <div className="flex flex-col items-start justify-between gap-3 border-t border-[#edf0f5] pt-4 sm:flex-row sm:items-center">
      <div className="text-sm text-[#667085]">第 {current} / {pages} 页，共 {total} 条</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, current - 1))}
          disabled={current <= 1}
          className={secondaryButtonClassName()}
        >
          <ChevronLeft size={16} />
          上一页
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(pages, current + 1))}
          disabled={current >= pages}
          className={secondaryButtonClassName()}
        >
          下一页
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function statusBadgeClassName(value?: string | number | null) {
  const normalized = String(value ?? "").toLowerCase();
  if (["approved", "active", "handled", "sent", "true", "1", "0"].includes(normalized)) {
    return "rounded-[4px] bg-[#dff7ea] px-2.5 py-1 text-xs font-semibold text-[#039855]";
  }
  if (["pending", "draft", "editing", "scheduled"].includes(normalized)) {
    return "rounded-[4px] bg-[#fff4db] px-2.5 py-1 text-xs font-semibold text-[#d46b08]";
  }
  if (["rejected", "deleted", "ignored", "false", "99", "-1"].includes(normalized)) {
    return "rounded-[4px] bg-[#ffe4e8] px-2.5 py-1 text-xs font-semibold text-[#d92d20]";
  }
  return "rounded-[4px] bg-[#eef2f6] px-2.5 py-1 text-xs font-semibold text-[#475467]";
}

export function formatAdminStatus(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  const map: Record<string, string> = {
    "0": "正常",
    "1": "已处理",
    "2": "已忽略",
    "-1": "未通过",
    "99": "已删除",
    active: "正常",
    approved: "已通过",
    pending: "待处理",
    rejected: "已驳回",
    deleted: "已删除",
    locked: "已锁定",
    handled: "已处理",
    ignored: "已忽略",
    sent: "已发送",
    draft: "草稿",
    scheduled: "定时中",
    editing: "编辑中",
    true: "启用",
    false: "停用",
  };
  return map[normalized] || String(value ?? "-");
}

export function formatAdminRole(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  const map: Record<string, string> = {
    admin: "管理员",
    moderator: "运营",
    user: "用户",
  };
  return map[normalized] || String(value ?? "-");
}

export function AdminBulkActions({
  selectedCount,
  totalCount,
  allVisibleSelected,
  deleteLabel = "删除选中",
  processingLabel = "删除中...",
  deleting = false,
  onToggleAll,
  onClear,
  onDeleteSelected,
}: {
  selectedCount: number;
  totalCount: number;
  allVisibleSelected: boolean;
  deleteLabel?: string;
  processingLabel?: string;
  deleting?: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  onDeleteSelected: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#e5e7eb] bg-[#fbfcfe] px-3 py-2 text-sm text-[#475467]">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onToggleAll} disabled={totalCount === 0} className={secondaryButtonClassName()}>
          {allVisibleSelected ? "取消全选" : "全选本页"}
        </button>
        <button type="button" onClick={onClear} disabled={selectedCount === 0} className={secondaryButtonClassName()}>
          清空选择
        </button>
        <span className="text-xs text-[#8c8c8c]">已选 {selectedCount} / 本页 {totalCount}</span>
      </div>
      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={selectedCount === 0 || deleting}
        className={`${secondaryButtonClassName()} !border-rose-200 !text-rose-600 hover:!border-rose-400 hover:!text-rose-700`}
      >
        <Trash2 size={14} />
        {deleting ? processingLabel : `${deleteLabel} (${selectedCount})`}
      </button>
    </div>
  );
}

export function AdminBulkCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 rounded border-[#d0d5dd] text-[#1677ff] focus:ring-[#1677ff]/20"
    />
  );
}

function getStatIcon(label: string): LucideIcon {
  if (/用户|账号|会员/.test(label)) return Users;
  if (/通知|消息/.test(label)) return BellRing;
  if (/积分|经验/.test(label)) return Coins;
  if (/等级|状态|安全|异常|锁定/.test(label)) return ShieldCheck;
  if (/题|练习|教程/.test(label)) return BookOpenCheck;
  if (/文件|模板|草稿/.test(label)) return FileText;
  if (/率|趋势|调用/.test(label)) return BarChart3;
  return Activity;
}

function getStatTone(label: string) {
  if (/异常|锁定|失败|待处理|风险/.test(label)) return { bg: "bg-[#fff1f0]", text: "text-[#ff4d4f]" };
  if (/今日|新增|下载|签到|发放|调用/.test(label)) return { bg: "bg-[#ecfdf3]", text: "text-[#12b76a]" };
  if (/草稿|审核|需|待/.test(label)) return { bg: "bg-[#fff7e6]", text: "text-[#fa8c16]" };
  if (/等级|积分|经验/.test(label)) return { bg: "bg-[#f4f3ff]", text: "text-[#7a5af8]" };
  return { bg: "bg-[#e6f4ff]", text: "text-[#1677ff]" };
}

export function formatQuestionType(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  const map: Record<string, string> = {
    single_choice: "单选题",
    multiple_choice: "多选题",
    true_false: "判断题",
    excel_template: "Excel 模板题",
  };
  return map[normalized] || String(value ?? "-");
}

export function formatFeedbackType(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  const map: Record<string, string> = {
    performance_optimization: "性能优化",
    feature_optimization: "功能优化",
    new_feature: "新增功能",
    other: "其他",
  };
  return map[normalized] || String(value ?? "-");
}

export function formatNotificationType(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  const map: Record<string, string> = Object.fromEntries(
    NOTIFICATION_TYPE_OPTIONS.map((item) => [item.value, item.label]),
  );
  return map[normalized] || String(value ?? "-");
}

export function formatNotificationTarget(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  const map: Record<string, string> = Object.fromEntries(
    NOTIFICATION_TARGET_OPTIONS.map((item) => [item.value, item.label]),
  );
  return map[normalized] || String(value ?? "-");
}

export function formatRoleList(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "无角色限制";
  }
  const map: Record<string, string> = Object.fromEntries(
    ROLE_OPTIONS.map((item) => [item.value, item.label]),
  );
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => map[item.toLowerCase()] || item)
    .join("、");
}

export function formatPointsRuleType(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  const map: Record<string, string> = {
    daily: "每日任务",
    once: "一次性任务",
    system: "系统规则",
  };
  return map[normalized] || String(value ?? "-");
}

export function formatPointsTaskKey(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "无任务标识";
  }
  const normalized = String(value).toLowerCase();
  const map: Record<string, string> = Object.fromEntries(
    POINTS_TASK_KEY_OPTIONS.map((item) => [item.value, item.label]),
  );
  return map[normalized] || String(value);
}

export function formatExperienceBizType(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "全部业务";
  }
  const normalized = String(value).toLowerCase();
  const map: Record<string, string> = Object.fromEntries(
    EXPERIENCE_BIZ_TYPE_OPTIONS.map((item) => [item.value, item.label]),
  );
  return map[normalized] || String(value);
}

export function formatMaybeDate(value: unknown) {
  if (!value) return "-";
  if (typeof value === "string") return formatDateTime(value);
  return String(value);
}
