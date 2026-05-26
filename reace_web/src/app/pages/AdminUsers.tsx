import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  Activity,
  BadgeCheck,
  Bot,
  ChevronDown,
  Coins,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileUp,
  KeyRound,
  LineChart,
  Lock,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCog,
  UserPlus,
  UsersRound,
  VolumeX,
  X,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import {
  buildRegistrationTrend,
  buildUserComposition,
  buildUserSummary,
  buildUsersCsv,
  maskAdminPhone,
  resolveAdminUserLevelLabel,
  type AdminUserTrendPoint,
} from "../admin/admin-users-view-model";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { getAdminAvatarSrc } from "../admin/display";
import {
  AdminBulkCheckbox,
  AdminEmptyState,
  AdminPageShell,
  AdminPagination,
  formatAdminRole,
  formatMaybeDate,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  statusBadgeClassName,
  textareaClassName,
} from "../admin/shared";
import {
  PagedAdminResponse,
  AdminStatsPayload,
  AdminEditableUserRole,
  AdminUserForm,
  AdminUserRecord,
  AdminUserToggleResponse,
  PointsGrantResponse,
  adminRequest,
  showAdminError,
  showAdminSuccess,
  runAdminDelete,
  runAdminBulkDelete,
  openAdminConfirm,
  formatAdminEntityMessage,
  useAdminRole,
  DeleteConfirmDialog,
  isEditableUserRole,
  defaultUserForm,
  LevelsOverviewResponse,
  LevelRuleRecord,
} from "./AdminConsoleShared";

type UserModalForm = AdminUserForm & {
  confirmPassword: string;
  phone: string;
  note: string;
  forceChangePassword: boolean;
};

type PasswordForm = {
  password: string;
  confirmPassword: string;
  forceChangePassword: boolean;
  notifyUser: boolean;
};

type GrantForm = {
  points: string;
  reason: string;
};

const USER_ROLE_OPTIONS: Array<{ value: AdminEditableUserRole; label: string; description: string }> = [
  { value: "user", label: "普通用户", description: "可使用基础功能，参加考试与学习。" },
  { value: "moderator", label: "运营", description: "可管理内容、用户及数据。" },
  { value: "admin", label: "管理员", description: "拥有系统配置与管理权限。" },
];

const USER_STATUS_OPTIONS = [
  { value: 0, label: "正常" },
  { value: 1, label: "锁定" },
];

function createUserModalForm(source?: AdminUserRecord | null): UserModalForm {
  const base = defaultUserForm();
  return {
    ...base,
    username: source?.username || "",
    email: source?.email || "",
    avatar: source?.avatar || "",
    role: isEditableUserRole(source?.role) ? source.role : "user",
    status: Number(source?.status ?? 0),
    isMuted: Boolean(source?.isMuted),
    confirmPassword: "",
    phone: source?.phone || "",
    note: "",
    forceChangePassword: true,
  };
}

function createPasswordForm(): PasswordForm {
  return { password: "", confirmPassword: "", forceChangePassword: true, notifyUser: true };
}

function getStatusText(item: AdminUserRecord) {
  if (Number(item.status ?? 0) === 1) return "已锁定";
  if (item.isMuted) return "已禁言";
  return "正常";
}

