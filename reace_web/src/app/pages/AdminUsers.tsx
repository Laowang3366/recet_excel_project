import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Edit3, Lock, MessageSquare, Trash2, UserCog } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { getAdminAvatarSrc } from "../admin/display";
import { AddButton, AdminEmptyState, AdminPageShell, AdminPagination, AdminSection, FilterBar, FilterField, formatMaybeDate, formatAdminRole, primaryButtonClassName, secondaryButtonClassName, statusBadgeClassName, inputClassName } from "../admin/shared";
import { PagedAdminResponse, AdminEditableUserRole, AdminUserForm, AdminUserRecord, AdminUserToggleResponse, adminRequest, showAdminSuccess, runAdminDelete, openAdminPrompt, formatAdminEntityMessage, useAdminRole, DeleteConfirmDialog, FormDialog, Field, isEditableUserRole, defaultUserForm } from "./AdminConsoleShared";

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
