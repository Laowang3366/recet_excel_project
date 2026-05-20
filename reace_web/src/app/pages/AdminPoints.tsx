import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Edit3, Send, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { AddButton, AdminBulkActions, AdminBulkCheckbox, AdminEmptyState, AdminPageShell, AdminPagination, AdminSection, AdminStatCard, AdminStatGrid, FilterBar, FilterField, formatMaybeDate, formatPointsTaskKey, formatPointsRuleType, POINTS_RULE_TYPE_OPTIONS, POINTS_TASK_KEY_OPTIONS, primaryButtonClassName, secondaryButtonClassName, inputClassName, textareaClassName } from "../admin/shared";
import { PagedAdminResponse, AdminUserRecord, PointsRuleForm, PointsRuleRecord, PointsOptionKind, PointsOptionForm, PointsOptionRecord, PointsStatsResponse, PointsOptionsResponse, PointsRecord, PointsGrantResponse, adminRequest, showAdminSuccess, runAdminDelete, runAdminBulkDelete, openAdminConfirm, formatAdminEntityMessage, useAdminRole, FormDialog, Field, AdminFormSwitch, AdminTableSwitch, defaultPointsRuleForm, defaultPointsOptionForm, buildAdminOptionChoices, buildAdminOptionLabelMap, generateMachineIdentifier } from "./AdminConsoleShared";

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
      onRefresh: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsRules() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsStats() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.pointsRecords({ page: recordsPage, size, keyword: recordsKeyword.trim() }) }),
        ]);
      },
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
          <AdminBulkActions
            selectedCount={rulesBulkSelection.selectedCount}
            totalCount={rules.length}
            allVisibleSelected={rulesBulkSelection.allVisibleSelected}
            deleting={rulesBulkDeleting}
            onToggleAll={rulesBulkSelection.toggleAllVisible}
            onClear={rulesBulkSelection.clear}
            onDeleteSelected={() => void removeSelectedRules()}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">选择</TableHead>
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
                    <AdminBulkCheckbox
                      checked={rulesBulkSelection.isSelected(item.id)}
                      onChange={() => rulesBulkSelection.toggleOne(item.id)}
                      label={`选择积分规则 ${item.name}`}
                    />
                  </TableCell>
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
          <AdminBulkActions
            selectedCount={typeOptionsBulkSelection.selectedCount}
            totalCount={(pointsOptions.types || []).length}
            allVisibleSelected={typeOptionsBulkSelection.allVisibleSelected}
            deleting={typeOptionsBulkDeleting}
            onToggleAll={typeOptionsBulkSelection.toggleAllVisible}
            onClear={typeOptionsBulkSelection.clear}
            onDeleteSelected={() => void removeSelectedOptions("type", typeOptionsBulkSelection, setTypeOptionsBulkDeleting)}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">选择</TableHead>
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
                  <TableCell>
                    <AdminBulkCheckbox
                      checked={typeOptionsBulkSelection.isSelected(item.id)}
                      onChange={() => typeOptionsBulkSelection.toggleOne(item.id)}
                      label={`选择规则类型 ${item.label}`}
                    />
                  </TableCell>
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
          <AdminBulkActions
            selectedCount={taskOptionsBulkSelection.selectedCount}
            totalCount={(pointsOptions.taskKeys || []).length}
            allVisibleSelected={taskOptionsBulkSelection.allVisibleSelected}
            deleting={taskOptionsBulkDeleting}
            onToggleAll={taskOptionsBulkSelection.toggleAllVisible}
            onClear={taskOptionsBulkSelection.clear}
            onDeleteSelected={() => void removeSelectedOptions("task_key", taskOptionsBulkSelection, setTaskOptionsBulkDeleting)}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">选择</TableHead>
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
                  <TableCell>
                    <AdminBulkCheckbox
                      checked={taskOptionsBulkSelection.isSelected(item.id)}
                      onChange={() => taskOptionsBulkSelection.toggleOne(item.id)}
                      label={`选择任务类型 ${item.label}`}
                    />
                  </TableCell>
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