function getUserSource(item: AdminUserRecord) {
  return item.source || item.sourceChannel || "平台";
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"" && line[index + 1] === "\"") {
      value += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminUsers() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [phoneKeyword, setPhoneKeyword] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRecord | null>(null);
  const [detailUser, setDetailUser] = useState<AdminUserRecord | null>(null);
  const [detailTab, setDetailTab] = useState("basic");
  const [passwordUser, setPasswordUser] = useState<AdminUserRecord | null>(null);
  const [grantUser, setGrantUser] = useState<AdminUserRecord | null>(null);
  const [pendingRemove, setPendingRemove] = useState<AdminUserRecord | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState<UserModalForm>(createUserModalForm());
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(createPasswordForm());
  const [grantForm, setGrantForm] = useState<GrantForm>({ points: "", reason: "" });
  const size = 10;
  const effectiveKeyword = keyword.trim() || phoneKeyword.trim();
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (effectiveKeyword) query.set("keyword", effectiveKeyword);
  if (roleFilter) query.set("role", roleFilter);
  if (statusFilter) query.set("status", statusFilter);
  const queryString = query.toString();

  const usersQuery = useQuery({
    queryKey: adminKeys.users({ page, size, keyword: effectiveKeyword, role: roleFilter, status: statusFilter }),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PagedAdminResponse<AdminUserRecord>>(api.get(`/api/admin/users?${queryString}`, { silent: true }), navigate, role);
      return result || { records: [], total: 0 };
    },
  });

  const statsQuery = useQuery({
    queryKey: adminKeys.stats(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<{ stats: AdminStatsPayload }>(api.get("/api/admin/stats", { silent: true }), navigate, role);
      return result?.stats || {};
    },
  });

  const levelsOverviewQuery = useQuery({
    queryKey: adminKeys.levelsOverview(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<LevelsOverviewResponse>(api.get("/api/admin/levels/overview", { silent: true }), navigate, role);
      return result || null;
    },
  });

  const records = usersQuery.data?.records || [];
  const total = usersQuery.data?.total || 0;
  const levelRules = levelsOverviewQuery.data?.levelRules || [];
  const visibleRecords = useMemo(() => {
    return records.filter((item) => {
      const phoneText = [item.phone, item.email, item.username].filter(Boolean).join(" ").toLowerCase();
      if (phoneKeyword.trim() && !phoneText.includes(phoneKeyword.trim().toLowerCase())) return false;
      if (levelFilter === "1" && Number(item.level || 1) !== 1) return false;
      if (levelFilter === "2" && Number(item.level || 1) !== 2) return false;
      if (levelFilter === "3" && Number(item.level || 1) !== 3) return false;
      if (levelFilter === "4plus" && Number(item.level || 1) < 4) return false;
      const dateKey = item.createTime ? String(item.createTime).slice(0, 10) : "";
      if (startDate && (!dateKey || dateKey < startDate)) return false;
      if (endDate && (!dateKey || dateKey > endDate)) return false;
      return true;
    });
  }, [endDate, levelFilter, phoneKeyword, records, startDate]);
  const bulkSelection = useAdminBulkSelection(visibleRecords, (item) => item.id);
  const summary = useMemo(() => buildUserSummary(records, total), [records, total]);
  const statsUsers = statsQuery.data?.users || {};
  const overviewStats = statsQuery.data?.overview || {};
  const totalUsers = Number(statsUsers.total ?? summary.totalUsers);
  const todayNewUsers = Number(overviewStats.todayNewUsers ?? summary.todayNew);
  const onlineUsers = Number(statsUsers.online ?? summary.activeUsers);
  const lockedUsers = Number(statsUsers.locked ?? summary.frozenUsers);
  const mutedUsers = Number(statsUsers.muted ?? 0);
  const adminUsers = Number(statsUsers.admins ?? 0);
  const composition = useMemo(() => buildUserComposition(records, levelRules), [levelRules, records]);
  const trend = useMemo(() => buildRegistrationTrend(records), [records]);
  const donutBackground = composition.length
    ? `conic-gradient(${composition.map((item, index) => {
      const start = composition.slice(0, index).reduce((sum, segment) => sum + segment.percent, 0);
      return `${item.color} ${start}% ${start + item.percent}%`;
    }).join(", ")})`
    : "#e2e8f0";

  useEffect(() => {
    if (openActionMenuId === null) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-admin-users-action-menu]")) return;
      setOpenActionMenuId(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openActionMenuId]);

  const refreshUsers = () =>
    queryClient.invalidateQueries({ queryKey: adminKeys.users({ page, size, keyword: effectiveKeyword, role: roleFilter, status: statusFilter }) }).then(() => undefined);

  const openCreate = () => {
    setEditing(null);
    setForm(createUserModalForm());
    setShowPassword(false);
    setShowConfirmPassword(false);
    setOpen(true);
  };

  const openEdit = (item: AdminUserRecord) => {
    setEditing(item);
    setForm(createUserModalForm(item));
    setShowPassword(false);
    setShowConfirmPassword(false);
    setOpen(true);
  };

  const openPassword = (item: AdminUserRecord) => {
    setPasswordUser(item);
    setPasswordForm(createPasswordForm());
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const openGrant = (item: AdminUserRecord) => {
    setGrantUser(item);
    setGrantForm({ points: "", reason: "" });
  };

  const submit = async (continueCreate = false) => {
    if (!editing && form.password !== form.confirmPassword) {
      showAdminError("两次输入的密码不一致");
      return;
    }
    const payload: Partial<AdminUserForm> = {
      email: form.email,
      avatar: form.avatar || "",
      role: form.role,
      status: Number(form.status),
      isMuted: Boolean(form.isMuted),
    };
    if (editing) {
      const result = await adminRequest<AdminUserRecord>(api.put(`/api/admin/users/${editing.id}`, payload), navigate, role, "更新用户");
      if (!result) return;
      if (!continueCreate) setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("用户", editing.username || result?.username || form.username, "已更新"));
    } else {
      payload.username = form.username;
      payload.password = form.password;
      const result = await adminRequest<AdminUserRecord>(api.post("/api/admin/users", payload), navigate, role, "创建用户");
      if (!result) return;
      showAdminSuccess(formatAdminEntityMessage("用户", result?.username || form.username, "已创建"));
      if (continueCreate) {
        setForm(createUserModalForm());
      } else {
        setOpen(false);
      }
    }
    await refreshUsers();
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("scene", "admin_user_avatar");
    setUploadingAvatar(true);
    try {
      const result = await adminRequest<{ url: string }>(api.post("/api/upload", formData), navigate, role, "上传头像");
      if (!result?.url) return;
      setForm((prev) => ({ ...prev, avatar: result.url }));
      showAdminSuccess("头像已上传");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submitPassword = async () => {
    if (!passwordUser) return;
    if (!passwordForm.password) {
      showAdminError("请输入新密码");
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      showAdminError("两次输入的新密码不一致");
      return;
    }
    const result = await adminRequest(api.put(`/api/admin/users/${passwordUser.id}/password`, { password: passwordForm.password }), navigate, role, "重置用户密码");
    if (!result) return;
    setPasswordUser(null);
    showAdminSuccess(formatAdminEntityMessage("用户", passwordUser.username, "密码已重置"));
    await refreshUsers();
  };

  const submitGrant = async () => {
    if (!grantUser) return;
    const points = Number(grantForm.points || 0);
    if (!Number.isFinite(points) || points <= 0) {
      showAdminError("发放积分必须大于 0");
      return;
    }
    if (!grantForm.reason.trim()) {
      showAdminError("请填写发放原因");
      return;
    }
    const result = await adminRequest(
      api.post<PointsGrantResponse>("/api/admin/points/grant", {
        username: grantUser.username,
        points,
        reason: grantForm.reason.trim(),
      }),
      navigate,
      role,
      "发放积分",
    );
    if (!result) return;
    setGrantUser(null);
    showAdminSuccess(`已向用户 ${grantUser.username} 发放 ${points} 积分`);
    await refreshUsers();
  };

  const remove = (item: AdminUserRecord) => {
    setOpenActionMenuId(null);
    setPendingRemove(item);
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    const item = pendingRemove;
    await runAdminDelete({
      request: api.delete(`/api/admin/users/${item.id}`),
      successMessage: formatAdminEntityMessage("用户", item.username, "已停用"),
      staleMessage: `用户《${item.username}》不存在，列表已刷新`,
      errorLabel: "停用用户",
      onRefresh: refreshUsers,
      onFinally: () => setPendingRemove(null),
    });
  };

  const confirmBulkRemove = async () => {
    const items = bulkSelection.selectedItems;
    if (items.length === 0 || bulkDeleting) return;
    const confirmed = await openAdminConfirm({
      title: "批量停用用户",
      message: `确认停用选中的 ${items.length} 个用户？系统会按安全停用策略处理。`,
      confirmLabel: "停用选中",
      destructive: true,
    });
    if (!confirmed) return;
    setBulkDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/users/${item.id}`),
      entityName: "用户",
      errorLabel: "批量停用用户",
      onRefresh: refreshUsers,
      onFinally: () => {
        bulkSelection.clear();
        setBulkDeleting(false);
      },
    });
  };

  const toggleLock = async (item: AdminUserRecord) => {
    setOpenActionMenuId(null);
    const result = await adminRequest<AdminUserToggleResponse>(api.put(`/api/admin/users/${item.id}/lock`, {}), navigate, role, item.status === 1 ? "解除用户锁定" : "锁定用户");
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("用户", item.username, result.locked ? "已锁定" : "已解锁"));
    await refreshUsers();
  };

  const toggleMute = async (item: AdminUserRecord) => {
    setOpenActionMenuId(null);
    const result = await adminRequest<AdminUserToggleResponse>(api.put(`/api/admin/users/${item.id}/mute`, {}), navigate, role, item.isMuted ? "解除用户禁言" : "禁言用户");
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("用户", item.username, result.muted ? "已禁言" : "已解除禁言"));
    await refreshUsers();
  };

  const exportUsers = () => {
    downloadTextFile(`excelcc-users-${new Date().toISOString().slice(0, 10)}.csv`, buildUsersCsv(visibleRecords));
  };

  const importUsers = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      showAdminError("导入文件没有用户数据");
      return;
    }
    const header = splitCsvLine(lines[0]).map((item) => item.toLowerCase());
    const indexOf = (name: string) => header.indexOf(name);
    const usernameIndex = indexOf("username");
    const emailIndex = indexOf("email");
    const passwordIndex = indexOf("password");
    if (usernameIndex < 0 || emailIndex < 0 || passwordIndex < 0) {
      showAdminError("CSV 表头必须包含 username,email,password");
      return;
    }
    setImporting(true);
    let successCount = 0;
    try {
      for (const line of lines.slice(1)) {
        const cells = splitCsvLine(line);
        const username = cells[usernameIndex] || "";
        const email = cells[emailIndex] || "";
        const password = cells[passwordIndex] || "";
        if (!username || !email || !password) continue;
        const roleValue = cells[indexOf("role")] || "user";
        const statusValue = cells[indexOf("status")] || 0;
        const result = await adminRequest(
          api.post("/api/admin/users", {
            username,
            email,
            password,
            role: isEditableUserRole(roleValue) ? roleValue : "user",
            status: Number(statusValue) === 1 ? 1 : 0,
          }),
          navigate,
          role,
          "批量导入用户",
        );
        if (result) successCount += 1;
      }
      showAdminSuccess(`已导入 ${successCount} 个用户`);
      await refreshUsers();
    } finally {
      setImporting(false);
    }
  };

  const resetFilters = () => {
    setKeyword("");
    setPhoneKeyword("");
    setLevelFilter("");
    setRoleFilter("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <AdminPageShell
      title="用户管理"
      description="统一管理平台用户信息、积分等级与账号状态"
      actions={(
        <>
          <button type="button" onClick={openCreate} className={primaryButtonClassName()}>
            <UserPlus size={16} />
            新建用户
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()} disabled={importing} className={secondaryButtonClassName()}>
            <FileUp size={16} />
            {importing ? "导入中" : "批量导入"}
          </button>
          <button type="button" onClick={exportUsers} className={secondaryButtonClassName()}>
            <Download size={16} />
            导出数据
          </button>
          <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void importUsers(event)} />
        </>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={UsersRound} iconClassName="bg-gradient-to-br from-[#60a5fa] to-[#1677ff]" label="总用户数" value={totalUsers.toLocaleString()} hint={`管理员 ${adminUsers.toLocaleString()}`} />
        <MetricCard icon={UserPlus} iconClassName="bg-gradient-to-br from-[#86efac] to-[#16a34a]" label="今日新增" value={todayNewUsers.toLocaleString()} hint="按全站注册时间统计" />
        <MetricCard icon={LineChart} iconClassName="bg-gradient-to-br from-[#a78bfa] to-[#7c3aed]" label="活跃用户" value={onlineUsers.toLocaleString()} hint="当前在线用户" />
        <MetricCard icon={ShieldCheck} iconClassName="bg-gradient-to-br from-[#fdba74] to-[#f97316]" label="冻结账号" value={lockedUsers.toLocaleString()} hint={`禁言 ${mutedUsers.toLocaleString()}`} />
      </div>

      <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_1.6fr_auto]">
          <FilterInput label="用户昵称" value={keyword} onChange={(next) => { setKeyword(next); setPage(1); }} placeholder="请输入用户昵称" />
          <FilterInput label="手机号" value={phoneKeyword} onChange={(next) => { setPhoneKeyword(next); setPage(1); }} placeholder="请输入手机号" />
          <FilterSelect label="用户等级" value={levelFilter} onChange={(next) => { setLevelFilter(next); setPage(1); }}>
            <option value="">全部等级</option>
            <option value="1">普通会员</option>
            <option value="2">白银会员</option>
            <option value="3">黄金会员</option>
            <option value="4plus">钻石会员</option>
          </FilterSelect>
          <FilterSelect label="账号状态" value={statusFilter} onChange={(next) => { setStatusFilter(next); setPage(1); }}>
            <option value="">全部状态</option>
            <option value="0">正常</option>
            <option value="1">已锁定</option>
          </FilterSelect>
          <div>
            <div className="mb-2 text-sm font-semibold text-[#344054]">注册时间</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClassName()} />
              <span className="text-[#98a2b3]">-</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={inputClassName()} />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => void refreshUsers()} className={primaryButtonClassName()}>
              <Search size={16} />
              查询
            </button>
            <button type="button" onClick={resetFilters} className={secondaryButtonClassName()}>
              重置
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#edf0f5] px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-[#475467]">共 <span className="font-semibold text-[#101828]">{total.toLocaleString()}</span> 条</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void confirmBulkRemove()} disabled={bulkSelection.selectedCount === 0 || bulkDeleting} className={secondaryButtonClassName()}>
                <Trash2 size={15} />
                删除选中 ({bulkSelection.selectedCount})
              </button>
              <button type="button" onClick={() => void refreshUsers()} className={secondaryButtonClassName()}>
                <RefreshCw size={15} />
                刷新
              </button>
              <button type="button" className={secondaryButtonClassName()}>
                <MoreHorizontal size={15} />
                自定义列
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <AdminBulkCheckbox
                      checked={bulkSelection.allVisibleSelected}
                      onChange={bulkSelection.toggleAllVisible}
                      label="选择当前页用户"
                    />
                  </TableHead>
                  <TableHead>用户ID</TableHead>
                  <TableHead>用户昵称</TableHead>
                  <TableHead>手机号</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>积分</TableHead>
                  <TableHead>最近登录</TableHead>
                  <TableHead>账号状态</TableHead>
                  <TableHead>来源渠道</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <AdminBulkCheckbox
                        checked={bulkSelection.isSelected(item.id)}
                        onChange={() => bulkSelection.toggleOne(item.id)}
                        label={`选择用户 ${item.username}`}
                      />
                    </TableCell>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>
                      <div className="flex min-w-[160px] items-center gap-3">
                        <img src={getAdminAvatarSrc(item)} alt={item.username} className="h-10 w-10 rounded-full object-cover" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[#101828]">{item.username}</div>
                          <div className="truncate text-xs text-[#98a2b3]">{item.email || "-"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{maskAdminPhone(item.phone)}</TableCell>
                    <TableCell>{formatMaybeDate(item.createTime)}</TableCell>
                    <TableCell><LevelBadge label={resolveAdminUserLevelLabel(item, levelRules)} level={item.level} /></TableCell>
                    <TableCell>{Number(item.points || 0).toLocaleString()}</TableCell>
                    <TableCell>{formatMaybeDate(item.lastLoginTime || item.lastActiveTime || item.updateTime)}</TableCell>
                    <TableCell><span className={statusBadgeClassName(Number(item.status ?? 0) === 1 ? "locked" : "active")}>{getStatusText(item)}</span></TableCell>
                    <TableCell>{getUserSource(item)}</TableCell>
                    <TableCell>
                      <div data-admin-users-action-menu className="relative flex items-center gap-3 text-sm font-semibold">
                        <button type="button" onClick={() => { setDetailUser(item); setDetailTab("basic"); }} className="text-[#1677ff] hover:text-[#0958d9]">查看</button>
                        <button type="button" onClick={() => openEdit(item)} className="text-[#1677ff] hover:text-[#0958d9]">编辑</button>
                        <button type="button" onClick={() => setOpenActionMenuId((current) => current === item.id ? null : item.id)} className="inline-flex items-center gap-1 text-[#1677ff] hover:text-[#0958d9]">
                          更多 <ChevronDown size={13} />
                        </button>
                        {openActionMenuId === item.id ? (
                          <div className="absolute right-0 top-7 z-20 w-36 rounded-[6px] border border-[#e5e7eb] bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
                            <ActionMenuButton onClick={() => openPassword(item)} icon={KeyRound}>重置密码</ActionMenuButton>
                            <ActionMenuButton onClick={() => void toggleLock(item)} icon={Lock}>{Number(item.status ?? 0) === 1 ? "解除锁定" : "锁定账号"}</ActionMenuButton>
                            <ActionMenuButton onClick={() => void toggleMute(item)} icon={VolumeX}>{item.isMuted ? "解除禁言" : "禁言"}</ActionMenuButton>
                            <ActionMenuButton onClick={() => remove(item)} icon={Trash2} danger>停用账号</ActionMenuButton>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visibleRecords.length === 0 && <AdminEmptyState message={usersQuery.isFetching ? "正在加载用户数据..." : "暂无用户数据。"} />}
          </div>
          <div className="border-t border-[#edf0f5] px-4 py-3">
            <AdminPagination current={page} size={size} total={total} onChange={setPage} />
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-[18px] font-semibold text-[#101828]">用户构成</h2>
            <div className="mt-5 grid grid-cols-[112px_1fr] items-center gap-4">
              <div className="relative h-28 w-28 rounded-full" style={{ background: donutBackground }}>
                <div className="absolute inset-7 rounded-full bg-white" />
              </div>
              <div className="space-y-3">
                {composition.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-[#475467]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                    <span className="font-semibold text-[#101828]">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-[18px] font-semibold text-[#101828]">近7日注册趋势</h2>
            <TrendChart points={trend} />
            <p className="mt-4 text-sm text-[#667085]">近7日新增用户总数：<span className="font-semibold text-[#1677ff]">{trend.reduce((sum, item) => sum + item.count, 0).toLocaleString()}</span></p>
          </section>
        </aside>
      </div>

      <UserFormDialog
        open={open}
        editing={editing}
        form={form}
        showPassword={showPassword}
        showConfirmPassword={showConfirmPassword}
        uploadingAvatar={uploadingAvatar}
        onOpenChange={setOpen}
        onFormChange={setForm}
        onUploadAvatar={(event) => void uploadAvatar(event)}
        onTogglePassword={() => setShowPassword((next) => !next)}
        onToggleConfirmPassword={() => setShowConfirmPassword((next) => !next)}
        onSubmit={() => void submit(false)}
        onSubmitAndContinue={() => void submit(true)}
      />
      <UserDetailDrawer
        user={detailUser}
        tab={detailTab}
        levelRules={levelRules}
        onTabChange={setDetailTab}
        onClose={() => setDetailUser(null)}
        onResetPassword={openPassword}
        onToggleLock={(item) => void toggleLock(item)}
        onToggleMute={(item) => void toggleMute(item)}
        onGrantPoints={openGrant}
      />
      <ResetPasswordDialog
        user={passwordUser}
        form={passwordForm}
        showPassword={showPassword}
        showConfirmPassword={showConfirmPassword}
        onClose={() => setPasswordUser(null)}
        onFormChange={setPasswordForm}
        onTogglePassword={() => setShowPassword((next) => !next)}
        onToggleConfirmPassword={() => setShowConfirmPassword((next) => !next)}
        onSubmit={() => void submitPassword()}
      />
      <GrantPointsDialog
        user={grantUser}
        form={grantForm}
        onClose={() => setGrantUser(null)}
        onFormChange={setGrantForm}
        onSubmit={() => void submitGrant()}
      />
      <DeleteConfirmDialog
        open={Boolean(pendingRemove)}
        title="停用用户"
        message={pendingRemove ? `确认停用用户 ${pendingRemove.username}？系统会锁定账号并下线登录态。` : ""}
        confirmLabel="确认停用"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => void confirmRemove()}
      />
    </AdminPageShell>
  );
}

function MetricCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  hint,
  trend,
  warning,
}: {
  icon: typeof UsersRound;
  iconClassName: string;
  label: string;
  value: string;
  hint: string;
  trend?: string;
  warning?: string;
}) {
  return (
    <section className="flex min-h-[128px] items-center gap-5 rounded-[8px] border border-[#e5e7eb] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white shadow-[0_10px_20px_rgba(22,119,255,0.18)] ${iconClassName}`}>
        <Icon size={30} />
      </div>
      <div>
        <div className="text-sm font-medium text-[#475467]">{label}</div>
        <div className="mt-1 text-[30px] font-semibold leading-none text-[#101828]">{value}</div>
        <div className="mt-3 text-sm text-[#667085]">
          {hint}
          {trend ? <span className="ml-3 font-semibold text-[#12b76a]">{trend}</span> : null}
          {warning ? <span className="ml-3 font-semibold text-[#f04438]">{warning}</span> : null}
        </div>
      </div>
    </section>
  );
}

function FilterInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label>
      <div className="mb-2 text-sm font-semibold text-[#344054]">{label}</div>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName()} placeholder={placeholder} />
    </label>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label>
      <div className="mb-2 text-sm font-semibold text-[#344054]">{label}</div>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName()}>
        {children}
      </select>
    </label>
  );
}

function LevelBadge({ label, level }: { label: string; level?: number | null }) {
  const normalizedLevel = Number(level || 1);
  const tone = normalizedLevel >= 5
    ? "bg-[#f4f3ff] text-[#7a5af8]"
    : normalizedLevel >= 4
      ? "bg-[#dbeafe] text-[#175cd3]"
      : normalizedLevel >= 3
        ? "bg-[#fff4d6] text-[#b54708]"
        : normalizedLevel >= 2
          ? "bg-[#eef2f7] text-[#475467]"
          : "bg-[#dcfae6] text-[#067647]";
  return <span className={`inline-flex rounded-[6px] px-2 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function ActionMenuButton({ icon: Icon, children, onClick, danger }: { icon: typeof Edit3; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-[4px] px-3 py-2 text-left text-sm transition hover:bg-[#f5f7fb] ${danger ? "text-[#f04438]" : "text-[#344054]"}`}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

function TrendChart({ points }: { points: AdminUserTrendPoint[] }) {
  const max = Math.max(1, ...points.map((item) => item.count));
  const width = 260;
  const height = 120;
  const coordinates = points.map((item, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - 18 - (item.count / max) * 78;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[140px] w-full overflow-visible">
        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1="0" x2={width} y1={20 + line * 24} y2={20 + line * 24} stroke="#eef2f7" />
        ))}
        <polyline points={coordinates} fill="none" stroke="#1677ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((item, index) => {
          const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
          const y = height - 18 - (item.count / max) * 78;
          return <circle key={item.date} cx={x} cy={y} r="4" fill="#fff" stroke="#1677ff" strokeWidth="3" />;
        })}
      </svg>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#667085]">
        {points.map((item) => <span key={item.date}>{item.label}</span>)}
      </div>
    </div>
  );
}

