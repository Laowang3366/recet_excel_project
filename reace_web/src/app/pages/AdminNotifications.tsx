import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  Inbox,
  Megaphone,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useAdminBulkSelection } from "../admin/bulk-selection";
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
  textareaClassName,
} from "../admin/shared";
import {
  AdminNotificationForm,
  AdminNotificationRecord,
  AdminNotificationStats,
  adminRequest,
  DeleteConfirmDialog,
  defaultNotificationForm,
  Field,
  FormDialog,
  formatAdminEntityMessage,
  openAdminConfirm,
  PagedAdminResponse,
  runAdminBulkDelete,
  runAdminDelete,
  showAdminSuccess,
  useAdminRole,
} from "./AdminConsoleShared";

type NotificationTab = "all" | "draft" | "sent" | "popup";

type NotificationDeliveryFields = {
  totalCount?: number | null;
  readCount?: number | null;
  sendTime?: string | null;
};

const NOTIFICATION_TABS: Array<{ key: NotificationTab; label: string }> = [
  { key: "all", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "sent", label: "已发布" },
  { key: "popup", label: "弹窗通知" },
];

export function AdminNotifications() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminNotificationRecord | null>(null);
  const [pendingRemove, setPendingRemove] = useState<AdminNotificationRecord | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [form, setForm] = useState<AdminNotificationForm>(defaultNotificationForm());
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

  const duplicateNotification = (item: AdminNotificationRecord) => {
    setEditing(null);
    setForm({
      title: `${item.title || "通知"} 副本`,
      content: item.content || "",
      type: item.type || "system",
      status: "draft",
      targetType: item.targetType || "all",
      targetRoles: item.targetRoles || "",
      attachments: item.attachments || "",
    });
    setOpen(true);
  };

  const resetFilters = () => {
    setTypeFilter("all");
    setTargetFilter("all");
    setKeyword("");
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
    await refreshNotifications();
  };

  const sendNow = async (item: AdminNotificationRecord) => {
    const result = await adminRequest(api.put(`/api/admin/notifications/${item.id}/send`, {}), navigate, role, "发送通知");
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("通知", item.title, "已发送"));
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
                    <TableCell>{formatNotificationTarget(item.targetType || "all")}{item.targetRoles ? ` / ${formatRoleList(item.targetRoles)}` : ""}</TableCell>
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
