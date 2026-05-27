import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  BellRing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Edit3,
  Gift,
  Layers3,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import {
  AdminBulkCheckbox,
  AdminEmptyState,
  AdminPageShell,
  POINTS_RULE_TYPE_OPTIONS,
  POINTS_TASK_KEY_OPTIONS,
  formatMaybeDate,
  formatPointsRuleType,
  formatPointsTaskKey,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "../admin/shared";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import {
  AdminFormSwitch,
  AdminUserRecord,
  Field,
  FormDialog,
  PagedAdminResponse,
  PointsGrantResponse,
  PointsOptionForm,
  PointsOptionKind,
  PointsOptionRecord,
  PointsOptionsResponse,
  PointsRecord,
  PointsRuleForm,
  PointsRuleRecord,
  PointsStatsResponse,
  adminRequest,
  buildAdminOptionChoices,
  buildAdminOptionLabelMap,
  defaultPointsOptionForm,
  defaultPointsRuleForm,
  formatAdminEntityMessage,
  generateMachineIdentifier,
  openAdminConfirm,
  runAdminBulkDelete,
  runAdminDelete,
  showAdminSuccess,
  useAdminRole,
} from "./AdminConsoleShared";
import {
  buildPointsDashboard,
  formatSignedPoints,
  getPointsBadgeClassName,
  getPointsRuleStatus,
  getPointsValue,
} from "./AdminPointsViewModel";

type PointsTab = "rules" | "taskTypes" | "ruleTypes" | "records";

const pointsTabs: Array<{ key: PointsTab; label: string }> = [
  { key: "rules", label: "积分规则" },
  { key: "taskTypes", label: "任务类型" },
  { key: "ruleTypes", label: "规则类型" },
  { key: "records", label: "积分记录" },
];

export function AdminPoints() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PointsTab>("rules");
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsKeyword, setRecordsKeyword] = useState("");
  const [grantForm, setGrantForm] = useState({ username: "", points: "", reason: "" });
  const [grantBusinessNo, setGrantBusinessNo] = useState("");
  const [grantNotifyUser, setGrantNotifyUser] = useState(true);
  const [selectedGrantUser, setSelectedGrantUser] = useState<AdminUserRecord | null>(null);
  const [manualGrantOpen, setManualGrantOpen] = useState(false);
  const [showGrantUserSuggestions, setShowGrantUserSuggestions] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PointsRuleRecord | null>(null);
  const [form, setForm] = useState<PointsRuleForm>(defaultPointsRuleForm());
  const [optionOpen, setOptionOpen] = useState(false);
  const [optionEditing, setOptionEditing] = useState<PointsOptionRecord | null>(null);
  const [optionKind, setOptionKind] = useState<PointsOptionKind>("type");
  const [optionForm, setOptionForm] = useState<PointsOptionForm>(defaultPointsOptionForm("type"));
  const [rulesBulkDeleting, setRulesBulkDeleting] = useState(false);
  const [typeOptionsBulkDeleting, setTypeOptionsBulkDeleting] = useState(false);
  const [taskOptionsBulkDeleting, setTaskOptionsBulkDeleting] = useState(false);
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
        role,
      );
      return result || { records: [], total: 0 };
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
  const dashboard = useMemo(() => buildPointsDashboard({ rules, stats, records }), [records, rules, stats]);
  const rulesBulkSelection = useAdminBulkSelection(rules, (item) => item.id);
  const typeOptionsBulkSelection = useAdminBulkSelection(pointsOptions.types || [], (item) => item.id);
  const taskOptionsBulkSelection = useAdminBulkSelection(pointsOptions.taskKeys || [], (item) => item.id);
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

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsRules() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsStats() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsRecords({ page: recordsPage, size, keyword: recordsKeyword.trim() }) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsOptions() }),
    ]);
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
      dailyLimit: item.dailyLimit ?? "",
      effectiveAt: toDatetimeLocalValue(item.effectiveAt),
      expiresAt: toDatetimeLocalValue(item.expiresAt),
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
    const payload = buildPointsRulePayload(form);
    const request = editing ? api.put<PointsRuleRecord>(`/api/admin/points/rules/${editing.id}`, payload) : api.post<PointsRuleRecord>("/api/admin/points/rules", payload);
    const result = await adminRequest(request, navigate, role, editing ? "更新积分规则" : "创建积分规则");
    if (!result) return;
    setOpen(false);
    showAdminSuccess(formatAdminEntityMessage("积分规则", editing?.name || result?.name || form.name, editing ? "已更新" : "已创建"));
    await refreshAll();
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
        ...buildPointsRulePayload(item),
        enabled: nextEnabled,
      }),
      navigate,
      role,
      nextEnabled ? "启用积分规则" : "停用积分规则",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("积分规则", item.name, nextEnabled ? "已启用" : "已停用"));
    await refreshAll();
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
      onRefresh: refreshAll,
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

  const removeSelectedRules = async () => {
    const items = rulesBulkSelection.selectedItems;
    if (items.length === 0 || rulesBulkDeleting) return;
    const confirmed = await openAdminConfirm({
      title: "批量删除积分规则",
      message: `确认删除选中的 ${items.length} 条积分规则？`,
      confirmLabel: "删除选中",
      destructive: true,
    });
    if (!confirmed) return;
    setRulesBulkDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/points/rules/${item.id}`),
      entityName: "积分规则",
      errorLabel: "批量删除积分规则",
      onRefresh: refreshAll,
      onFinally: () => {
        rulesBulkSelection.clear();
        setRulesBulkDeleting(false);
      },
    });
  };

  const removeSelectedOptions = async (
    kind: PointsOptionKind,
    selection: typeof typeOptionsBulkSelection,
    setDeleting: (next: boolean) => void,
  ) => {
    const items = selection.selectedItems;
    const label = kind === "type" ? "规则类型" : "任务类型";
    if (items.length === 0) return;
    const confirmed = await openAdminConfirm({
      title: `批量删除${label}`,
      message: `确认删除选中的 ${items.length} 个${label}？`,
      confirmLabel: "删除选中",
      destructive: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/points/options/${item.id}`),
      entityName: label,
      errorLabel: `批量删除${label}`,
      onRefresh: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsOptions() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsRules() }),
        ]);
      },
      onFinally: () => {
        selection.clear();
        setDeleting(false);
      },
    });
  };

  const grantPoints = async () => {
    const payload = {
      username: grantForm.username.trim(),
      points: Number(grantForm.points || 0),
      reason: grantForm.reason.trim(),
      businessNo: grantBusinessNo.trim() || undefined,
      notifyUser: grantNotifyUser,
    };
    const result = await adminRequest(
      api.post<PointsGrantResponse>("/api/admin/points/grant", payload),
      navigate,
      role,
      "手动变动积分",
    );
    if (!result) return;
    setGrantForm({ username: "", points: "", reason: "" });
    setGrantBusinessNo("");
    setGrantNotifyUser(true);
    setSelectedGrantUser(null);
    setManualGrantOpen(false);
    showAdminSuccess(`已为用户 ${result.username || payload.username} 记录 ${formatSignedPoints(result.points ?? payload.points)} 积分变动`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsStats() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.pointsRecords({ page: recordsPage, size, keyword: recordsKeyword.trim() }) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.users({ page: 1, size: 10, keyword: payload.username, role: "", status: "" }) }),
    ]);
  };

  const chooseGrantUser = (item: AdminUserRecord) => {
    setSelectedGrantUser(item);
    setGrantForm((prev) => ({ ...prev, username: item.username || "" }));
    setShowGrantUserSuggestions(false);
  };

  const renderUserPicker = () => (
    <div className="relative" ref={grantUsernameRef}>
      <div className="flex h-10 items-center gap-2 rounded-[6px] border border-[#d0d5dd] bg-white px-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus-within:border-[#1677ff] focus-within:ring-2 focus-within:ring-[#1677ff]/10">
        <Search size={16} className="text-[#667085]" />
        <input
          value={grantForm.username}
          onFocus={() => {
            if (grantForm.username.trim()) setShowGrantUserSuggestions(true);
          }}
          onChange={(event) => {
            const username = event.target.value;
            setGrantForm((prev) => ({ ...prev, username }));
            setSelectedGrantUser(null);
            setShowGrantUserSuggestions(Boolean(username.trim()));
          }}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#98a2b3]"
          placeholder="搜索用户名、手机号或邮箱"
        />
        <ChevronDown size={16} className="text-[#98a2b3]" />
      </div>
      {showGrantUserSuggestions && grantUserOptions.length > 0 && (
        <div className="absolute z-40 mt-2 max-h-60 w-full overflow-y-auto rounded-[8px] border border-[#e5e7eb] bg-white p-1 shadow-[0_16px_44px_rgba(15,23,42,0.18)]">
          {grantUserOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseGrantUser(item)}
              className="flex w-full items-center justify-between gap-3 rounded-[6px] px-3 py-2 text-left text-sm transition hover:bg-[#f5f8ff]"
            >
              <span className="font-semibold text-[#1f2937]">{item.username}</span>
              <span className="truncate text-xs text-[#667085]">{item.email || item.phone || `Lv.${item.level ?? "-"}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(recordsTotal / Math.max(size, 1)));

  return (
    <AdminPageShell
      title="积分体系"
      description="统一管理积分规则、手动发放与积分流水，降低误发积分风险。"
      actions={(
        <>
          <button type="button" onClick={() => setManualGrantOpen(true)} className={secondaryButtonClassName()}>
            <UserPlus size={16} />
            手动发放
          </button>
          <button type="button" onClick={openCreate} className={primaryButtonClassName()}>
            <PlusCircle size={16} />
            新增规则
          </button>
        </>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PointsMetricCard
          icon={Layers3}
          tone="blue"
          label="积分规则"
          value={dashboard.ruleCount}
          hint={`启用 ${dashboard.enabledRuleCount}`}
        />
        <PointsMetricCard
          icon={Gift}
          tone="green"
          label="今日发放"
          value={dashboard.todayIssued.toLocaleString()}
          hint={dashboard.todayIssued > 0 ? "实时统计" : "暂无新增"}
        />
        <PointsMetricCard
          icon={Send}
          tone="orange"
          label="今日消耗"
          value={dashboard.visibleConsumption.toLocaleString()}
          hint="实时统计"
        />
        <PointsMetricCard
          icon={ShieldAlert}
          tone="red"
          label="异常流水"
          value={dashboard.abnormalRecords}
          hint={dashboard.abnormalRecords > 0 ? "需复核" : "无重复发放"}
        />
      </div>

      <div className="rounded-[8px] border border-[#e5e7eb] bg-white px-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap gap-4">
          {pointsTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative h-12 px-3 text-[15px] font-semibold transition ${
                activeTab === tab.key ? "text-[#1677ff]" : "text-[#344054] hover:text-[#1677ff]"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t bg-[#1677ff]" />}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "rules" && (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px]">
            <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[20px] font-semibold text-[#1f1f1f]">积分规则表</h2>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void removeSelectedRules()} className={secondaryButtonClassName()} disabled={rulesBulkSelection.selectedCount === 0 || rulesBulkDeleting}>
                    批量操作
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" onClick={() => void refreshAll()} className={secondaryButtonClassName()}>
                    <RefreshCw size={14} />
                    刷新
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-[8px] border border-[#edf0f5]">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead className="bg-[#f6f8fb] text-[#344054]">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left">
                        <AdminBulkCheckbox
                          checked={rulesBulkSelection.allVisibleSelected}
                          onChange={rulesBulkSelection.toggleAllVisible}
                          label="选择全部积分规则"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">规则名称</th>
                      <th className="px-4 py-3 text-left font-semibold">任务标识</th>
                      <th className="px-4 py-3 text-left font-semibold">分值</th>
                      <th className="px-4 py-3 text-left font-semibold">类型</th>
                      <th className="px-4 py-3 text-left font-semibold">状态</th>
                      <th className="px-4 py-3 text-left font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((item) => {
                      const status = getPointsRuleStatus(item);
                      return (
                        <tr key={item.id} className="border-t border-[#edf0f5] text-[#344054]">
                          <td className="px-4 py-3">
                            <AdminBulkCheckbox
                              checked={rulesBulkSelection.isSelected(item.id)}
                              onChange={() => rulesBulkSelection.toggleOne(item.id)}
                              label={`选择积分规则 ${item.name}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-[#344054]">{item.name}</td>
                          <td className="px-4 py-3 font-mono text-[13px] text-[#475467]">{item.taskKey || "-"}</td>
                          <td className={`px-4 py-3 font-semibold ${Number(item.points) >= 0 ? "text-[#00a854]" : "text-[#f5222d]"}`}>{formatSignedPoints(Number(item.points || 0))}</td>
                          <td className="px-4 py-3">{resolveRuleTypeLabel(item.type)}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => void toggleRuleEnabled(item, !item.enabled)}
                              className={`rounded-[4px] px-2.5 py-1 text-xs font-semibold ring-1 ${getPointsBadgeClassName(status.tone)}`}
                            >
                              {status.label}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => openEdit(item)} className="text-sm font-semibold text-[#1677ff] hover:text-[#0958d9]">编辑</button>
                              <button type="button" onClick={() => void remove(item)} className="text-sm font-semibold text-[#cf1322] hover:text-[#a8071a]">删除</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rules.length === 0 && <AdminEmptyState message="暂无积分规则。" />}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#475467]">
                <div>共 {rules.length} 条</div>
                <div className="flex items-center gap-2">
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#d0d5dd] text-[#667085]"><ChevronLeft size={16} /></button>
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-[6px] bg-[#1677ff] px-2 font-semibold text-white">1</span>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#d0d5dd] text-[#667085]"><ChevronRight size={16} /></button>
                  <span className="ml-3 rounded-[6px] border border-[#d0d5dd] px-3 py-1.5">10 条/页</span>
                </div>
              </div>
            </section>

            <ManualGrantPanel
              renderUserPicker={renderUserPicker}
              grantForm={grantForm}
              setGrantForm={setGrantForm}
              onSubmit={() => void grantPoints()}
            />
          </div>

          <PointRecordsPanel
            title="积分流水"
            records={records}
            recordsKeyword={recordsKeyword}
            setRecordsKeyword={setRecordsKeyword}
            setRecordsPage={setRecordsPage}
            onRefresh={() => void queryClient.invalidateQueries({ queryKey: adminKeys.pointsRecords({ page: recordsPage, size, keyword: recordsKeyword.trim() }) })}
            recordsTotal={recordsTotal}
            currentPage={recordsPage}
            totalPages={totalPages}
            onPageChange={setRecordsPage}
            onViewMore={() => setActiveTab("records")}
          />
        </>
      )}

      {activeTab === "taskTypes" && (
        <PointsOptionSection
          title="任务类型管理"
          description="任务类型用于积分规则的任务标识配置。"
          items={pointsOptions.taskKeys || []}
          selectedCount={taskOptionsBulkSelection.selectedCount}
          allSelected={taskOptionsBulkSelection.allVisibleSelected}
          isSelected={(id) => taskOptionsBulkSelection.isSelected(id)}
          onToggleAll={taskOptionsBulkSelection.toggleAllVisible}
          onToggleOne={(id) => taskOptionsBulkSelection.toggleOne(id)}
          onCreate={() => openOptionCreate("task_key")}
          onEdit={(item) => openOptionEdit("task_key", item)}
          onRemove={(item) => void removeOption("task_key", item)}
          onRemoveSelected={() => void removeSelectedOptions("task_key", taskOptionsBulkSelection, setTaskOptionsBulkDeleting)}
          deleting={taskOptionsBulkDeleting}
          resolveLabel={resolveTaskKeyLabel}
        />
      )}

      {activeTab === "ruleTypes" && (
        <PointsOptionSection
          title="规则类型管理"
          description="规则类型决定任务去重和展示语义。"
          items={pointsOptions.types || []}
          selectedCount={typeOptionsBulkSelection.selectedCount}
          allSelected={typeOptionsBulkSelection.allVisibleSelected}
          isSelected={(id) => typeOptionsBulkSelection.isSelected(id)}
          onToggleAll={typeOptionsBulkSelection.toggleAllVisible}
          onToggleOne={(id) => typeOptionsBulkSelection.toggleOne(id)}
          onCreate={() => openOptionCreate("type")}
          onEdit={(item) => openOptionEdit("type", item)}
          onRemove={(item) => void removeOption("type", item)}
          onRemoveSelected={() => void removeSelectedOptions("type", typeOptionsBulkSelection, setTypeOptionsBulkDeleting)}
          deleting={typeOptionsBulkDeleting}
          resolveLabel={resolveRuleTypeLabel}
        />
      )}

      {activeTab === "records" && (
        <PointRecordsPanel
          title="积分记录"
          records={records}
          recordsKeyword={recordsKeyword}
          setRecordsKeyword={setRecordsKeyword}
          setRecordsPage={setRecordsPage}
          onRefresh={() => void queryClient.invalidateQueries({ queryKey: adminKeys.pointsRecords({ page: recordsPage, size, keyword: recordsKeyword.trim() }) })}
          recordsTotal={recordsTotal}
          currentPage={recordsPage}
          totalPages={totalPages}
          onPageChange={setRecordsPage}
          expanded
        />
      )}

      <FormDialog
        open={manualGrantOpen}
        onOpenChange={setManualGrantOpen}
        title="手动发放积分"
        description="选择用户、填写积分变动和发放原因后写入积分流水。"
        submitLabel="确认发放"
        contentClassName="w-[min(760px,calc(100vw-2rem))]"
        bodyClassName="p-0"
        onSubmit={grantPoints}
      >
        <div className="grid gap-0 md:grid-cols-[1fr_280px]">
          <div className="space-y-4 p-6">
            <RequiredField label="选择用户">{renderUserPicker()}</RequiredField>
            <div className="grid gap-3 rounded-[8px] border border-[#e5e7eb] bg-[#fbfcfe] p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-[#667085]">当前积分</div>
                <div className="mt-1 text-[20px] font-semibold text-[#101828]">{selectedGrantUser?.points?.toLocaleString() || "-"}</div>
              </div>
              <div className="border-[#e5e7eb] sm:border-l sm:pl-5">
                <div className="text-xs text-[#667085]">当前等级</div>
                <div className="mt-1 text-[20px] font-semibold text-[#101828]">Lv.{selectedGrantUser?.level ?? "-"}</div>
              </div>
            </div>
            <RequiredField label="积分变动">
              <input
                type="number"
                value={grantForm.points}
                onChange={(event) => setGrantForm((prev) => ({ ...prev, points: event.target.value }))}
                className={inputClassName()}
                placeholder="请输入变动积分"
              />
              <div className="mt-1 text-xs text-[#667085]">正数为发放，负数为扣减</div>
            </RequiredField>
            <RequiredField label="发放原因">
              <textarea
                value={grantForm.reason}
                onChange={(event) => setGrantForm((prev) => ({ ...prev, reason: event.target.value }))}
                maxLength={100}
                className={textareaClassName()}
                placeholder="请输入发放原因（必填）"
              />
              <div className="mt-1 text-right text-xs text-[#667085]">{grantForm.reason.length}/100</div>
            </RequiredField>
            <Field label="关联业务单号（可选）">
              <input
                value={grantBusinessNo}
                onChange={(event) => setGrantBusinessNo(event.target.value)}
                className={inputClassName()}
                placeholder="ORDER-20260524-018"
              />
            </Field>
            <div className="flex items-center justify-between text-sm font-medium text-[#344054]">
              <span>是否通知用户</span>
              <button
                type="button"
                onClick={() => setGrantNotifyUser((prev) => !prev)}
                className={`relative h-6 w-11 rounded-full transition ${grantNotifyUser ? "bg-[#1677ff]" : "bg-[#d0d5dd]"}`}
                aria-pressed={grantNotifyUser}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${grantNotifyUser ? "right-0.5" : "left-0.5"}`} />
              </button>
            </div>
          </div>
          <div className="border-l border-[#edf0f5] bg-[#fbfcfe] p-6">
            <h3 className="text-[16px] font-semibold text-[#101828]">风险提示</h3>
            <ul className="mt-4 space-y-4 text-sm leading-6 text-[#344054]">
              <li>手动发放会写入积分流水</li>
              <li>负数表示扣减积分</li>
              <li>请填写清楚原因，方便后续审计</li>
            </ul>
            <div className="mt-8 rounded-[8px] border border-[#ffbb55] bg-[#fff7e6] p-4 text-sm leading-6 text-[#344054]">
              请确认用户与发放原因无误后再提交。
            </div>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "编辑积分规则" : "新增积分规则"}
        description="配置任务标识、积分分值、规则类型和启用状态。"
        submitLabel="保存规则"
        contentClassName="w-[min(980px,calc(100vw-2rem))]"
        bodyClassName="p-0"
        onSubmit={submit}
      >
        <div className="grid md:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4 p-6">
            <h3 className="text-[16px] font-semibold text-[#101828]">规则设置</h3>
            <RequiredField label="规则名称">
              <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClassName()} placeholder="每日签到奖励" />
            </RequiredField>
            <RequiredField label="任务标识">
              <select value={form.taskKey} onChange={(event) => setForm((prev) => ({ ...prev, taskKey: event.target.value }))} className={inputClassName()}>
                <option value="">无任务标识</option>
                {taskKeyOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </RequiredField>
            <RequiredField label="分值">
              <input type="number" value={form.points} onChange={(event) => setForm((prev) => ({ ...prev, points: event.target.value }))} className={inputClassName()} />
            </RequiredField>
            <RequiredField label="规则类型">
              <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} className={inputClassName()}>
                {typeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </RequiredField>
            <Field label="排序">
              <input type="number" value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))} className={inputClassName()} />
            </Field>
            <Field label="每日上限">
              <input type="number" min={0} value={form.dailyLimit} onChange={(event) => setForm((prev) => ({ ...prev, dailyLimit: event.target.value }))} className={inputClassName()} placeholder="1" />
            </Field>
            <RequiredField label="生效时间">
              <input type="datetime-local" value={form.effectiveAt || ""} onChange={(event) => setForm((prev) => ({ ...prev, effectiveAt: event.target.value }))} className={inputClassName()} />
            </RequiredField>
            <Field label="失效时间">
              <input type="datetime-local" value={form.expiresAt || ""} onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))} className={inputClassName()} />
            </Field>
            <AdminFormSwitch
              label="是否启用"
              checked={Boolean(form.enabled)}
              onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
            />
            <Field label="规则说明">
              <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} className={textareaClassName()} placeholder="用户每日签到可获得积分。" />
            </Field>
          </div>
          <div className="border-l border-[#edf0f5] p-6">
            <h3 className="text-[16px] font-semibold text-[#101828]">效果预览</h3>
            <p className="mt-1 text-sm text-[#667085]">用户完成任务后，将看到以下奖励通知</p>
            <div className="mt-6 rounded-[12px] border border-[#b7ebc6] bg-[linear-gradient(135deg,#f0fff7,#ffffff)] p-6">
              <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#16c784] text-white">
                  <BellRing size={26} />
                </div>
                <div>
                  <div className="text-[20px] font-semibold text-[#101828]">签到成功</div>
                  <div className="mt-2 text-sm text-[#344054]">
                    恭喜你完成“{form.name || "每日签到"}”，获得 <span className="font-semibold text-[#00a854]">{formatSignedPoints(Number(form.points || 0))} 积分</span>
                  </div>
                  <div className="mt-3 text-sm text-[#475467]">今日还可获得 0 次</div>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-[8px] border border-[#edf0f5] bg-white">
              <PreviewRow label="当前规则类型" value={resolveRuleTypeLabel(form.type)} />
              <PreviewRow label="启用状态" value={form.enabled ? "已启用" : "未启用"} />
            </div>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={optionOpen}
        onOpenChange={setOptionOpen}
        title={`${optionEditing ? "编辑" : "新增"}${optionKind === "type" ? "规则类型" : "任务类型"}`}
        description="维护积分规则可选择的类型或任务标识选项。"
        submitLabel={optionEditing ? "保存选项" : "创建选项"}
        onSubmit={submitOption}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="显示名称">
            <input
              value={optionForm.label}
              onChange={(event) => {
                const nextLabel = event.target.value;
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
            <input value={optionForm.value} readOnly className={`${inputClassName()} bg-[#f8fafc] text-[#667085]`} />
          </Field>
        </div>
        <Field label="排序">
          <input type="number" value={optionForm.sortOrder} onChange={(event) => setOptionForm((prev) => ({ ...prev, sortOrder: event.target.value }))} className={inputClassName()} />
        </Field>
      </FormDialog>
    </AdminPageShell>
  );
}

function PointsMetricCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  tone: "blue" | "green" | "orange" | "red";
  label: string;
  value: ReactNode;
  hint: ReactNode;
}) {
  const toneClass = {
    blue: "from-[#2f7dff] to-[#0052d9]",
    green: "from-[#22c55e] to-[#0f9f5f]",
    orange: "from-[#ffa940] to-[#fa8c16]",
    red: "from-[#ff4d5d] to-[#f5222d]",
  }[tone];
  return (
    <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-5">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${toneClass} text-white shadow-[0_10px_24px_rgba(22,119,255,0.22)]`}>
          <Icon size={30} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-[#475467]">{label}</div>
          <div className="mt-2 text-[30px] font-semibold leading-none text-[#101828]">{value}</div>
          <div className="mt-2 text-[14px] text-[#667085]">{hint}</div>
        </div>
      </div>
    </div>
  );
}

function ManualGrantPanel({
  renderUserPicker,
  grantForm,
  setGrantForm,
  onSubmit,
}: {
  renderUserPicker: () => ReactNode;
  grantForm: { username: string; points: string; reason: string };
  setGrantForm: Dispatch<SetStateAction<{ username: string; points: string; reason: string }>>;
  onSubmit: () => void;
}) {
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <h2 className="text-[20px] font-semibold text-[#1f1f1f]">手动发放积分</h2>
      <div className="mt-5 space-y-4">
        <RequiredField label="选择用户">{renderUserPicker()}</RequiredField>
        <RequiredField label="积分变动">
          <input
            type="number"
            value={grantForm.points}
            onChange={(event) => setGrantForm((prev) => ({ ...prev, points: event.target.value }))}
            className={inputClassName()}
            placeholder="请输入变动积分"
          />
          <div className="mt-1 text-xs text-[#667085]">正数为发放，负数为扣减</div>
        </RequiredField>
        <RequiredField label="发放原因">
          <textarea
            value={grantForm.reason}
            onChange={(event) => setGrantForm((prev) => ({ ...prev, reason: event.target.value }))}
            maxLength={100}
            className={textareaClassName()}
            placeholder="请输入发放原因（必填）"
          />
          <div className="mt-1 text-right text-xs text-[#667085]">{grantForm.reason.length}/100</div>
        </RequiredField>
        <div className="flex items-start gap-3 rounded-[8px] border border-[#ffd591] bg-[#fff7e6] px-4 py-3 text-sm text-[#344054]">
          <CircleAlert size={20} className="mt-0.5 shrink-0 text-[#fa8c16]" />
          <span>手动发放会写入积分流水，请确认原因。</span>
        </div>
        <button type="button" onClick={onSubmit} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#1677ff] text-[16px] font-semibold text-white shadow-[0_8px_16px_rgba(22,119,255,0.22)] hover:bg-[#0958d9]">
          确认发放
        </button>
      </div>
    </section>
  );
}