function UserFormDialog({
  open,
  editing,
  form,
  showPassword,
  showConfirmPassword,
  uploadingAvatar,
  onOpenChange,
  onFormChange,
  onUploadAvatar,
  onTogglePassword,
  onToggleConfirmPassword,
  onSubmit,
  onSubmitAndContinue,
}: {
  open: boolean;
  editing: AdminUserRecord | null;
  form: UserModalForm;
  showPassword: boolean;
  showConfirmPassword: boolean;
  uploadingAvatar: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (next: UserModalForm | ((previous: UserModalForm) => UserModalForm)) => void;
  onUploadAvatar: (event: ChangeEvent<HTMLInputElement>) => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
  onSubmit: () => void;
  onSubmitAndContinue: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[920px] max-w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[8px] border border-[#d0d5dd] bg-white p-0 sm:max-w-[920px]">
        <DialogHeader className="border-b border-[#edf0f5] px-6 py-4">
          <DialogTitle>{editing ? "编辑用户" : "新增用户"}</DialogTitle>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5 p-5">
            <section>
              <h3 className="mb-4 text-sm font-semibold text-[#101828]">基础信息</h3>
              <div className="grid gap-5 lg:grid-cols-[1fr_132px]">
                <div className="space-y-4">
                  <UserFormField required label="用户名">
                    <input
                      value={form.username}
                      disabled={Boolean(editing)}
                      onChange={(event) => onFormChange((prev) => ({ ...prev, username: event.target.value }))}
                      className={`${inputClassName()} disabled:bg-[#f8fafc] disabled:text-[#98a2b3]`}
                      placeholder="请输入用户名"
                      autoComplete="off"
                    />
                  </UserFormField>
                  <UserFormField required label="邮箱">
                    <input value={form.email} onChange={(event) => onFormChange((prev) => ({ ...prev, email: event.target.value }))} className={inputClassName()} placeholder="请输入邮箱地址" autoComplete="off" />
                  </UserFormField>
                  <UserFormField label="手机号（可选）">
                    <input value={form.phone} onChange={(event) => onFormChange((prev) => ({ ...prev, phone: event.target.value }))} className={inputClassName()} placeholder="请输入手机号" autoComplete="off" />
                  </UserFormField>
                </div>
                <label className="flex h-[132px] cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed border-[#d0d5dd] bg-[#f8fafc] text-center text-sm text-[#667085] transition hover:border-[#1677ff] hover:text-[#1677ff]">
                  {form.avatar ? <img src={form.avatar} alt="用户头像" className="h-full w-full rounded-[8px] object-cover" /> : <UploadCloud size={24} />}
                  <span className="mt-2 font-semibold">{uploadingAvatar ? "上传中..." : form.avatar ? "更换头像" : "上传头像"}</span>
                  <span className="mt-1 text-xs text-[#98a2b3]">支持 JPG、PNG，建议 1:1</span>
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={onUploadAvatar} disabled={uploadingAvatar} />
                </label>
              </div>
            </section>

            {!editing ? (
              <section className="border-t border-[#edf0f5] pt-5">
                <h3 className="mb-4 text-sm font-semibold text-[#101828]">安全设置</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <UserFormField required label="初始密码">
                    <PasswordInput value={form.password} visible={showPassword} onToggle={onTogglePassword} onChange={(value) => onFormChange((prev) => ({ ...prev, password: value }))} placeholder="请输入初始密码" />
                  </UserFormField>
                  <UserFormField required label="确认密码">
                    <PasswordInput value={form.confirmPassword} visible={showConfirmPassword} onToggle={onToggleConfirmPassword} onChange={(value) => onFormChange((prev) => ({ ...prev, confirmPassword: value }))} placeholder="请再次输入初始密码" />
                  </UserFormField>
                </div>
                <SwitchLine
                  label="首次登录修改密码"
                  checked={form.forceChangePassword}
                  onCheckedChange={(next) => onFormChange((prev) => ({ ...prev, forceChangePassword: next }))}
                  description="开启后，用户首次登录时需修改密码"
                />
              </section>
            ) : null}

            <section className="border-t border-[#edf0f5] pt-5">
              <h3 className="mb-4 text-sm font-semibold text-[#101828]">权限与状态</h3>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm font-semibold text-[#344054]"><span className="text-[#f04438]">*</span> 角色</div>
                  <div className="flex flex-wrap gap-5">
                    {USER_ROLE_OPTIONS.map((item) => (
                      <label key={item.value} className="inline-flex items-center gap-2 text-sm text-[#344054]">
                        <input type="radio" checked={form.role === item.value} onChange={() => onFormChange((prev) => ({ ...prev, role: item.value }))} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-[#344054]"><span className="text-[#f04438]">*</span> 账号状态</div>
                  <div className="flex flex-wrap gap-5">
                    {USER_STATUS_OPTIONS.map((item) => (
                      <label key={item.value} className="inline-flex items-center gap-2 text-sm text-[#344054]">
                        <input type="radio" checked={Number(form.status) === item.value} onChange={() => onFormChange((prev) => ({ ...prev, status: item.value }))} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
                <SwitchLine
                  label="是否禁言"
                  checked={Boolean(form.isMuted)}
                  onCheckedChange={(next) => onFormChange((prev) => ({ ...prev, isMuted: next }))}
                  description="开启后，用户将无法发言"
                />
                <UserFormField label="备注">
                  <textarea value={form.note} onChange={(event) => onFormChange((prev) => ({ ...prev, note: event.target.value }))} className={`${textareaClassName()} min-h-[76px]`} maxLength={200} placeholder="请输入备注信息（可选）" />
                  <div className="mt-1 text-right text-xs text-[#98a2b3]">{form.note.length}/200</div>
                </UserFormField>
              </div>
            </section>
          </div>
          <div className="space-y-4 border-t border-[#edf0f5] bg-[#fbfcff] p-5 lg:border-l lg:border-t-0">
            <InfoCard icon={UserCog} title="权限说明">
              {USER_ROLE_OPTIONS.map((item) => <p key={item.value}>• <span className="font-semibold">{item.label}</span>：{item.description}</p>)}
            </InfoCard>
            <InfoCard icon={Lock} title="密码规则">
              <p>• 密码长度为 8-20 位</p>
              <p>• 必须包含字母和数字</p>
              <p>• 区分大小写</p>
              <p>• 不能包含空格及特殊字符</p>
            </InfoCard>
            <InfoCard icon={BadgeCheck} title="创建后会发送站内通知">
              <p>用户创建成功后，系统将自动发送站内通知，告知账号信息与登录指引。</p>
            </InfoCard>
          </div>
        </div>
        <DialogFooter className="border-t border-[#edf0f5] bg-white px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>取消</button>
          {!editing ? <button type="button" onClick={onSubmitAndContinue} className={secondaryButtonClassName()}>保存并继续新增</button> : null}
          <button type="button" onClick={onSubmit} className={primaryButtonClassName()}>{editing ? "保存用户" : "创建用户"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDetailDrawer({
  user,
  tab,
  levelRules,
  onTabChange,
  onClose,
  onResetPassword,
  onToggleLock,
  onToggleMute,
  onGrantPoints,
}: {
  user: AdminUserRecord | null;
  tab: string;
  levelRules: LevelRuleRecord[];
  onTabChange: (tab: string) => void;
  onClose: () => void;
  onResetPassword: (user: AdminUserRecord) => void;
  onToggleLock: (user: AdminUserRecord) => void;
  onToggleMute: (user: AdminUserRecord) => void;
  onGrantPoints: (user: AdminUserRecord) => void;
}) {
  if (!user) return null;
  const tabs = [
    { key: "basic", label: "基本资料" },
    { key: "practice", label: "练习记录" },
    { key: "points", label: "积分流水" },
    { key: "qa", label: "答疑记录" },
    { key: "ai", label: "AI 调用记录" },
  ];
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45" onMouseDown={onClose}>
      <aside className="ml-auto flex h-full w-[min(560px,100vw)] flex-col bg-white shadow-[-20px_0_40px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#edf0f5] px-6 py-5">
          <h2 className="text-[20px] font-semibold text-[#101828]">用户详情</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#667085] hover:bg-[#f2f4f7]"><X size={20} /></button>
        </div>
        <div className="border-b border-[#edf0f5] px-6 py-6">
          <div className="flex items-center gap-4">
            <img src={getAdminAvatarSrc(user)} alt={user.username} className="h-20 w-20 rounded-full object-cover" />
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="truncate text-[22px] font-semibold text-[#101828]">{user.username}</h3>
                <span className={statusBadgeClassName(Number(user.status ?? 0) === 1 ? "locked" : "active")}>{getStatusText(user)}</span>
              </div>
              <p className="mt-1 text-sm text-[#667085]">{user.email || "-"}</p>
              <p className="mt-2 text-sm text-[#475467]">角色：{formatAdminRole(user.role)} <span className="mx-3 text-[#d0d5dd]">|</span> 账号状态：<span className="font-semibold text-[#12b76a]">{getStatusText(user)}</span></p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <DrawerActionButton icon={KeyRound} onClick={() => onResetPassword(user)}>重置密码</DrawerActionButton>
            <DrawerActionButton icon={Lock} onClick={() => onToggleLock(user)}>{Number(user.status ?? 0) === 1 ? "解除锁定" : "锁定账号"}</DrawerActionButton>
            <DrawerActionButton icon={VolumeX} onClick={() => onToggleMute(user)}>{user.isMuted ? "解除禁言" : "禁言"}</DrawerActionButton>
            <DrawerActionButton icon={Coins} onClick={() => onGrantPoints(user)}>发放积分</DrawerActionButton>
          </div>
        </div>
        <div className="flex border-b border-[#edf0f5] px-6">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`border-b-2 px-3 py-4 text-sm font-semibold transition ${tab === item.key ? "border-[#1677ff] text-[#1677ff]" : "border-transparent text-[#475467] hover:text-[#1677ff]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "basic" ? (
            <>
              <h4 className="mb-3 text-sm font-semibold text-[#101828]">基本资料</h4>
              <div className="grid grid-cols-2 rounded-[8px] border border-[#e5e7eb] text-sm">
                <DetailCell label="最近登录" value={formatMaybeDate(user.lastLoginTime || user.lastActiveTime || user.updateTime)} />
                <DetailCell label="注册时间" value={formatMaybeDate(user.createTime)} />
                <DetailCell label="练习次数" value={`${Number(user.exp || 0)} 次`} />
                <DetailCell label="当前积分" value={Number(user.points || 0).toLocaleString()} />
                <DetailCell label="当前等级" value={resolveAdminUserLevelLabel(user, levelRules)} />
                <DetailCell label="来源渠道" value={getUserSource(user)} />
              </div>
              <h4 className="mb-3 mt-6 text-sm font-semibold text-[#101828]">近期动态</h4>
              <div className="space-y-3 rounded-[8px] border border-[#e5e7eb] p-4">
                <ActivityLine icon={Activity} color="#22c55e" title="最近练习" desc="完成了 Excel 函数进阶练习" time={formatMaybeDate(user.updateTime)} />
                <ActivityLine icon={MessageCircle} color="#f97316" title="最近答疑" desc="参与了求助答疑" time={formatMaybeDate(user.lastActiveTime)} />
                <ActivityLine icon={Bot} color="#8b5cf6" title="最近 AI 调用" desc="使用 AI 助手生成公式优化建议" time={formatMaybeDate(user.lastActiveTime)} />
              </div>
            </>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#d0d5dd] p-10 text-center text-sm text-[#667085]">暂无记录</div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ResetPasswordDialog({
  user,
  form,
  showPassword,
  showConfirmPassword,
  onClose,
  onFormChange,
  onTogglePassword,
  onToggleConfirmPassword,
  onSubmit,
}: {
  user: AdminUserRecord | null;
  form: PasswordForm;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onClose: () => void;
  onFormChange: (next: PasswordForm | ((previous: PasswordForm) => PasswordForm)) => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-[min(520px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[8px] border border-[#d0d5dd] p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#edf0f5] px-6 py-5">
          <DialogTitle>重置用户密码</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <div className="text-sm text-[#344054]">用户：<span className="ml-4 font-semibold text-[#101828]">{user?.username || "-"}</span></div>
          <UserFormField label="新密码">
            <PasswordInput value={form.password} visible={showPassword} onToggle={onTogglePassword} onChange={(value) => onFormChange((prev) => ({ ...prev, password: value }))} placeholder="请输入新密码" />
          </UserFormField>
          <UserFormField label="确认新密码">
            <PasswordInput value={form.confirmPassword} visible={showConfirmPassword} onToggle={onToggleConfirmPassword} onChange={(value) => onFormChange((prev) => ({ ...prev, confirmPassword: value }))} placeholder="请再次输入新密码" />
          </UserFormField>
          <SwitchLine label="要求用户下次登录修改密码" checked={form.forceChangePassword} onCheckedChange={(next) => onFormChange((prev) => ({ ...prev, forceChangePassword: next }))} />
          <SwitchLine label="通过站内通知告知用户" checked={form.notifyUser} onCheckedChange={(next) => onFormChange((prev) => ({ ...prev, notifyUser: next }))} />
          <div className="rounded-[6px] border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-sm font-medium text-[#b54708]">请勿通过明文渠道发送密码。</div>
        </div>
        <DialogFooter className="border-t border-[#edf0f5] bg-white px-6 py-4">
          <button type="button" onClick={onClose} className={secondaryButtonClassName()}>取消</button>
          <button type="button" onClick={onSubmit} className={primaryButtonClassName()}>确认重置</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GrantPointsDialog({ user, form, onClose, onFormChange, onSubmit }: { user: AdminUserRecord | null; form: GrantForm; onClose: () => void; onFormChange: (next: GrantForm | ((previous: GrantForm) => GrantForm)) => void; onSubmit: () => void }) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-[min(520px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[8px] border border-[#d0d5dd] p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#edf0f5] px-6 py-5">
          <DialogTitle>发放积分</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <div className="text-sm text-[#344054]">用户：<span className="ml-4 font-semibold text-[#101828]">{user?.username || "-"}</span></div>
          <UserFormField label="积分值">
            <input type="number" min="1" value={form.points} onChange={(event) => onFormChange((prev) => ({ ...prev, points: event.target.value }))} className={inputClassName()} placeholder="请输入发放积分" />
          </UserFormField>
          <UserFormField label="发放原因">
            <textarea value={form.reason} onChange={(event) => onFormChange((prev) => ({ ...prev, reason: event.target.value }))} className={`${textareaClassName()} min-h-[88px]`} placeholder="请输入发放原因" />
          </UserFormField>
        </div>
        <DialogFooter className="border-t border-[#edf0f5] bg-white px-6 py-4">
          <button type="button" onClick={onClose} className={secondaryButtonClassName()}>取消</button>
          <button type="button" onClick={onSubmit} className={primaryButtonClassName()}>确认发放</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserFormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[#344054]">{required ? <span className="text-[#f04438]">*</span> : null} {label}</div>
      {children}
    </label>
  );
}

function PasswordInput({ value, visible, onToggle, onChange, placeholder }: { value: string; visible: boolean; onToggle: () => void; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClassName()} pr-10`} placeholder={placeholder} autoComplete="new-password" />
      <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#667085] hover:bg-[#f2f4f7]">
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function SwitchLine({ label, checked, onCheckedChange, description }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; description?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[#344054]">
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-[#1677ff]" />
      <span>{label}</span>
      {description ? <span className="text-[#98a2b3]">{description}</span> : null}
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof UserCog; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#101828]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eff6ff] text-[#1677ff]"><Icon size={16} /></span>
        {title}
      </div>
      <div className="space-y-2 text-sm leading-6 text-[#475467]">{children}</div>
    </section>
  );
}

function DrawerActionButton({ icon: Icon, children, onClick }: { icon: typeof KeyRound; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[#d0d5dd] bg-white px-3 text-sm font-semibold text-[#344054] shadow-sm transition hover:border-[#1677ff] hover:text-[#1677ff]">
      <Icon size={15} />
      {children}
    </button>
  );
}

function DetailCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-r border-[#edf0f5] p-4 last:border-r-0">
      <div className="text-xs text-[#667085]">{label}</div>
      <div className="mt-2 font-semibold text-[#344054]">{value || "-"}</div>
    </div>
  );
}

function ActivityLine({ icon: Icon, color, title, desc, time }: { icon: typeof Activity; color: string; title: string; desc: string; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}><Icon size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold text-[#101828]">{title}</div>
          <div className="text-xs text-[#667085]">{time}</div>
        </div>
        <div className="mt-1 text-sm text-[#667085]">{desc}</div>
      </div>
    </div>
  );
}
