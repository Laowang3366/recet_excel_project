import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
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

export function AdminPageShell({
  description: _description,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return <div className="space-y-4 p-4 md:p-5">{children}</div>;
}

export function AdminSection({
  title,
  description: _description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2px] border border-[#f0f0f0] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-4 flex flex-col gap-2 border-b border-[#f0f0f0] pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-[16px] font-medium text-[#262626]">{title}</h2>
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
  hint: _hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-[2px] border border-[#f0f0f0] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="text-[14px] font-normal text-[#8c8c8c]">{label}</div>
      <div className="mt-2 text-[30px] font-normal leading-none text-[#262626]">{value}</div>
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 rounded-[2px] border border-[#f0f0f0] bg-[#fafafa] p-3">{children}</div>;
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
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </label>
  );
}

export function inputClassName() {
  return "h-9 w-full rounded-[2px] border border-[#d9d9d9] bg-white px-3 text-sm text-[#262626] outline-none transition placeholder:text-[#bfbfbf] focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10";
}

export function textareaClassName() {
  return "min-h-[112px] w-full rounded-[2px] border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#262626] outline-none transition placeholder:text-[#bfbfbf] focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10";
}

export function primaryButtonClassName() {
  return "inline-flex h-8 items-center justify-center gap-1.5 rounded-[2px] bg-[#1677ff] px-3 text-sm font-normal text-white transition hover:bg-[#4096ff] disabled:opacity-60";
}

export function secondaryButtonClassName() {
  return "inline-flex h-8 items-center justify-center gap-1.5 rounded-[2px] border border-[#d9d9d9] bg-white px-3 text-sm font-normal text-[#595959] transition hover:border-[#4096ff] hover:text-[#1677ff]";
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
    <div className="rounded-[2px] border border-dashed border-[#d9d9d9] bg-white px-6 py-12 text-center text-sm text-[#8c8c8c]">
      {message}
    </div>
  );
}

export function AdminPermissionNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[2px] border border-[#ffe58f] bg-[#fffbe6] px-4 py-3 text-sm text-[#ad6800]">
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
    <div className="flex items-center justify-between gap-3 border-t border-[#f0f0f0] pt-4">
      <div className="text-sm text-[#8c8c8c]">第 {current} / {pages} 页，共 {total} 条</div>
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
    return "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700";
  }
  if (["pending", "draft", "editing"].includes(normalized)) {
    return "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700";
  }
  if (["rejected", "deleted", "ignored", "false", "99", "-1"].includes(normalized)) {
    return "rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700";
  }
  return "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600";
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
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-sm text-[#595959]">
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
      className="h-4 w-4 rounded border-[#d9d9d9] text-[#1677ff] focus:ring-[#1677ff]/20"
    />
  );
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