function PointRecordsPanel({
  title,
  records,
  recordsKeyword,
  setRecordsKeyword,
  setRecordsPage,
  onRefresh,
  recordsTotal,
  currentPage,
  totalPages,
  onPageChange,
  onViewMore,
  expanded = false,
}: {
  title: string;
  records: PointsRecord[];
  recordsKeyword: string;
  setRecordsKeyword: (value: string) => void;
  setRecordsPage: (page: number) => void;
  onRefresh: () => void;
  recordsTotal: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onViewMore?: () => void;
  expanded?: boolean;
}) {
  const visibleRecords = expanded ? records : records.slice(0, 3);
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold text-[#1f1f1f]">{title}</h2>
        <div className="flex items-center gap-3">
          {expanded && (
            <div className="flex h-10 items-center gap-2 rounded-[6px] border border-[#d0d5dd] bg-white px-3 text-sm">
              <Search size={16} className="text-[#667085]" />
              <input
                value={recordsKeyword}
                onChange={(event) => {
                  setRecordsKeyword(event.target.value);
                  setRecordsPage(1);
                }}
                className="w-48 bg-transparent outline-none placeholder:text-[#98a2b3]"
                placeholder="按用户名筛选"
              />
            </div>
          )}
          <button type="button" onClick={onRefresh} className={secondaryButtonClassName()}>
            <RefreshCw size={14} />
            刷新
          </button>
          {!expanded && <button type="button" onClick={onViewMore} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1677ff]">查看更多 <ChevronRight size={16} /></button>}
        </div>
      </div>
      <div className="overflow-hidden rounded-[8px] border border-[#edf0f5]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-[#f6f8fb] text-[#344054]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">用户</th>
              <th className="px-4 py-3 text-left font-semibold">变动</th>
              <th className="px-4 py-3 text-left font-semibold">原因</th>
              <th className="px-4 py-3 text-left font-semibold">时间</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((item, index) => {
              const points = getPointsValue(item);
              return (
                <tr key={item.id ?? `${item.userId}-${index}`} className="border-t border-[#edf0f5] text-[#344054]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e6f4ff] text-xs font-semibold text-[#0958d9]">
                        {(item.username || item.user?.username || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <span>{item.username || item.user?.username || "-"}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${points && points < 0 ? "text-[#f5222d]" : "text-[#00a854]"}`}>{formatSignedPoints(points ?? undefined)}</td>
                  <td className="px-4 py-3">{item.reason || item.description || item.bizLabel || item.ruleName || item.taskName || "-"}</td>
                  <td className="px-4 py-3">{formatMaybeDate(item.createTime)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibleRecords.length === 0 && <AdminEmptyState message="暂无积分流水。" />}
      {expanded && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#475467]">
          <div>共 {recordsTotal} 条</div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))} className={secondaryButtonClassName()}>
              <ChevronLeft size={16} />
              上一页
            </button>
            <span className="font-semibold text-[#101828]">{currentPage} / {totalPages}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} className={secondaryButtonClassName()}>
              下一页
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PointsOptionSection({
  title,
  description,
  items,
  selectedCount,
  allSelected,
  isSelected,
  onToggleAll,
  onToggleOne,
  onCreate,
  onEdit,
  onRemove,
  onRemoveSelected,
  deleting,
  resolveLabel,
}: {
  title: string;
  description: string;
  items: PointsOptionRecord[];
  selectedCount: number;
  allSelected: boolean;
  isSelected: (id: number) => boolean;
  onToggleAll: () => void;
  onToggleOne: (id: number) => void;
  onCreate: () => void;
  onEdit: (item: PointsOptionRecord) => void;
  onRemove: (item: PointsOptionRecord) => void;
  onRemoveSelected: () => void;
  deleting: boolean;
  resolveLabel: (value: unknown) => string;
}) {
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-[#1f1f1f]">{title}</h2>
          <p className="mt-1 text-sm text-[#667085]">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onRemoveSelected} disabled={selectedCount === 0 || deleting} className={secondaryButtonClassName()}>
            批量操作
            <ChevronDown size={14} />
          </button>
          <button type="button" onClick={onCreate} className={primaryButtonClassName()}>
            <PlusCircle size={16} />
            新增
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-[8px] border border-[#edf0f5]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-[#f6f8fb] text-[#344054]">
            <tr>
              <th className="w-12 px-4 py-3 text-left">
                <AdminBulkCheckbox checked={allSelected} onChange={onToggleAll} label={`选择全部${title}`} />
              </th>
              <th className="px-4 py-3 text-left font-semibold">显示名称</th>
              <th className="px-4 py-3 text-left font-semibold">标识值</th>
              <th className="px-4 py-3 text-left font-semibold">使用规则</th>
              <th className="px-4 py-3 text-left font-semibold">排序</th>
              <th className="px-4 py-3 text-left font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-[#edf0f5] text-[#344054]">
                <td className="px-4 py-3">
                  <AdminBulkCheckbox checked={isSelected(item.id)} onChange={() => onToggleOne(item.id)} label={`选择${item.label}`} />
                </td>
                <td className="px-4 py-3 font-medium">{item.label}</td>
                <td className="px-4 py-3 font-mono text-[13px]">{item.value || item.optionValue}</td>
                <td className="px-4 py-3">{item.usageCount ?? 0}</td>
                <td className="px-4 py-3">{item.sortOrder ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => onEdit(item)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1677ff]"><Edit3 size={14} />编辑</button>
                    <button type="button" onClick={() => onRemove(item)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#cf1322]"><Trash2 size={14} />删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <AdminEmptyState message={`暂无${title}。`} />}
      <div className="mt-4 text-sm text-[#667085]">当前可用显示：{items.map((item) => resolveLabel(item.value || item.optionValue)).join("、") || "-"}</div>
    </section>
  );
}

function buildPointsRulePayload(source: PointsRuleForm) {
  return {
    name: String(source.name || "").trim(),
    description: String(source.description || "").trim(),
    taskKey: String(source.taskKey || "").trim(),
    points: Number(source.points || 0),
    type: String(source.type || "daily"),
    dailyLimit: toNullableNumber(source.dailyLimit),
    effectiveAt: toApiLocalDateTime(source.effectiveAt),
    expiresAt: toApiLocalDateTime(source.expiresAt),
    enabled: Boolean(source.enabled),
    userVisible: source.userVisible ?? true,
    sortOrder: Number(source.sortOrder || 0),
  };
}

function toNullableNumber(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function toDatetimeLocalValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  return value.trim().replace(" ", "T").slice(0, 16);
}

function toApiLocalDateTime(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function RequiredField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold text-[#344054]"><span className="text-[#f5222d]">* </span>{label}</div>
      {children}
    </label>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#edf0f5] px-4 py-4 last:border-b-0">
      <span className="text-sm text-[#344054]">{label}</span>
      <span className="rounded-[4px] bg-[#e6f8ef] px-2.5 py-1 text-xs font-semibold text-[#0f9f5f]">{value}</span>
    </div>
  );
}
