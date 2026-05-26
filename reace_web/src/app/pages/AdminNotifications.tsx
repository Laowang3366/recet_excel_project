import { useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  AlignLeft,
  BarChart3,
  Bell,
  Bot,
  Bold,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  ImageIcon,
  Inbox,
  Italic,
  Link,
  List,
  Megaphone,
  RefreshCw,
  Search,
  Smile,
  UsersRound,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import {
  buildNotificationPayload,
  DEFAULT_NOTIFICATION_META,
  getNotificationReachEstimate,
  getNotificationTargetLabel,
  parseNotificationMeta,
  type NotificationMeta,
} from "../admin/notification-form";
import { applyNotificationEditorCommand, type NotificationEditorCommand } from "../admin/notification-rich-text";
import {
  notificationConfirmDialogContentClassName,
  notificationFormDialogBodyClassName,
  notificationFormDialogContentClassName,
  notificationFormDialogFooterClassName,
} from "../admin/notification-dialog-layout";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import {
  AdminBulkCheckbox,
  AdminEmptyState,
  AdminPageShell,
  AdminPagination,
  formatAdminStatus,
  formatMaybeDate,
  formatNotificationTarget,
  formatNotificationType,
  formatRoleList,
  inputClassName,
  NOTIFICATION_TARGET_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
  primaryButtonClassName,
  ROLE_OPTIONS,
  secondaryButtonClassName,
  statusBadgeClassName,
} from "../admin/shared";
import {
  AdminNotificationForm,
  AdminNotificationRecord,
  AdminNotificationStats,
  AdminUserRecord,
  adminRequest,
  DeleteConfirmDialog,
  defaultNotificationForm,
  formatAdminEntityMessage,
  openAdminConfirm,
  PagedAdminResponse,
  runAdminBulkDelete,
  runAdminDelete,
  showAdminSuccess,
  useAdminRole,
} from "./AdminConsoleShared";

type NotificationTab = "all" | "draft" | "scheduled" | "sent" | "popup";

type NotificationDeliveryFields = {
  totalCount?: number | null;
  readCount?: number | null;
  sendTime?: string | null;
};

type SendConfirmTarget =
  | { kind: "record"; item: AdminNotificationRecord }
  | { kind: "form" }
  | null;

const NOTIFICATION_TABS: Array<{ key: NotificationTab; label: string }> = [
  { key: "all", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "scheduled", label: "定时中" },
  { key: "sent", label: "已发布" },
  { key: "popup", label: "弹窗通知" },
];

const NOTIFICATION_EDITOR_COMMANDS: Array<{ command: NotificationEditorCommand; icon: typeof Bold; label: string }> = [
  { command: "bold", icon: Bold, label: "加粗" },
  { command: "italic", icon: Italic, label: "斜体" },
  { command: "paragraph", icon: AlignLeft, label: "段落" },
  { command: "list", icon: List, label: "列表" },
  { command: "smile", icon: Smile, label: "表情" },
  { command: "link", icon: Link, label: "链接" },
  { command: "image", icon: ImageIcon, label: "图片" },
];

export function AdminNotifications() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminNotificationRecord | null>(null);
  const [pendingRemove, setPendingRemove] = useState<AdminNotificationRecord | null>(null);
  const [pendingSend, setPendingSend] = useState<SendConfirmTarget>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [form, setForm] = useState<AdminNotificationForm>(defaultNotificationForm());
  const [formMeta, setFormMeta] = useState<Required<NotificationMeta>>({ ...DEFAULT_NOTIFICATION_META });
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
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
  const deliveryStats = useMemo(() => summarizeDelivery(records), [records]);
  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return records.filter((item) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "popup" ? item.type === "popup" : String(item.status || "").toLowerCase() === activeTab);
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesTarget = targetFilter === "all" || item.targetType === targetFilter;
      const matchesKeyword =
        !normalizedKeyword ||
        [item.title, item.content, formatNotificationTarget(item.targetType), formatNotificationType(item.type)]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword);
      return matchesTab && matchesType && matchesTarget && matchesKeyword;
    });
  }, [activeTab, keyword, records, targetFilter, typeFilter]);
  const bulkSelection = useAdminBulkSelection(filteredRecords, (item) => item.id);
  const previewNotification = records[0] || null;

  const refreshNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.notificationsStats() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.notifications({ page, size }) }),
    ]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultNotificationForm());
    setFormMeta({ ...DEFAULT_NOTIFICATION_META });
    setOpen(true);
  };

  const openTemplate = () => {
    setEditing(null);
    setForm({
      ...defaultNotificationForm(),
      title: "AI 助手升级通知",
      content: "新的模型配置已上线，回答更稳定。",
      type: "announcement",
      status: "draft",
      targetType: "all",
    });
    setFormMeta({ ...DEFAULT_NOTIFICATION_META, actionText: "立即查看", actionUrl: "/tools" });
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
      targetUserIds: item.targetUserIds || "",
      attachments: item.attachments || "",
      scheduledTime: item.scheduledTime || null,
      pinned: Boolean(item.pinned),
    });
    const parsedMeta = parseNotificationMeta(item.attachments);
    setFormMeta({
      ...parsedMeta,
      scheduled: item.status === "scheduled" || Boolean(item.scheduledTime) || parsedMeta.scheduled,
      sendAt: toDateTimeLocal(item.scheduledTime) || parsedMeta.sendAt,
      pinned: Boolean(item.pinned) || parsedMeta.pinned,
    });
    setOpen(true);
  };

  const duplicateNotification = (item: AdminNotificationRecord) => {
    setEditing(null);
    setForm({
      title: `${item.title || "通知"} 副本`,
      content: item.content || "",
      type: item.type || "system",
      status: "draft",
      targetType: item.targetType || "all",
      targetRoles: item.targetRoles || "",
      targetUserIds: item.targetUserIds || "",
      attachments: item.attachments || "",
      scheduledTime: null,
      pinned: Boolean(item.pinned),
    });
    setFormMeta(parseNotificationMeta(item.attachments));
    setOpen(true);
  };

  const resetFilters = () => {
    setTypeFilter("all");
    setTargetFilter("all");
    setKeyword("");
  };

  const saveNotification = async (statusOverride?: string) => {
    const payload = buildNotificationPayload(form, formMeta, statusOverride);
    if (editing) {
      const result = await adminRequest<AdminNotificationRecord>(api.put(`/api/admin/notifications/${editing.id}`, payload), navigate, role, "更新通知");
      if (!result) return false;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("通知", editing.title || result?.title || form.title, "已更新"));
    } else {
      const result = await adminRequest<AdminNotificationRecord>(api.post("/api/admin/notifications", payload), navigate, role, "创建通知");
      if (!result) return false;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("通知", result?.title || form.title, "已创建"));
    }
    await refreshNotifications();
    return true;
  };

  const submit = async () => {
    await saveNotification(editing ? undefined : "draft");
  };

  const sendNow = async (item: AdminNotificationRecord) => {
    setPendingSend({ kind: "record", item });
  };

  const confirmSend = async () => {
    if (!pendingSend) return;
    if (pendingSend.kind === "form") {
      const saved = await saveNotification("sent");
      if (saved) {
        setPendingSend(null);
      }
      return;
    }
    const item = pendingSend.item;
    const result = await adminRequest(api.put(`/api/admin/notifications/${item.id}/send`, {}), navigate, role, "发送通知");
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("通知", item.title, "已发送"));
    setPendingSend(null);
    await refreshNotifications();
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
      onRefresh: refreshNotifications,
      onFinally: () => setPendingRemove(null),
    });
  };

  const confirmBulkRemove = async () => {
    const items = bulkSelection.selectedItems;
    if (items.length === 0 || bulkDeleting) return;
    const confirmed = await openAdminConfirm({
      title: "批量删除通知",
      message: `确认删除选中的 ${items.length} 条通知？`,
      confirmLabel: "删除选中",
      destructive: true,
    });
    if (!confirmed) return;
    setBulkDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/notifications/${item.id}`),
      entityName: "通知",
      errorLabel: "批量删除通知",
      onRefresh: refreshNotifications,
      onFinally: () => {
        bulkSelection.clear();
        setBulkDeleting(false);
      },
    });
  };

  return (
    <AdminPageShell
      title="站内通知"
      description="管理站内通知的创建、发布、触达与效果统计。"
      actions={
        <>
          <button type="button" onClick={openTemplate} className={secondaryButtonClassName()}>
            <ClipboardList size={16} />
            通知模板
          </button>
          <button type="button" onClick={openCreate} className={primaryButtonClassName()}>
            <Megaphone size={16} />
            新建通知
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NotificationStatCard icon={FileText} iconClassName="bg-blue-100 text-blue-600" label="总通知" value={stats?.total ?? "-"} hint={`公告 ${stats?.sent ?? 0}`} />
        <NotificationStatCard icon={Inbox} iconClassName="bg-emerald-100 text-emerald-600" label="草稿" value={stats?.draft ?? "-"} hint="待发布内容" />
        <NotificationStatCard icon={Bell} iconClassName="bg-amber-100 text-amber-600" label="弹窗通知" value={records.filter((item) => item.type === "popup").length} hint="当前页统计" />
        <NotificationStatCard icon={BarChart3} iconClassName="bg-violet-100 text-violet-600" label="平均点击率" value={`${deliveryStats.readRate}%`} hint="当前页触达" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#edf0f5] pb-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-[20px] font-semibold text-[#101828]">通知列表</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bulkSelection.selectedCount === 0 || bulkDeleting}
                onClick={() => void confirmBulkRemove()}
                className={`${secondaryButtonClassName()} !h-9 ${bulkSelection.selectedCount > 0 ? "!border-rose-200 !text-rose-600 hover:!border-rose-400" : ""}`}
              >
                <ChevronDown size={15} />
                批量操作
              </button>
              <button type="button" onClick={() => void refreshNotifications()} className={`${secondaryButtonClassName()} !h-9`}>
                <RefreshCw size={15} />
                刷新
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-6 border-b border-[#edf0f5]">
            {NOTIFICATION_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative pb-2 text-sm font-semibold transition ${
                  activeTab === tab.key ? "text-[#1677ff]" : "text-[#344054] hover:text-[#1677ff]"
                }`}
              >
                {tab.label}
                {activeTab === tab.key ? <span className="absolute inset-x-0 bottom-[-1px] h-0.5 rounded-full bg-[#1677ff]" /> : null}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 rounded-[8px] border border-[#e5e7eb] bg-[#fbfcfe] p-3 md:grid-cols-[140px_140px_minmax(180px,1fr)_auto_auto]">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={inputClassName()}>
              <option value="all">类型</option>
              {NOTIFICATION_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)} className={inputClassName()}>
              <option value="all">目标</option>
              {NOTIFICATION_TARGET_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label className="flex h-10 items-center gap-2 rounded-[4px] border border-[#d0d5dd] bg-white px-3 text-[#98a2b3]">
              <Search size={16} />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="关键词"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#344054] outline-none placeholder:text-[#98a2b3]"
              />
            </label>
            <button type="button" className={primaryButtonClassName()}>
              <Search size={15} />
              搜索
            </button>
            <button type="button" onClick={resetFilters} className={secondaryButtonClassName()}>
              重置
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-[8px] border border-[#edf0f5]">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f8fafc]">
                  <TableHead className="w-10">
                    <AdminBulkCheckbox
                      checked={bulkSelection.allVisibleSelected}
                      onChange={bulkSelection.toggleAllVisible}
                      label="选择全部通知"
                    />
                  </TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>发送目标</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <AdminBulkCheckbox
                        checked={bulkSelection.isSelected(item.id)}
                        onChange={() => bulkSelection.toggleOne(item.id)}
                        label={`选择通知 ${item.title}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="font-semibold text-[#101828]">{item.title}</div>
                    </TableCell>
                    <TableCell>{formatNotificationType(item.type)}</TableCell>
                    <TableCell>{formatNotificationTarget(item.targetType || "all")}{item.targetRoles ? ` / ${formatRoleList(item.targetRoles)}` : ""}{item.targetType === "user" ? ` / ${getNotificationTargetLabel(item.targetType, item.targetRoles, item.targetUserIds)}` : ""}</TableCell>
                    <TableCell><span className={statusBadgeClassName(item.status)}>{formatAdminStatus(item.status)}</span></TableCell>
                    <TableCell>{formatShortDate(item.createTime)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-[#1677ff]">
                        {item.status === "sent" ? (
                          <>
                            <button type="button" onClick={() => openEdit(item)} className="hover:text-[#0958d9]">详情</button>
                            <span className="text-[#d0d5dd]">/</span>
                            <button type="button" onClick={() => duplicateNotification(item)} className="hover:text-[#0958d9]">复制</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => openEdit(item)} className="hover:text-[#0958d9]">编辑</button>
                            <span className="text-[#d0d5dd]">/</span>
                            <button type="button" onClick={() => sendNow(item)} className="hover:text-[#0958d9]">发送</button>
                          </>
                        )}
                        {item.type === "popup" ? (
                          <>
                            <span className="text-[#d0d5dd]">/</span>
                            <button type="button" onClick={() => openEdit(item)} className="hover:text-[#0958d9]">关闭弹窗</button>
                          </>
                        ) : null}
                        <span className="text-[#d0d5dd]">/</span>
                        <button type="button" onClick={() => remove(item)} className="text-rose-600 hover:text-rose-700">删除</button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredRecords.length === 0 && <AdminEmptyState message="暂无符合条件的通知。" />}
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-[#667085] md:flex-row md:items-center md:justify-between">
            <span>共 {total} 条</span>
            <AdminPagination current={page} size={size} total={total} onChange={setPage} />
          </div>
        </section>

        <aside className="space-y-4">
          <NotificationPreviewCard notification={previewNotification} onOpen={openEdit} />
          <NotificationFlowCard />
        </aside>
      </div>

      <NotificationFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        form={form}
        meta={formMeta}
        stats={stats}
        onFormChange={setForm}
        onMetaChange={setFormMeta}
        onSave={() => void submit()}
        onPreview={() => showAdminSuccess("右侧为当前通知预览")}
        onSend={() => setPendingSend({ kind: "form" })}
      />
      <ConfirmSendNotificationDialog
        open={Boolean(pendingSend)}
        target={pendingSend}
        draftForm={form}
        draftMeta={formMeta}
        stats={stats}
        onCancel={() => setPendingSend(null)}
        onSaveDraft={() => {
          if (pendingSend?.kind === "form") {
            void saveNotification("draft").then((saved) => {
              if (saved) setPendingSend(null);
            });
            return;
          }
          setPendingSend(null);
        }}
        onConfirm={() => void confirmSend()}
      />
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

function NotificationFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  meta,
  stats,
  onFormChange,
  onMetaChange,
  onSave,
  onPreview,
  onSend,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  editing: AdminNotificationRecord | null;
  form: AdminNotificationForm;
  meta: Required<NotificationMeta>;
  stats: AdminNotificationStats | null | undefined;
  onFormChange: Dispatch<SetStateAction<AdminNotificationForm>>;
  onMetaChange: Dispatch<SetStateAction<Required<NotificationMeta>>>;
  onSave: () => void;
  onPreview: () => void;
  onSend: () => void;
}) {
  const navigate = useNavigate();
  const role = useAdminRole();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [targetUserKeyword, setTargetUserKeyword] = useState("");
  const selectedUserIds = useMemo(() => parseIdList(form.targetUserIds), [form.targetUserIds]);
  const usersQuery = useQuery({
    queryKey: adminKeys.users({ page: 1, size: 8, keyword: targetUserKeyword, status: 0 }),
    enabled: open && form.targetType === "user" && Boolean(role),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        size: "8",
        status: "0",
      });
      if (targetUserKeyword.trim()) {
        params.set("keyword", targetUserKeyword.trim());
      }
      const result = await adminRequest<PagedAdminResponse<AdminUserRecord>>(
        api.get(`/api/admin/users?${params.toString()}`, { silent: true }),
        navigate,
        role,
      );
      return result || { records: [], total: 0 };
    },
  });
  const targetUsers = usersQuery.data?.records || [];
  const reach = getNotificationReachEstimate(stats, form.targetType, form.targetUserIds);
  const actionText = meta.actionText || DEFAULT_NOTIFICATION_META.actionText;
  const sendLabel = meta.scheduled && meta.sendAt ? "定时发送" : "立即发送";

  const toggleTargetUser = (userId: number) => {
    onFormChange((prev) => {
      const ids = parseIdList(prev.targetUserIds);
      const nextIds = ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId];
      return { ...prev, targetUserIds: nextIds.join(",") };
    });
  };

  const applyEditorCommand = (command: NotificationEditorCommand) => {
    const textarea = textareaRef.current;
    const selection = textarea
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : { start: form.content.length, end: form.content.length };
    const result = applyNotificationEditorCommand(form.content, selection, command);
    onFormChange((prev) => ({ ...prev, content: result.content.slice(0, 200) }));
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const cursor = Math.min(result.cursor, textareaRef.current?.value.length || result.cursor);
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={notificationFormDialogContentClassName}>
        <DialogHeader className="shrink-0 border-b border-[#edf0f5] px-6 py-5">
          <DialogTitle className="text-[20px] font-semibold text-[#101828]">{editing ? "编辑通知" : "新建通知"}</DialogTitle>
        </DialogHeader>

        <div className={notificationFormDialogBodyClassName}>
          <div className="space-y-4 px-6 py-5">
            <NotificationFormField label="通知标题" required>
              <div className="relative">
                <input
                  value={form.title}
                  maxLength={30}
                  onChange={(event) => onFormChange((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="请输入通知标题，建议在 30 个字以内"
                  className={`${inputClassName()} pr-14`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#667085]">{form.title.length}/30</span>
              </div>
            </NotificationFormField>

            <NotificationFormField label="通知类型" required>
              <div className="flex flex-wrap gap-5">
                {NOTIFICATION_TYPE_OPTIONS.map((item) => (
                  <NotificationRadio
                    key={item.value}
                    checked={form.type === item.value}
                    onChange={() => onFormChange((prev) => ({ ...prev, type: item.value }))}
                    label={item.label}
                  />
                ))}
              </div>
            </NotificationFormField>

            <NotificationFormField label="发送目标" required>
              <div className="flex flex-wrap gap-5">
                {NOTIFICATION_TARGET_OPTIONS.map((item) => (
                  <NotificationRadio
                    key={item.value}
                    checked={form.targetType === item.value}
                    onChange={() => onFormChange((prev) => ({
                      ...prev,
                      targetType: item.value,
                      targetRoles: item.value === "role" ? prev.targetRoles : "",
                      targetUserIds: item.value === "user" ? prev.targetUserIds : "",
                    }))}
                    label={item.label}
                  />
                ))}
              </div>
            </NotificationFormField>

            {form.targetType === "role" ? (
              <NotificationFormField label="目标角色选择" required>
                <select
                  value={String(form.targetRoles || "").split(",").filter(Boolean)[0] || ""}
                  onChange={(event) => onFormChange((prev) => ({ ...prev, targetRoles: event.target.value }))}
                  className={inputClassName()}
                >
                  <option value="">请选择目标角色</option>
                  {ROLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </NotificationFormField>
            ) : null}

            {form.targetType === "user" ? (
              <NotificationFormField label="目标用户选择" required>
                <div className="space-y-3 rounded-[6px] border border-[#d0d5dd] bg-white p-3">
                  <input
                    value={targetUserKeyword}
                    onChange={(event) => setTargetUserKeyword(event.target.value)}
                    placeholder="搜索用户名、手机号、邮箱"
                    className={inputClassName()}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {targetUsers.map((user) => (
                      <label
                        key={user.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-[6px] border px-3 py-2 text-sm transition ${
                          selectedUserIds.includes(user.id) ? "border-[#1677ff] bg-blue-50" : "border-[#edf0f5] hover:border-[#b7d7ff]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleTargetUser(user.id)}
                          className="h-4 w-4 rounded border-[#d0d5dd] text-[#1677ff]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-[#101828]">{user.username || `用户 ${user.id}`}</span>
                          <span className="block truncate text-xs text-[#667085]">ID {user.id}{user.email ? ` / ${user.email}` : ""}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedUserIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedUserIds.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleTargetUser(id)}
                          className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#1677ff]"
                        >
                          用户 ID {id} ×
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#98a2b3]">请选择至少一个目标用户。</p>
                  )}
                </div>
              </NotificationFormField>
            ) : null}

            <NotificationFormField label="正文内容" required>
              <div className="overflow-hidden rounded-[4px] border border-[#d0d5dd] bg-white focus-within:border-[#1677ff] focus-within:ring-2 focus-within:ring-[#1677ff]/10">
                <div className="flex h-10 items-center gap-1 border-b border-[#edf0f5] px-3 text-[#667085]">
                  {NOTIFICATION_EDITOR_COMMANDS.map(({ command, icon: Icon, label }) => (
                    <button
                      key={command}
                      type="button"
                      aria-label={label}
                      title={label}
                      onClick={() => applyEditorCommand(command)}
                      className="flex h-8 w-8 items-center justify-center rounded-[4px] hover:bg-[#f2f4f7]"
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={form.content}
                    maxLength={200}
                    onChange={(event) => onFormChange((prev) => ({ ...prev, content: event.target.value }))}
                    placeholder="请输入通知正文，支持换行，建议在 200 字以内"
                    className="min-h-[132px] w-full resize-none bg-white px-3 py-3 text-sm text-[#1f2937] outline-none placeholder:text-[#98a2b3]"
                  />
                  <span className="absolute bottom-3 right-3 text-xs text-[#667085]">{form.content.length}/200</span>
                </div>
              </div>
            </NotificationFormField>

            <NotificationFormField label="按钮文案" required>
              <div className="relative">
                <input
                  value={meta.actionText}
                  maxLength={10}
                  onChange={(event) => onMetaChange((prev) => ({ ...prev, actionText: event.target.value }))}
                  placeholder="立即查看"
                  className={`${inputClassName()} pr-14`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#667085]">{meta.actionText.length}/10</span>
              </div>
            </NotificationFormField>

            <NotificationFormField label="跳转链接">
              <input
                value={meta.actionUrl}
                onChange={(event) => onMetaChange((prev) => ({ ...prev, actionUrl: event.target.value }))}
                placeholder="请输入链接地址（以 http:// 或 https:// 开头）"
                className={inputClassName()}
              />
            </NotificationFormField>

            <NotificationFormField label="定时发送">
              <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                <div className="flex h-10 items-center">
                  <Switch checked={meta.scheduled} onCheckedChange={(checked) => onMetaChange((prev) => ({ ...prev, scheduled: checked }))} />
                </div>
                <label className="relative">
                  <input
                    type="datetime-local"
                    value={meta.sendAt}
                    disabled={!meta.scheduled}
                    onChange={(event) => onMetaChange((prev) => ({ ...prev, sendAt: event.target.value }))}
                    className={`${inputClassName()} pr-10 disabled:bg-[#f5f7fb] disabled:text-[#98a2b3]`}
                  />
                  <CalendarDays size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#667085]" />
                </label>
              </div>
            </NotificationFormField>

            <NotificationFormField label="是否置顶">
              <div className="flex items-center gap-4">
                <Switch checked={meta.pinned} onCheckedChange={(checked) => onMetaChange((prev) => ({ ...prev, pinned: checked }))} />
                <span className="text-sm text-[#98a2b3]">置顶后，通知将在站内消息列表顶部展示 7 天</span>
              </div>
            </NotificationFormField>
          </div>

          <div className="border-t border-[#edf0f5] bg-[#f8fafc] p-5 lg:border-l lg:border-t-0">
            <div className="space-y-5">
              <NotificationDraftPreview title="站内通知预览卡片" form={form} actionText={actionText} compact={false} />
              <NotificationDraftPreview title="弹窗预览卡片" form={form} actionText={actionText} compact />
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#101828]">预计触达人群数量</h3>
                <div className="rounded-[8px] border border-[#d0d5dd] bg-white p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-blue-50 text-[#1677ff]">
                      <UsersRound size={28} />
                    </div>
                    <div>
                      <div className="text-[28px] font-semibold leading-none text-[#101828]">{formatCompactNumber(reach)} 人</div>
                      <div className="mt-2 text-sm text-[#667085]">预计将触达的目标用户总数</div>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#667085]">实际触达人数可能因用户状态、设备等因素存在差异。</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className={notificationFormDialogFooterClassName}>
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>取消</button>
          <button type="button" onClick={onSave} className={secondaryButtonClassName()}>{editing ? "保存通知" : "保存草稿"}</button>
          <button type="button" onClick={onPreview} className={secondaryButtonClassName()}>预览</button>
          <button type="button" onClick={onSend} className={primaryButtonClassName()}>{sendLabel}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotificationFormField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-[88px_minmax(0,1fr)] md:items-start">
      <div className="pt-2 text-sm font-semibold text-[#344054]">
        {label} {required ? <span className="text-[#f04438]">*</span> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function NotificationRadio({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange?: () => void;
}) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm font-medium ${disabled ? "cursor-not-allowed text-[#98a2b3]" : "cursor-pointer text-[#344054]"}`}>
      <input type="radio" checked={checked} disabled={disabled} onChange={onChange} className="h-4 w-4 accent-[#1677ff]" />
      {label}
    </label>
  );
}

function NotificationDraftPreview({
  title,
  form,
  actionText,
  compact,
}: {
  title: string;
  form: AdminNotificationForm;
  actionText: string;
  compact?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[#101828]">{title}</h3>
      <div className={`rounded-[8px] border border-[#e5e7eb] bg-white ${compact ? "p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]" : "p-5"}`}>
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-[6px] bg-blue-50 px-3 py-1 text-sm font-semibold text-[#1677ff]">{formatNotificationType(form.type)}</span>
          {compact ? <X size={16} className="text-[#667085]" /> : null}
        </div>
        <div className="mt-4 flex gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-blue-50 text-[#1677ff]">
            <Bot size={38} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-lg font-semibold text-[#101828]">{form.title || "AI 助手升级通知"}</div>
            <div className="mt-1 line-clamp-2 text-sm leading-6 text-[#667085]">{form.content || "新的模型配置已上线，回答更稳定，推荐您前往体验。"}</div>
          </div>
        </div>
        <button type="button" className={`${primaryButtonClassName()} mt-4 w-full`}>
          {actionText || "立即查看"}
        </button>
      </div>
    </div>
  );
}

function ConfirmSendNotificationDialog({
  open,
  target,
  draftForm,
  draftMeta,
  stats,
  onCancel,
  onSaveDraft,
  onConfirm,
}: {
  open: boolean;
  target: SendConfirmTarget;
  draftForm: AdminNotificationForm;
  draftMeta: Required<NotificationMeta>;
  stats: AdminNotificationStats | null | undefined;
  onCancel: () => void;
  onSaveDraft: () => void;
  onConfirm: () => void;
}) {
  const record = target?.kind === "record" ? target.item : null;
  const form = record || draftForm;
  const meta = record ? parseNotificationMeta(record.attachments) : draftMeta;
  const reach = getNotificationReachEstimate(stats, form.targetType, form.targetUserIds);
  const sendTime = meta.scheduled && meta.sendAt ? meta.sendAt.replace("T", " ") : "立即发送";
  const confirmLabel = meta.scheduled && meta.sendAt && target?.kind === "form" ? "确认定时" : "确认发送";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className={notificationConfirmDialogContentClassName}>
        <DialogHeader className="border-b border-[#edf0f5] px-5 py-4">
          <DialogTitle className="text-[18px] font-semibold text-[#101828]">确认发送通知</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-5 py-4">
          <div className="rounded-[6px] border border-[#d0d5dd] bg-white p-4">
            <ConfirmSummaryRow label="通知标题：" value={form.title || "-"} />
            <ConfirmSummaryRow label="通知类型：" value={formatNotificationType(form.type)} />
            <ConfirmSummaryRow label="发送目标：" value={getNotificationTargetLabel(form.targetType, form.targetRoles, form.targetUserIds)} />
            <ConfirmSummaryRow label="预计触达：" value={`${formatCompactNumber(reach)} 人`} />
            <ConfirmSummaryRow label="是否弹窗：" value={form.type === "popup" ? "是" : "否"} />
            <ConfirmSummaryRow label="发送时间：" value={sendTime} />
          </div>
          <div className="flex items-center gap-3 rounded-[6px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm font-semibold text-[#f97316]">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{sendTime === "立即发送" ? "发送后用户将立即收到通知，无法撤回，只能下架或隐藏。" : "定时任务到达发送时间后将自动推送，发送前仍可编辑或删除。"}</span>
          </div>
        </div>
        <DialogFooter className="border-t border-[#edf0f5] bg-white px-5 py-4">
          <button type="button" onClick={onCancel} className={secondaryButtonClassName()}>取消</button>
          <button type="button" onClick={onSaveDraft} className={secondaryButtonClassName()}>保存草稿</button>
          <button type="button" onClick={onConfirm} className={primaryButtonClassName()}>{confirmLabel}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <div className="text-[#667085]">{label}</div>
      <div className="font-medium text-[#101828]">{value}</div>
    </div>
  );
}

function NotificationStatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  hint,
}: {
  icon: typeof FileText;
  iconClassName: string;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-5">
        <div className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
          <Icon size={32} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[#344054]">{label}</div>
          <div className="mt-2 text-[32px] font-semibold leading-none text-[#101828]">{value}</div>
          <div className="mt-2 text-sm text-[#667085]">{hint}</div>
        </div>
      </div>
    </div>
  );
}

function NotificationPreviewCard({
  notification,
  onOpen,
}: {
  notification: AdminNotificationRecord | null;
  onOpen: (item: AdminNotificationRecord) => void;
}) {
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <h2 className="text-[20px] font-semibold text-[#101828]">发送预览</h2>
      <div className="mt-4 rounded-[16px] border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        {notification ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-[6px] bg-blue-50 px-3 py-1 text-sm font-semibold text-[#1677ff]">{formatNotificationType(notification.type)}</span>
              <div className="flex items-center gap-3 text-sm text-[#667085]">
                <span>{formatShortDate(notification.createTime)}</span>
                <X size={16} />
              </div>
            </div>
            <div className="mt-6 flex gap-4">
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[16px] bg-blue-50">
                <Bot size={42} className="text-[#1677ff]" />
              </div>
              <div className="min-w-0">
                <h3 className="line-clamp-1 text-[20px] font-semibold text-[#101828]">{notification.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#667085]">{notification.content || "暂无通知正文。"}</p>
              </div>
            </div>
            <button type="button" onClick={() => onOpen(notification)} className={`${primaryButtonClassName()} mt-5 w-full`}>
              立即查看
            </button>
            <div className="mt-5 flex justify-center gap-3">
              {[0, 1, 2, 3].map((item) => (
                <span key={item} className={`h-2 w-2 rounded-full ${item === 0 ? "bg-[#1677ff]" : "bg-[#d0d5dd]"}`} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-[12px] border border-dashed border-[#d0d5dd] py-12 text-center text-sm text-[#667085]">暂无可预览通知</div>
        )}
      </div>
    </section>
  );
}

function NotificationFlowCard() {
  const steps = [
    { label: "编辑内容", icon: Edit3, status: "done" },
    { label: "定向人群", icon: UsersRound, status: "done" },
    { label: "发送预览", icon: Eye, status: "active" },
    { label: "发布统计", icon: BarChart3, status: "todo" },
  ] as const;

  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <h2 className="text-[20px] font-semibold text-[#101828]">发送流程</h2>
      <div className="mt-5 grid grid-cols-4 items-start gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.status === "active";
          const isDone = step.status === "done";
          return (
            <div key={step.label} className="relative text-center">
              {index < steps.length - 1 ? <span className="absolute left-[calc(50%+28px)] top-7 hidden h-px w-[calc(100%-48px)] border-t border-dashed border-[#1677ff]/60 sm:block" /> : null}
              <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                isActive ? "bg-[#1677ff] text-white shadow-[0_0_0_4px_rgba(22,119,255,0.12)]" : isDone ? "bg-blue-50 text-[#1677ff]" : "bg-[#f2f4f7] text-[#98a2b3]"
              }`}>
                <Icon size={24} />
              </div>
              <div className={`mx-auto mt-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                isDone || isActive ? "bg-[#1677ff] text-white" : "bg-[#e5e7eb] text-[#667085]"
              }`}>
                {isDone ? <CheckCircle2 size={13} /> : index + 1}
              </div>
              <div className="mt-2 text-sm font-semibold text-[#344054]">{step.label}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-sm leading-6 text-[#667085]">支持通知从创建、预览、定向发送到效果统计的完整闭环管理。</p>
    </section>
  );
}

function summarizeDelivery(records: AdminNotificationRecord[]) {
  const totals = records.reduce(
    (acc, item) => {
      const delivery = item as AdminNotificationRecord & NotificationDeliveryFields;
      acc.total += Number(delivery.totalCount || 0);
      acc.read += Number(delivery.readCount || 0);
      return acc;
    },
    { total: 0, read: 0 },
  );
  return {
    readRate: totals.total > 0 ? Math.round((totals.read / totals.total) * 100) : 0,
  };
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatMaybeDate(value);
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value)));
}

function parseIdList(value?: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0)
    .filter((item, index, values) => values.indexOf(item) === index);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
