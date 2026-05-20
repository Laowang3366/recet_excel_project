import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Edit3, RefreshCcw, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import { AddButton, AdminBulkActions, AdminBulkCheckbox, AdminEmptyState, AdminPageShell, AdminPagination, AdminStatCard, AdminStatGrid, FilterBar, FilterField, formatMaybeDate, formatExperienceBizType, EXPERIENCE_BIZ_TYPE_OPTIONS, primaryButtonClassName, secondaryButtonClassName, inputClassName, textareaClassName } from "../admin/shared";
import { PagedAdminResponse, LevelRuleForm, LevelRuleRecord, ExpRuleForm, ExpRuleRecord, LevelsOverviewResponse, LevelUserRecord, ExpLogRecord, adminRequest, showAdminSuccess, runAdminBulkDelete, openAdminPrompt, openAdminConfirm, formatAdminEntityMessage, useAdminRole, DeleteConfirmDialog, FormDialog, Field, AdminFormSwitch, AdminTableSwitch, generateMachineIdentifier } from "./AdminConsoleShared";

export function AdminLevels() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [userPage, setUserPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [levelRuleOpen, setLevelRuleOpen] = useState(false);
  const [levelRuleEditing, setLevelRuleEditing] = useState<LevelRuleRecord | null>(null);
  const [pendingLevelRuleRemove, setPendingLevelRuleRemove] = useState<LevelRuleRecord | null>(null);
  const [levelRulesBulkDeleting, setLevelRulesBulkDeleting] = useState(false);
  const [levelRuleForm, setLevelRuleForm] = useState<LevelRuleForm>({ level: "", name: "", threshold: "0", enabled: true });
  const [expRuleOpen, setExpRuleOpen] = useState(false);
  const [expRuleEditing, setExpRuleEditing] = useState<ExpRuleRecord | null>(null);
  const [pendingExpRuleRemove, setPendingExpRuleRemove] = useState<ExpRuleRecord | null>(null);
  const [expRulesBulkDeleting, setExpRulesBulkDeleting] = useState(false);
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
  const levelRules = overview?.levelRules || [];
  const expRules = overview?.expRules || [];
  const users = usersQuery.data?.records || [];
  const userTotal = usersQuery.data?.total || 0;
  const logs = logsQuery.data?.records || [];
  const logTotal = logsQuery.data?.total || 0;
  const levelRuleBulkSelection = useAdminBulkSelection(levelRules, (item) => item.level);
  const expRuleBulkSelection = useAdminBulkSelection(expRules, (item) => item.key);
  const existingExpRuleKeys = useMemo(() => expRules.map((item) => String(item.key || "").trim()).filter(Boolean), [expRules]);
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

  const removeSelectedLevelRules = async () => {
    const items = levelRuleBulkSelection.selectedItems;
    if (!items.length || levelRulesBulkDeleting) return;
    const confirmed = await openAdminConfirm({
      title: "批量删除等级定义",
      message: `确认删除选中的 ${items.length} 条等级定义？删除后会自动重算受影响用户等级。`,
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (!confirmed) return;
    setLevelRulesBulkDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/levels/rules/${item.level}`),
      entityName: "等级定义",
      errorLabel: "批量删除等级定义",
      onRefresh: async () => {
        await Promise.all([refreshOverview(), refreshUsers()]);
      },
      onFinally: () => {
        levelRuleBulkSelection.clear();
        setLevelRulesBulkDeleting(false);
      },
    });
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

  const removeSelectedExpRules = async () => {
    const items = expRuleBulkSelection.selectedItems;
    if (!items.length || expRulesBulkDeleting) return;
    const confirmed = await openAdminConfirm({
      title: "批量删除经验规则",
      message: `确认删除选中的 ${items.length} 条经验规则？`,
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (!confirmed) return;
    setExpRulesBulkDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/levels/exp-rules/${item.key}`),
      entityName: "经验规则",
      errorLabel: "批量删除经验规则",
      onRefresh: refreshOverview,
      onFinally: () => {
        expRuleBulkSelection.clear();
        setExpRulesBulkDeleting(false);
      },
    });
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
                {levelRules.length} 条定义
              </span>
              <AddButton onClick={openCreateLevelRule}>新增定义</AddButton>
            </div>
          </div>
          <AdminBulkActions
            selectedCount={levelRuleBulkSelection.selectedCount}
            totalCount={levelRules.length}
            allVisibleSelected={levelRuleBulkSelection.allVisibleSelected}
            deleting={levelRulesBulkDeleting}
            onToggleAll={levelRuleBulkSelection.toggleAllVisible}
            onClear={levelRuleBulkSelection.clear}
            onDeleteSelected={() => void removeSelectedLevelRules()}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">选择</TableHead>
                <TableHead>等级</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>经验阈值</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levelRules.map((item) => (
                <TableRow key={item.level}>
                  <TableCell>
                    <AdminBulkCheckbox
                      checked={levelRuleBulkSelection.isSelected(item.level)}
                      onChange={() => levelRuleBulkSelection.toggleOne(item.level)}
                      label={`选择等级定义 ${item.name || item.level}`}
                    />
                  </TableCell>
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
                {expRules.length} 条规则
              </span>
              <AddButton onClick={openCreateExpRule}>新增规则</AddButton>
            </div>
          </div>
          <AdminBulkActions
            selectedCount={expRuleBulkSelection.selectedCount}
            totalCount={expRules.length}
            allVisibleSelected={expRuleBulkSelection.allVisibleSelected}
            deleting={expRulesBulkDeleting}
            onToggleAll={expRuleBulkSelection.toggleAllVisible}
            onClear={expRuleBulkSelection.clear}
            onDeleteSelected={() => void removeSelectedExpRules()}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">选择</TableHead>
                <TableHead>规则</TableHead>
                <TableHead>经验范围</TableHead>
                <TableHead>最多可获得</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expRules.map((item) => (
                <TableRow key={item.key}>
                  <TableCell>
                    <AdminBulkCheckbox
                      checked={expRuleBulkSelection.isSelected(item.key)}
                      onChange={() => expRuleBulkSelection.toggleOne(item.key)}
                      label={`选择经验规则 ${item.label || item.key}`}
                    />
                  </TableCell>
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
