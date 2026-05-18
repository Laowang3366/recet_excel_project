import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Edit3, Send, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { AddButton, AdminEmptyState, AdminPageShell, AdminPagination, AdminSection, AdminStatCard, AdminStatGrid, formatMaybeDate, formatAdminStatus, formatRoleList, formatNotificationTarget, formatNotificationType, NOTIFICATION_TARGET_OPTIONS, NOTIFICATION_TYPE_OPTIONS, ROLE_OPTIONS, primaryButtonClassName, secondaryButtonClassName, statusBadgeClassName, inputClassName, textareaClassName } from "../admin/shared";
import { PagedAdminResponse, AdminNotificationForm, AdminNotificationRecord, AdminNotificationStats, adminRequest, showAdminSuccess, runAdminDelete, formatAdminEntityMessage, useAdminRole, DeleteConfirmDialog, FormDialog, Field, defaultNotificationForm } from "./AdminConsoleShared";

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
