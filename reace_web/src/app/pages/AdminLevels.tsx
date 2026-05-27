import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileText,
  Medal,
  PlusCircle,
  RefreshCcw,
  ShieldCheck,
  Star,
  Target,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import {
  AdminBulkCheckbox,
  AdminEmptyState,
  AdminPageShell,
  EXPERIENCE_BIZ_TYPE_OPTIONS,
  formatExperienceBizType,
  formatMaybeDate,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "../admin/shared";
import {
  DeleteConfirmDialog,
  ExpLogRecord,
  ExpRuleForm,
  ExpRuleRecord,
  Field,
  FormDialog,
  LevelRuleForm,
  LevelRuleRecord,
  LevelRecalculatePreviewResponse,
  LevelUserDetailResponse,
  LevelUserRecord,
  LevelsOverviewResponse,
  PagedAdminResponse,
  adminRequest,
  formatAdminEntityMessage,
  generateMachineIdentifier,
  openAdminConfirm,
  openAdminPrompt,
  runAdminBulkDelete,
  showAdminSuccess,
  useAdminRole,
} from "./AdminConsoleShared";
import {
  buildLevelDashboard,
  getLevelBadgeClassName,
  getLevelBadgeTone,
  getLevelProgressPercent,
} from "./AdminLevelsViewModel";

type LevelTab = "rules" | "users" | "expRules" | "logs";
type LevelIconTone = "slate" | "green" | "orange" | "purple" | "pink" | "blue";

const levelTabs: Array<{ key: LevelTab; label: string }> = [
  { key: "rules", label: "等级规则" },
  { key: "users", label: "用户等级" },
  { key: "expRules", label: "经验规则" },
  { key: "logs", label: "经验日志" },
];

const levelIconTones: LevelIconTone[] = ["slate", "green", "orange", "purple", "pink", "blue"];

export function AdminLevels() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LevelTab>("rules");
  const [userPage, setUserPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [levelRuleOpen, setLevelRuleOpen] = useState(false);
  const [levelRuleEditing, setLevelRuleEditing] = useState<LevelRuleRecord | null>(null);
  const [pendingLevelRuleRemove, setPendingLevelRuleRemove] = useState<LevelRuleRecord | null>(null);
  const [levelRulesBulkDeleting, setLevelRulesBulkDeleting] = useState(false);
  const [levelRuleForm, setLevelRuleForm] = useState<LevelRuleForm>({ level: "", name: "", threshold: "0", sortOrder: "0", enabled: true });
  const [levelRuleMaxExp, setLevelRuleMaxExp] = useState("");
  const [levelIconTone, setLevelIconTone] = useState<LevelIconTone>("blue");
  const [levelRuleBenefits, setLevelRuleBenefits] = useState("");
  const [expRuleOpen, setExpRuleOpen] = useState(false);
  const [expRuleEditing, setExpRuleEditing] = useState<ExpRuleRecord | null>(null);
  const [pendingExpRuleRemove, setPendingExpRuleRemove] = useState<ExpRuleRecord | null>(null);
  const [expRulesBulkDeleting, setExpRulesBulkDeleting] = useState(false);
  const [expRuleForm, setExpRuleForm] = useState<ExpRuleForm>({ key: "", name: "", description: "", minExp: "0", maxExp: "0", maxObtainCount: "", enabled: true });
  const [userKeyword, setUserKeyword] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [logUsername, setLogUsername] = useState("");
  const [bizType, setBizType] = useState("");
  const [recalculateOpen, setRecalculateOpen] = useState(false);
  const [recalculateInput, setRecalculateInput] = useState("");
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
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
  const recalculatePreviewQuery = useQuery({
    queryKey: ["admin", "levels", "recalculate-preview"],
    enabled: Boolean(role && recalculateOpen),
    queryFn: async () => {
      const result = await adminRequest<LevelRecalculatePreviewResponse>(api.get("/api/admin/levels/recalculate-preview", { silent: true }), navigate, role);
      return result || null;
    },
  });
  const userDetailQuery = useQuery({
    queryKey: ["admin", "levels", "users", detailUserId, "detail"],
    enabled: Boolean(role && detailUserId),
    queryFn: async () => {
      const result = await adminRequest<LevelUserDetailResponse>(api.get(`/api/admin/levels/users/${detailUserId}`, { silent: true }), navigate, role);
      return result || null;
    },
  });

  const overview = overviewQuery.data;
  const recalculatePreview = recalculatePreviewQuery.data;
  const userDetail = userDetailQuery.data;
  const dashboard = useMemo(() => buildLevelDashboard(overview), [overview]);
  const levelRules = overview?.levelRules || [];
  const expRules = overview?.expRules || [];
  const users = usersQuery.data?.records || [];
  const userTotal = usersQuery.data?.total || 0;
  const logs = logsQuery.data?.records || [];
  const logTotal = logsQuery.data?.total || 0;
  const userPages = Math.max(1, Math.ceil(userTotal / Math.max(size, 1)));
  const logPages = Math.max(1, Math.ceil(logTotal / Math.max(size, 1)));
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
  const chartDistribution = dashboard.distribution.length > 0
    ? dashboard.distribution
    : levelRules.map((item) => ({ level: item.level, name: item.name, threshold: item.threshold, userCount: 0 }));

  const refreshOverview = () => queryClient.invalidateQueries({ queryKey: adminKeys.levelsOverview() }).then(() => undefined);
  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: adminKeys.levelsUsers({ page: userPage, size, keyword: userKeyword.trim(), level: levelFilter }) }).then(() => undefined);
  const refreshLogs = () => queryClient.invalidateQueries({ queryKey: adminKeys.levelsLogs({ page: logPage, size, username: logUsername.trim(), bizType: bizType.trim() }) }).then(() => undefined);

  const openCreateLevelRule = () => {
    const nextLevel = levelRules.reduce((max, item) => Math.max(max, Number(item.level || 0)), 0) + 1;
    setLevelRuleEditing(null);
    setLevelRuleForm({ level: String(nextLevel), name: "", threshold: "0", sortOrder: String(nextLevel), enabled: true });
    setLevelRuleMaxExp("");
    setLevelIconTone("blue");
    setLevelRuleBenefits("");
    setLevelRuleOpen(true);
  };

  const updateLevelRule = (item: LevelRuleRecord) => {
    setLevelRuleEditing(item);
    setLevelRuleForm({
      level: String(item.level ?? ""),
      name: String(item.name ?? ""),
      threshold: String(item.threshold ?? 0),
      sortOrder: String(item.sortOrder ?? item.level ?? 0),
      enabled: item.enabled ?? true,
    });
    const nextRule = levelRules
      .filter((rule) => Number(rule.level) > Number(item.level))
      .sort((left, right) => Number(left.level) - Number(right.level))[0];
    setLevelRuleMaxExp(item.maxExp != null ? String(item.maxExp) : nextRule?.threshold ? String(Math.max(Number(nextRule.threshold) - 1, Number(item.threshold || 0))) : "");
    setLevelIconTone(toLevelIconTone(item.iconTone, toneFromLevel(item.level)));
    setLevelRuleBenefits(String(item.benefits || ""));
    setLevelRuleOpen(true);
  };

  const submitLevelRule = async () => {
    const payload = {
      level: Number(levelRuleForm.level),
      name: String(levelRuleForm.name || "").trim(),
      threshold: Number(levelRuleForm.threshold),
      maxExp: toNullableNumber(levelRuleMaxExp),
      iconTone: levelIconTone,
      benefits: levelRuleBenefits.trim(),
      enabled: Boolean(levelRuleForm.enabled),
      sortOrder: Number(levelRuleForm.sortOrder || levelRuleForm.level || 0),
    };
    const result = levelRuleEditing
      ? await adminRequest(
        api.put(`/api/admin/levels/rules/${levelRuleEditing.level}`, {
          name: payload.name,
          threshold: payload.threshold,
          maxExp: payload.maxExp,
          iconTone: payload.iconTone,
          benefits: payload.benefits,
          enabled: payload.enabled,
          sortOrder: payload.sortOrder,
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
        maxExp: item.maxExp ?? null,
        iconTone: item.iconTone || toneFromLevel(item.level),
        benefits: item.benefits || "",
        enabled: nextEnabled,
        sortOrder: Number(item.sortOrder || item.level || 0),
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
    if (recalculateInput.trim() !== "确认重算") return;
    const result = await adminRequest(api.post("/api/admin/levels/recalculate", {}), navigate, role, "重算等级");
    if (!result) return;
    setRecalculateOpen(false);
    setRecalculateInput("");
    showAdminSuccess("等级重算已完成");
    await Promise.all([
      refreshOverview(),
      refreshUsers(),
      refreshLogs(),
      queryClient.invalidateQueries({ queryKey: ["admin", "levels", "recalculate-preview"] }),
    ]);
  };

  return (
    <AdminPageShell
      title="等级体系"
      description=""
      actions={(
        <>
          <button type="button" onClick={() => setRecalculateOpen(true)} className={secondaryButtonClassName()}>
            <RefreshCcw size={16} />
            重新计算等级
          </button>
          <button type="button" onClick={openCreateLevelRule} className={primaryButtonClassName()}>
            <PlusCircle size={16} />
            新增等级
          </button>
        </>
      )}
    >
      <div className="rounded-[8px] border border-[#e5e7eb] bg-white px-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap gap-4">
          {levelTabs.map((tab) => (
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LevelMetricCard icon={Award} tone="blue" label="等级规则" value={dashboard.levelRuleCount} hint={dashboard.enabledLevelRuleCount === dashboard.levelRuleCount ? "全部启用" : `启用 ${dashboard.enabledLevelRuleCount}`} />
        <LevelMetricCard icon={ShieldCheck} tone="green" label="经验规则" value={dashboard.expRuleCount} hint={`启用 ${dashboard.enabledExpRuleCount}`} />
        <LevelMetricCard icon={Target} tone="orange" label="需校准" value={dashboard.pendingReviewCount} hint="暂无" />
        <LevelMetricCard icon={FileText} tone="red" label="经验日志" value={logTotal.toLocaleString()} hint="累计" />
      </div>

      {activeTab === "rules" && (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <LevelLadderPanel
              levelRules={levelRules}
              selected={levelRuleBulkSelection}
              onToggleEnabled={toggleLevelRuleEnabled}
              onEdit={updateLevelRule}
              onRemove={removeLevelRule}
              onRemoveSelected={() => void removeSelectedLevelRules()}
              deleting={levelRulesBulkDeleting}
            />
            <LevelDistributionPanel distribution={chartDistribution} highestLevelUsers={dashboard.highestLevelUsers} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <UsersPanel
              users={users.slice(0, 4)}
              userTotal={userTotal}
              onUpdateUser={updateUser}
              onViewUser={(item) => setDetailUserId(item.id)}
              compact
            />
            <RiskPanel />
          </div>
        </>
      )}

      {activeTab === "users" && (
        <UsersPanel
          users={users}
          userTotal={userTotal}
          onUpdateUser={updateUser}
          onViewUser={(item) => setDetailUserId(item.id)}
          userKeyword={userKeyword}
          setUserKeyword={setUserKeyword}
          levelFilter={levelFilter}
          setLevelFilter={setLevelFilter}
          setUserPage={setUserPage}
          currentPage={userPage}
          totalPages={userPages}
          onPageChange={setUserPage}
        />
      )}

      {activeTab === "expRules" && (
        <ExpRulesPanel
          expRules={expRules}
          selected={expRuleBulkSelection}
          onCreate={openCreateExpRule}
          onEdit={updateExpRule}
          onRemove={removeExpRule}
          onRemoveSelected={() => void removeSelectedExpRules()}
          onToggleEnabled={toggleExpRuleEnabled}
          deleting={expRulesBulkDeleting}
        />
      )}

      {activeTab === "logs" && (
        <LogsPanel
          logs={logs}
          logTotal={logTotal}
          logUsername={logUsername}
          setLogUsername={setLogUsername}
          bizType={bizType}
          setBizType={setBizType}
          options={experienceBizTypeOptions}
          setLogPage={setLogPage}
          currentPage={logPage}
          totalPages={logPages}
          onPageChange={setLogPage}
        />
      )}

      <FormDialog
        open={levelRuleOpen}
        onOpenChange={setLevelRuleOpen}
        title={levelRuleEditing ? "编辑等级规则" : "新增等级规则"}
        description="配置等级编号、名称、经验阈值、启用状态和排序。"
        submitLabel="保存等级"
        contentClassName="w-[min(860px,calc(100vw-2rem))]"
        bodyClassName="p-0"
        onSubmit={submitLevelRule}
      >
        <div className="grid md:grid-cols-[1fr_324px]">
          <div className="space-y-4 p-6">
            <RequiredField label="等级编号">
              <input type="number" min={1} value={levelRuleForm.level} disabled={Boolean(levelRuleEditing)} onChange={(event) => setLevelRuleForm((prev) => ({ ...prev, level: event.target.value }))} className={inputClassName()} />
            </RequiredField>
            <RequiredField label="等级名称">
              <input value={levelRuleForm.name} onChange={(event) => setLevelRuleForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClassName()} placeholder="公式大师" />
            </RequiredField>
            <RequiredField label="最低经验值">
              <input type="number" min={0} value={levelRuleForm.threshold} onChange={(event) => setLevelRuleForm((prev) => ({ ...prev, threshold: event.target.value }))} className={inputClassName()} />
            </RequiredField>
            <Field label="最高经验值">
              <input type="number" min={0} value={levelRuleMaxExp} onChange={(event) => setLevelRuleMaxExp(event.target.value)} className={inputClassName()} placeholder="由下一等级阈值决定" />
            </Field>
            <RequiredField label="等级图标">
              <div className="flex flex-wrap gap-2">
                {levelIconTones.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setLevelIconTone(tone)}
                    className={`flex h-11 w-11 items-center justify-center rounded-[8px] border ${levelIconTone === tone ? "border-[#1677ff] ring-2 ring-[#1677ff]/20" : "border-[#d0d5dd]"}`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-[6px] ${levelIconToneClassName(tone)}`}>
                      <Medal size={16} />
                    </span>
                  </button>
                ))}
              </div>
            </RequiredField>
            <RequiredField label="等级权益说明">
              <textarea
                value={levelRuleBenefits}
                onChange={(event) => setLevelRuleBenefits(event.target.value)}
                maxLength={100}
                className={textareaClassName()}
                placeholder="解锁高阶题库、优先体验新功能、等级徽章展示"
              />
              <div className="mt-1 text-right text-xs text-[#667085]">{levelRuleBenefits.length}/100</div>
            </RequiredField>
            <div className="grid grid-cols-[auto_1fr] items-center gap-4">
              <span className="text-sm font-semibold text-[#344054]">是否启用：</span>
              <button
                type="button"
                onClick={() => setLevelRuleForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`h-7 w-12 rounded-full p-0.5 transition ${levelRuleForm.enabled ? "bg-[#1677ff]" : "bg-[#d0d5dd]"}`}
              >
                <span className={`block h-6 w-6 rounded-full bg-white shadow transition ${levelRuleForm.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <RequiredField label="排序">
              <input type="number" min={0} value={levelRuleForm.sortOrder || ""} onChange={(event) => setLevelRuleForm((prev) => ({ ...prev, sortOrder: event.target.value }))} className={inputClassName()} />
            </RequiredField>
          </div>
          <div className="border-l border-[#edf0f5] bg-[#fbfcfe] p-6">
            <h3 className="text-center text-[16px] font-semibold text-[#344054]">用户等级徽章预览</h3>
            <div className="mt-8 flex flex-col items-center">
              <div className={`relative flex h-24 w-24 items-center justify-center rounded-[22px] border-4 border-[#ffc35a] bg-gradient-to-br ${levelPreviewGradient(levelIconTone)} text-white shadow-[0_18px_42px_rgba(22,119,255,0.28)]`}>
                <Star size={42} fill="currentColor" />
              </div>
              <div className="mt-5 text-center text-[28px] font-semibold text-[#1677ff]">Lv.{levelRuleForm.level || "-"}</div>
              <div className="text-center text-[18px] font-semibold text-[#1677ff]">{levelRuleForm.name || "公式大师"}</div>
              <div className="mt-5 flex w-full items-center justify-between rounded-[6px] border border-[#e5e7eb] bg-white px-4 py-3 text-sm">
                <span className="text-[#344054]">经验范围：{Number(levelRuleForm.threshold || 0).toLocaleString()} - {levelRuleMaxExp || "∞"}</span>
                <span className="rounded-[4px] bg-[#e6f8ef] px-2 py-1 text-xs font-semibold text-[#0f9f5f]">已启用</span>
              </div>
              <div className="mt-5 w-full border-t border-[#e5e7eb] pt-5">
                <div className="mb-3 text-center text-sm font-semibold text-[#344054]">用户端展示示例</div>
                <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f4ff] text-[#1677ff]"><UserRound size={22} /></div>
                    <div>
                      <div className="font-semibold text-[#101828]">示例用户</div>
                      <div className="mt-1 inline-flex rounded-[4px] bg-[#e6f4ff] px-2 py-0.5 text-xs font-semibold text-[#1677ff]">Lv.{levelRuleForm.level || "-"} {levelRuleForm.name || "公式大师"}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-[#667085]">经验值 8,765 / {levelRuleMaxExp || "11,999"}</div>
                  <div className="mt-2 h-2 rounded-full bg-[#edf0f5]"><div className="h-2 w-[72%] rounded-full bg-[#1677ff]" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={expRuleOpen}
        onOpenChange={setExpRuleOpen}
        title={expRuleEditing ? `编辑经验规则 ${expRuleEditing.label}` : "新增经验规则"}
        description="配置经验来源、经验范围、每日上限和启用状态。"
        submitLabel={expRuleEditing ? "保存规则" : "创建规则"}
        contentClassName="w-[min(760px,calc(100vw-2rem))]"
        bodyClassName="px-5 py-4"
        onSubmit={submitExpRule}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="规则标识">
            <input value={expRuleForm.key} readOnly className={`${inputClassName()} bg-[#f8fafc] text-[#667085]`} placeholder="将根据规则名称自动生成" />
          </Field>
          <Field label="规则名称">
            <input
              value={expRuleForm.name}
              onChange={(event) => {
                const nextName = event.target.value;
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
            <input type="number" min={0} value={expRuleForm.minExp} onChange={(event) => setExpRuleForm((prev) => ({ ...prev, minExp: event.target.value }))} className={inputClassName()} />
          </Field>
          <Field label="最大经验值">
            <input type="number" min={0} value={expRuleForm.maxExp} onChange={(event) => setExpRuleForm((prev) => ({ ...prev, maxExp: event.target.value }))} className={inputClassName()} />
          </Field>
          <Field label="最多可获得次数">
            <input type="number" min={0} value={expRuleForm.maxObtainCount} onChange={(event) => setExpRuleForm((prev) => ({ ...prev, maxObtainCount: event.target.value }))} className={inputClassName()} placeholder="留空或 0 表示不限制" />
          </Field>
          <Field label="启用状态">
            <button type="button" onClick={() => setExpRuleForm((prev) => ({ ...prev, enabled: !prev.enabled }))} className={`h-7 w-12 rounded-full p-0.5 transition ${expRuleForm.enabled ? "bg-[#1677ff]" : "bg-[#d0d5dd]"}`}>
              <span className={`block h-6 w-6 rounded-full bg-white shadow transition ${expRuleForm.enabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </Field>
          <div className="md:col-span-2">
            <Field label="规则说明">
              <textarea value={expRuleForm.description} onChange={(event) => setExpRuleForm((prev) => ({ ...prev, description: event.target.value }))} className={textareaClassName()} />
            </Field>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={recalculateOpen}
        onOpenChange={setRecalculateOpen}
        title="确认重新计算用户等级"
        description="重新计算会按当前经验规则更新用户等级展示。"
        submitLabel="开始重新计算"
        contentClassName="w-[min(520px,calc(100vw-2rem))]"
        onSubmit={recalculate}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#fff7e6] text-[#fa8c16]">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-4 text-sm leading-6 text-[#344054]">
            <div className="font-semibold text-[#1677ff]">
              影响用户数：{formatOptionalNumber(recalculatePreview?.affectedUsers)}
              <span className="ml-2 text-[#667085]">/ 总用户 {formatOptionalNumber(recalculatePreview?.totalUsers ?? overview?.stats?.userCount)}</span>
            </div>
            <div className="flex items-start gap-2"><BadgeCheck size={18} className="mt-1 shrink-0" />将根据当前经验规则重新计算所有用户等级</div>
            <div className="flex items-start gap-2">
              <CalendarDays size={18} className="mt-1 shrink-0" />
              预计耗时：约 {recalculatePreview?.estimatedMinutesMin ?? 1}-{recalculatePreview?.estimatedMinutesMax ?? 3} 分钟
            </div>
            <div className="rounded-[8px] border border-[#ffd591] bg-[#fff7e6] px-4 py-3 font-medium">风险提示：该操作会修改用户等级展示，请确认规则无误</div>
            <label className="block">
              <div className="mb-2 font-semibold">请输入 “确认重算” 继续</div>
              <input value={recalculateInput} onChange={(event) => setRecalculateInput(event.target.value)} className={inputClassName()} placeholder="确认重算" />
            </label>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={Boolean(detailUserId)}
        onOpenChange={(next) => {
          if (!next) setDetailUserId(null);
        }}
        title="用户等级详情"
        submitLabel="关闭"
        contentClassName="w-[min(720px,calc(100vw-2rem))]"
        onSubmit={() => setDetailUserId(null)}
      >
        {userDetailQuery.isFetching ? (
          <div className="py-8 text-center text-sm text-[#667085]">加载中...</div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-[8px] border border-[#e5e7eb] bg-[#fbfcfe] p-4 sm:grid-cols-4">
              <div>
                <div className="text-xs text-[#667085]">用户</div>
                <div className="mt-1 font-semibold text-[#101828]">{userDetail?.user?.username || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-[#667085]">等级</div>
                <div className="mt-1 font-semibold text-[#1677ff]">Lv.{userDetail?.user?.level ?? "-"} {userDetail?.user?.levelName || ""}</div>
              </div>
              <div>
                <div className="text-xs text-[#667085]">经验</div>
                <div className="mt-1 font-semibold text-[#101828]">{formatOptionalNumber(userDetail?.user?.exp)}</div>
              </div>
              <div>
                <div className="text-xs text-[#667085]">积分</div>
                <div className="mt-1 font-semibold text-[#101828]">{formatOptionalNumber(userDetail?.user?.points)}</div>
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-[#344054]">最近经验日志</div>
              <div className="overflow-hidden rounded-[8px] border border-[#edf0f5]">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead className="bg-[#f6f8fb] text-[#344054]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">来源</th>
                      <th className="px-4 py-3 text-left font-semibold">变动</th>
                      <th className="px-4 py-3 text-left font-semibold">原因</th>
                      <th className="px-4 py-3 text-left font-semibold">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(userDetail?.recentLogs || []).map((item) => (
                      <tr key={item.id} className="border-t border-[#edf0f5] text-[#344054]">
                        <td className="px-4 py-3">{item.bizLabel || formatExperienceBizType(item.bizType)}</td>
                        <td className={`px-4 py-3 font-semibold ${Number(item.expChange || 0) >= 0 ? "text-[#00a854]" : "text-[#f5222d]"}`}>{formatSignedNumber(item.expChange)}</td>
                        <td className="px-4 py-3">{item.reason || "-"}</td>
                        <td className="px-4 py-3">{formatMaybeDate(item.createTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(userDetail?.recentLogs || []).length === 0 && <AdminEmptyState message="暂无经验日志。" />}
            </div>
          </div>
        )}
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

function LevelMetricCard({
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
        <div>
          <div className="text-[15px] font-medium text-[#475467]">{label}</div>
          <div className="mt-2 text-[30px] font-semibold leading-none text-[#101828]">{value}</div>
          <div className="mt-2 text-[14px] text-[#667085]">{hint}</div>
        </div>
      </div>
    </div>
  );
}

function LevelLadderPanel({
  levelRules,
  selected,
  onToggleEnabled,
  onEdit,
  onRemove,
  onRemoveSelected,
  deleting,
}: {
  levelRules: LevelRuleRecord[];
  selected: ReturnType<typeof useAdminBulkSelection<LevelRuleRecord, number>>;
  onToggleEnabled: (item: LevelRuleRecord, next: boolean) => void;
  onEdit: (item: LevelRuleRecord) => void;
  onRemove: (item: LevelRuleRecord) => void;
  onRemoveSelected: () => void;
  deleting: boolean;
}) {
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold text-[#1f1f1f]">等级阶梯</h2>
        <button type="button" onClick={onRemoveSelected} disabled={selected.selectedCount === 0 || deleting} className={secondaryButtonClassName()}>
          批量操作
        </button>
      </div>
      <div className="relative space-y-2 pl-9">
        <div className="absolute bottom-5 left-3 top-5 w-[3px] rounded-full bg-[#1677ff]" />
        {levelRules.map((item) => {
          const tone = toLevelIconTone(item.iconTone, toneFromLevel(item.level));
          return (
            <div key={item.level} className="relative flex min-h-[46px] items-center gap-3 rounded-[6px] border border-[#e5e7eb] bg-white px-4 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <span className="absolute -left-[34px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-[3px] border-[#1677ff] bg-white" />
              <AdminBulkCheckbox checked={selected.isSelected(item.level)} onChange={() => selected.toggleOne(item.level)} label={`选择 Lv.${item.level}`} />
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] ring-1 ring-[#d0d5dd] ${levelIconToneClassName(tone)}`}>
                <Medal size={18} />
              </div>
              <div className="w-16 font-semibold text-[#101828]">Lv.{item.level}</div>
              <div className="min-w-[96px] text-[#344054]">{item.name || "-"}</div>
              <div className="ml-auto text-sm text-[#475467]">{item.rangeText || `${Number(item.threshold || 0).toLocaleString()}+ 经验`}</div>
              <button type="button" onClick={() => onToggleEnabled(item, !(item.enabled ?? true))} className={`rounded-[4px] px-2.5 py-1 text-xs font-semibold ${item.enabled === false ? "bg-[#fff7e6] text-[#d46b08]" : "bg-[#e6f8ef] text-[#0f9f5f]"}`}>
                {item.enabled === false ? "停用" : "启用"}
              </button>
              <button type="button" onClick={() => onEdit(item)} className="text-[#1677ff]"><Edit3 size={16} /></button>
              <button type="button" onClick={() => onRemove(item)} className="text-[#cf1322]"><Trash2 size={16} /></button>
            </div>
          );
        })}
      </div>
      {levelRules.length === 0 && <AdminEmptyState message="暂无等级定义。" />}
    </section>
  );
}

function LevelDistributionPanel({
  distribution,
  highestLevelUsers,
}: {
  distribution: NonNullable<LevelsOverviewResponse["distribution"]>;
  highestLevelUsers: number;
}) {
  const maxValue = Math.max(1, ...distribution.map((item) => Number(item.userCount || 0)));
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold text-[#1f1f1f]">用户等级分布</h2>
        <div className="text-sm text-[#475467]">当前最高等级用户： <span className="font-semibold text-[#344054]">{highestLevelUsers}</span></div>
      </div>
      <div className="grid h-[250px] grid-cols-[44px_minmax(0,1fr)] gap-4">
        <div className="flex flex-col justify-between text-right text-xs text-[#667085]">
          <span>3,000</span>
          <span>2,400</span>
          <span>1,800</span>
          <span>1,200</span>
          <span>600</span>
          <span>0</span>
        </div>
        <div className="relative flex items-end justify-around gap-3 border-b border-l border-[#e5e7eb] px-4 pb-0">
          <div className="absolute inset-x-0 top-0 h-px border-t border-dashed border-[#d9e1ec]" />
          <div className="absolute inset-x-0 top-[20%] h-px border-t border-dashed border-[#d9e1ec]" />
          <div className="absolute inset-x-0 top-[40%] h-px border-t border-dashed border-[#d9e1ec]" />
          <div className="absolute inset-x-0 top-[60%] h-px border-t border-dashed border-[#d9e1ec]" />
          <div className="absolute inset-x-0 top-[80%] h-px border-t border-dashed border-[#d9e1ec]" />
          {distribution.map((item) => {
            const height = Math.max(8, Math.round((Number(item.userCount || 0) / maxValue) * 186));
            return (
              <div key={item.level} className="relative z-10 flex w-[86px] flex-col items-center justify-end">
                <div className="mb-2 text-sm font-medium text-[#344054]">{Number(item.userCount || 0).toLocaleString()}</div>
                <div className="w-10 rounded-t-[4px] bg-[#1677ff] shadow-[0_8px_18px_rgba(22,119,255,0.24)]" style={{ height }} />
                <div className="mt-2 text-center text-xs leading-5 text-[#344054]">Lv.{item.level}<br />{item.name || "-"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function UsersPanel({
  users,
  userTotal,
  onUpdateUser,
  onViewUser,
  userKeyword,
  setUserKeyword,
  levelFilter,
  setLevelFilter,
  setUserPage,
  currentPage,
  totalPages,
  onPageChange,
  compact = false,
}: {
  users: LevelUserRecord[];
  userTotal: number;
  onUpdateUser: (item: LevelUserRecord) => void;
  onViewUser: (item: LevelUserRecord) => void;
  userKeyword?: string;
  setUserKeyword?: (value: string) => void;
  levelFilter?: string;
  setLevelFilter?: (value: string) => void;
  setUserPage?: (page: number) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  compact?: boolean;
}) {
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold text-[#1f1f1f]">用户等级</h2>
        {!compact && <span className="text-sm text-[#667085]">共 {userTotal} 人</span>}
      </div>
      {!compact && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <input value={userKeyword || ""} onChange={(event) => { setUserKeyword?.(event.target.value); setUserPage?.(1); }} className={inputClassName()} placeholder="用户名 / 邮箱" />
          <input value={levelFilter || ""} onChange={(event) => { setLevelFilter?.(event.target.value); setUserPage?.(1); }} className={inputClassName()} placeholder="等级，如 3" />
        </div>
      )}
      <div className="overflow-hidden rounded-[8px] border border-[#edf0f5]">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-[#f6f8fb] text-[#344054]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">用户</th>
              <th className="px-4 py-3 text-left font-semibold">等级</th>
              <th className="px-4 py-3 text-left font-semibold">经验</th>
              <th className="px-4 py-3 text-left font-semibold">进度</th>
              <th className="px-4 py-3 text-left font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => {
              const progress = getLevelProgressPercent(item);
              const tone = getLevelBadgeTone(item.level);
              return (
                <tr key={item.id} className="border-t border-[#edf0f5] text-[#344054]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${avatarTone(item.username)}`}>{(item.username || "?").slice(0, 1).toUpperCase()}</div>
                      {item.username || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-[4px] px-2.5 py-1 text-xs font-semibold ring-1 ${getLevelBadgeClassName(tone)}`}>
                      Lv.{item.level} {item.levelName}
                    </span>
                  </td>
                  <td className="px-4 py-3">{Number(item.exp || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-44 rounded-full bg-[#edf0f5]"><div className="h-2 rounded-full bg-[#1677ff]" style={{ width: `${progress}%` }} /></div>
                      <span className="text-xs text-[#475467]">{progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => onViewUser(item)} className="font-semibold text-[#1677ff]">详情</button>
                      <button type="button" onClick={() => onUpdateUser(item)} className={secondaryButtonClassName()}>
                        <Edit3 size={14} />
                        调整经验
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <AdminEmptyState message="暂无等级用户数据。" />}
      {!compact && currentPage && totalPages && onPageChange && (
        <div className="mt-4 flex items-center justify-between text-sm text-[#475467]">
          <span>第 {currentPage} / {totalPages} 页</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))} className={secondaryButtonClassName()}><ChevronLeft size={16} />上一页</button>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} className={secondaryButtonClassName()}>下一页<ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </section>
  );
}

function RiskPanel() {
  return (
    <section className="rounded-[8px] border border-[#ffbb55] bg-[#fffaf0] p-7 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 text-[20px] font-semibold text-[#1f1f1f]">
        <AlertTriangle className="text-[#fa8c16]" />
        风险提示
      </div>
      <p className="mt-8 text-[16px] leading-9 text-[#1f2937]">重新计算等级属于高影响操作，需要明确影响用户数量并二次确认。</p>
    </section>
  );
}

function ExpRulesPanel({
  expRules,
  selected,
  onCreate,
  onEdit,
  onRemove,
  onRemoveSelected,
  onToggleEnabled,
  deleting,
}: {
  expRules: ExpRuleRecord[];
  selected: ReturnType<typeof useAdminBulkSelection<ExpRuleRecord, string>>;
  onCreate: () => void;
  onEdit: (item: ExpRuleRecord) => void;
  onRemove: (item: ExpRuleRecord) => void;
  onRemoveSelected: () => void;
  onToggleEnabled: (item: ExpRuleRecord, next: boolean) => void;
  deleting: boolean;
}) {
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold text-[#1f1f1f]">经验规则</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onRemoveSelected} disabled={selected.selectedCount === 0 || deleting} className={secondaryButtonClassName()}>批量操作</button>
          <button type="button" onClick={onCreate} className={primaryButtonClassName()}><PlusCircle size={16} />新增规则</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-[8px] border border-[#edf0f5]">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-[#f6f8fb] text-[#344054]">
            <tr>
              <th className="w-12 px-4 py-3 text-left"><AdminBulkCheckbox checked={selected.allVisibleSelected} onChange={selected.toggleAllVisible} label="选择全部经验规则" /></th>
              <th className="px-4 py-3 text-left font-semibold">规则</th>
              <th className="px-4 py-3 text-left font-semibold">经验范围</th>
              <th className="px-4 py-3 text-left font-semibold">最多可获得</th>
              <th className="px-4 py-3 text-left font-semibold">状态</th>
              <th className="px-4 py-3 text-left font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {expRules.map((item) => (
              <tr key={item.key} className="border-t border-[#edf0f5] text-[#344054]">
                <td className="px-4 py-3"><AdminBulkCheckbox checked={selected.isSelected(item.key)} onChange={() => selected.toggleOne(item.key)} label={`选择 ${item.label}`} /></td>
                <td className="px-4 py-3"><div className="font-semibold">{item.label}</div><div className="mt-1 text-xs text-[#667085]">{item.description || item.key}</div></td>
                <td className="px-4 py-3">{item.rangeText}</td>
                <td className="px-4 py-3">{item.maxObtainCount && item.maxObtainCount > 0 ? `${item.maxObtainCount} 次` : "不限制"}</td>
                <td className="px-4 py-3"><button type="button" onClick={() => onToggleEnabled(item, !(item.enabled ?? true))} className={`rounded-[4px] px-2.5 py-1 text-xs font-semibold ${item.enabled === false ? "bg-[#fff7e6] text-[#d46b08]" : "bg-[#e6f8ef] text-[#0f9f5f]"}`}>{item.enabled === false ? "停用" : "启用"}</button></td>
                <td className="px-4 py-3"><div className="flex gap-3"><button type="button" onClick={() => onEdit(item)} className="text-[#1677ff]"><Edit3 size={16} /></button><button type="button" onClick={() => onRemove(item)} className="text-[#cf1322]"><Trash2 size={16} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LogsPanel({
  logs,
  logTotal,
  logUsername,
  setLogUsername,
  bizType,
  setBizType,
  options,
  setLogPage,
  currentPage,
  totalPages,
  onPageChange,
}: {
  logs: ExpLogRecord[];
  logTotal: number;
  logUsername: string;
  setLogUsername: (value: string) => void;
  bizType: string;
  setBizType: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  setLogPage: (page: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold text-[#1f1f1f]">经验日志</h2>
        <span className="text-sm text-[#667085]">共 {logTotal} 条</span>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <input value={logUsername} onChange={(event) => { setLogUsername(event.target.value); setLogPage(1); }} className={inputClassName()} placeholder="用户名" />
        <select value={bizType} onChange={(event) => { setBizType(event.target.value); setLogPage(1); }} className={inputClassName()}>
          <option value="">全部业务</option>
          {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div className="overflow-hidden rounded-[8px] border border-[#edf0f5]">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-[#f6f8fb] text-[#344054]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">用户</th>
              <th className="px-4 py-3 text-left font-semibold">业务</th>
              <th className="px-4 py-3 text-left font-semibold">经验变化</th>
              <th className="px-4 py-3 text-left font-semibold">原因</th>
              <th className="px-4 py-3 text-left font-semibold">时间</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((item) => (
              <tr key={item.id} className="border-t border-[#edf0f5] text-[#344054]">
                <td className="px-4 py-3">{item.user?.username || "-"}</td>
                <td className="px-4 py-3">{formatExperienceBizType(item.bizLabel || item.bizType)}</td>
                <td className={`px-4 py-3 font-semibold ${Number(item.expChange || 0) >= 0 ? "text-[#00a854]" : "text-[#f5222d]"}`}>{Number(item.expChange || 0) >= 0 ? `+${item.expChange || 0}` : item.expChange}</td>
                <td className="px-4 py-3">{item.reason || "-"}</td>
                <td className="px-4 py-3">{formatMaybeDate(item.createTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-[#475467]">
        <span>第 {currentPage} / {totalPages} 页</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))} className={secondaryButtonClassName()}><ChevronLeft size={16} />上一页</button>
          <button type="button" disabled={currentPage >= totalPages} onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} className={secondaryButtonClassName()}>下一页<ChevronRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}

function RequiredField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold text-[#344054]"><span className="text-[#f5222d]">* </span>{label}</div>
      {children}
    </label>
  );
}

function toNullableNumber(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function toLevelIconTone(value: unknown, fallback: LevelIconTone = "blue"): LevelIconTone {
  return levelIconTones.includes(value as LevelIconTone) ? (value as LevelIconTone) : fallback;
}

function formatOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "-";
}

function formatSignedNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value >= 0 ? `+${value}` : String(value);
}

function toneFromLevel(level: unknown): LevelIconTone {
  const numeric = Number(level || 0);
  if (numeric <= 1) return "blue";
  if (numeric === 2) return "green";
  if (numeric === 3) return "orange";
  if (numeric === 4) return "purple";
  if (numeric === 5) return "pink";
  return "blue";
}

function levelIconToneClassName(tone: LevelIconTone) {
  const map: Record<LevelIconTone, string> = {
    slate: "bg-[#eef2f6] text-[#667085]",
    green: "bg-[#e6f8ef] text-[#0f9f5f]",
    orange: "bg-[#fff7e6] text-[#d46b08]",
    purple: "bg-[#f4edff] text-[#722ed1]",
    pink: "bg-[#fff0f6] text-[#eb2f96]",
    blue: "bg-[#e6f4ff] text-[#1677ff]",
  };
  return map[tone];
}

function levelPreviewGradient(tone: LevelIconTone) {
  const map: Record<LevelIconTone, string> = {
    slate: "from-[#667085] to-[#344054]",
    green: "from-[#22c55e] to-[#0f9f5f]",
    orange: "from-[#ffa940] to-[#fa8c16]",
    purple: "from-[#9254de] to-[#531dab]",
    pink: "from-[#ff85c0] to-[#c41d7f]",
    blue: "from-[#2f7dff] to-[#0052d9]",
  };
  return map[tone];
}

function avatarTone(username?: string | null) {
  const key = (username || "").charCodeAt(0) % 4;
  return [
    "bg-[#e6f4ff] text-[#0958d9]",
    "bg-[#e6f8ef] text-[#0f9f5f]",
    "bg-[#f4edff] text-[#722ed1]",
    "bg-[#fff7e6] text-[#d46b08]",
  ][Number.isFinite(key) ? key : 0];
}
