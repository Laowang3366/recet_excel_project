import { useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  LoaderCircle,
  Play,
  Plus,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import { AdminBulkCheckbox, AdminEmptyState, AdminPageShell, AdminPermissionNotice, inputClassName, textareaClassName } from "../admin/shared";
import { hasAdminConsoleAccess } from "../admin/config";
import { api, ApiError } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { adminKeys } from "../lib/query-keys";
import { useSession } from "../lib/session";
import { openAdminConfirm, runAdminBulkDelete } from "./AdminConsoleShared";
import {
  buildAssistantDashboardMetrics,
  buildAssistantConfigTestSignature,
  buildFailureReasonRows,
  buildRawLogDisplayRows,
  buildTestPanelFromResult,
  buildUserDetailMetrics,
  compactUrl,
  formatAverageLatency,
  formatCount,
  getConfigStatusLabel,
  getFailureReasonLabel,
  getPromptModeLabel,
} from "./AdminAssistantViewModel";

type AiAssistantConfigRecord = {
  id: number;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  model: string;
  backupModel?: string;
  maxRetries?: number;
  reasoningEffort?: string;
  timeoutMs?: number;
  timeoutMinutes?: number;
  timeoutSeconds?: number;
  systemPrompt: string;
  promptFileName: string;
  enabled: boolean;
  active: boolean;
  sortOrder: number;
  updateTime?: string;
};

type AiAssistantFailureReason = {
  reason?: string;
  count?: number;
};

type AiAssistantStatsResponse = {
  overview?: {
    totalCalls?: number;
    successCalls?: number;
    failedCalls?: number;
    fallbackCalls?: number;
    activeUsers?: number;
    avgLatencyMs?: number;
  };
  records?: AiAssistantUserStatsRecord[];
  failureReasons?: AiAssistantFailureReason[];
  total?: number;
  current?: number;
  size?: number;
};

type AiAssistantUserStatsRecord = {
  userId?: number | string;
  username?: string | null;
  email?: string | null;
  totalCalls?: number;
  successCalls?: number;
  failedCalls?: number;
  fallbackCalls?: number;
  avgLatencyMs?: number;
  lastCallTime?: string | null;
};

type AiAssistantUserDetailResponse = {
  profile?: {
    userId?: number | string;
    username?: string | null;
    email?: string | null;
    avatar?: string | null;
    level?: number;
    points?: number;
  };
  summary?: {
    totalCalls?: number;
    successCalls?: number;
    failedCalls?: number;
    fallbackCalls?: number;
    avgLatencyMs?: number;
  };
  records?: Array<{
    id?: number | string;
    time?: string | null;
    questionSummary?: string | null;
    model?: string | null;
    latencyMs?: number;
    success?: boolean | number;
    fallbackUsed?: boolean | number;
    errorMessage?: string | null;
    errorReason?: string | null;
  }>;
  failureReasons?: AiAssistantFailureReason[];
  total?: number;
  current?: number;
  size?: number;
};

type AiAssistantTestCallResponse = {
  answer?: string;
  latencyMs?: number;
  model?: string;
  fallbackUsed?: boolean;
};

type AiAssistantRawLogRecord = {
  id?: number | string;
  time?: string | null;
  questionSummary?: string | null;
  requestPreview?: string | null;
  responsePreview?: string | null;
  model?: string | null;
  success?: boolean | number;
  fallbackUsed?: boolean | number;
  errorMessage?: string | null;
};

type AiAssistantRawLogsResponse = {
  records?: AiAssistantRawLogRecord[];
  total?: number;
  current?: number;
  size?: number;
};

type PromptMode = "text" | "file";

type AssistantFormState = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  backupModel: string;
  maxRetries: number;
  reasoningEffort: string;
  timeoutSeconds: number;
  systemPrompt: string;
  promptFileName: string;
  promptMode: PromptMode;
  enabled: boolean;
  active: boolean;
  sortOrder: number;
  testQuestion: string;
};

type TestPanelState = {
  latency: string;
  status: string;
  content: string;
};

const defaultSystemPrompt = `你是 ExcelCC AI 助手，专注于帮助用户解答 Excel 相关问题。
请提供准确、清晰、可操作的解决方案。
优先使用表格或步骤说明。
如需函数，请给出示例和说明。
如需公式，请确保正确性。`;

const defaultForm: AssistantFormState = {
  name: "",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-5.4-mini",
  backupModel: "gpt-5.5",
  maxRetries: 3,
  reasoningEffort: "",
  timeoutSeconds: 30,
  systemPrompt: defaultSystemPrompt,
  promptFileName: "",
  promptMode: "text",
  enabled: true,
  active: true,
  sortOrder: 0,
  testQuestion: "如何在 Excel 中使用 VLOOKUP 函数?",
};

const defaultTestPanel: TestPanelState = {
  latency: "-",
  status: "待测试",
  content: "请在测试面板中发起测试调用，确认 Base URL、模型与 API Key 可用。",
};

export function AdminAssistant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const isAdmin = hasAdminConsoleAccess(user?.role) && user?.role === "admin";
  const promptFileRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AiAssistantConfigRecord | null>(null);
  const [form, setForm] = useState<AssistantFormState>(defaultForm);
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingDefaultPrompt, setLoadingDefaultPrompt] = useState(false);
  const [savingDefaultPrompt, setSavingDefaultPrompt] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [testPanel, setTestPanel] = useState<TestPanelState>(defaultTestPanel);
  const [lastSuccessfulTestSignature, setLastSuccessfulTestSignature] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AiAssistantUserStatsRecord | null>(null);
  const [rawLogsOpen, setRawLogsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const size = 10;

  const statsParams = { page, size };
  const configsQuery = useQuery({
    queryKey: adminKeys.assistantConfigs(),
    enabled: isAdmin,
    queryFn: async () => {
      try {
        return await api.get<{ records: AiAssistantConfigRecord[] }>("/api/admin/assistant/configs", { silent: true });
      } catch (error) {
        handleAdminError(error, navigate);
        return { records: [] };
      }
    },
  });
  const statsQuery = useQuery({
    queryKey: adminKeys.assistantStats(statsParams),
    enabled: isAdmin,
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("size", String(size));
        return await api.get<AiAssistantStatsResponse>(`/api/admin/assistant/stats?${params.toString()}`, { silent: true });
      } catch (error) {
        handleAdminError(error, navigate);
        return { overview: {}, records: [], failureReasons: [], total: 0, current: page, size };
      }
    },
  });
  const selectedUserId = selectedUser?.userId == null ? "" : String(selectedUser.userId);
  const userDetailQuery = useQuery({
    queryKey: ["admin", "assistant", "stats", "users", selectedUserId],
    enabled: isAdmin && Boolean(selectedUserId),
    queryFn: async () => {
      try {
        return await api.get<AiAssistantUserDetailResponse>(`/api/admin/assistant/stats/users/${encodeURIComponent(selectedUserId)}`, { silent: true });
      } catch (error) {
        handleAdminError(error, navigate);
        return { profile: {}, summary: {}, records: [], failureReasons: [], total: 0, current: 1, size: 10 };
      }
    },
  });
  const rawLogsQuery = useQuery({
    queryKey: ["admin", "assistant", "stats", "users", selectedUserId, "raw-logs"],
    enabled: isAdmin && rawLogsOpen && Boolean(selectedUserId),
    queryFn: async () => {
      try {
        return await api.get<AiAssistantRawLogsResponse>(`/api/admin/assistant/stats/users/${encodeURIComponent(selectedUserId)}/raw-logs`, { silent: true });
      } catch (error) {
        handleAdminError(error, navigate);
        return { records: [], total: 0, current: 1, size: 10 };
      }
    },
  });

  const configs = configsQuery.data?.records || [];
  const bulkSelection = useAdminBulkSelection(configs, (item) => item.id);
  const stats = statsQuery.data || {};
  const overview = stats.overview || {};
  const statRecords = stats.records || [];
  const dashboardMetrics = buildAssistantDashboardMetrics(overview);
  const failureRows = buildFailureReasonRows(stats.failureReasons || []);
  const visibleModelOptions = uniqueModels([form.model, form.backupModel, ...modelOptions]);
  const currentTestSignature = () => buildAssistantConfigTestSignature({
    baseUrl: form.baseUrl,
    apiKey: normalizeApiKeyInput(form.apiKey),
    model: form.model,
    backupModel: form.backupModel,
    maxRetries: normalizeRetryCount(form.maxRetries),
    reasoningEffort: form.reasoningEffort,
    timeoutSeconds: normalizeTimeoutSeconds(form.timeoutSeconds),
    systemPrompt: form.systemPrompt,
    promptFileName: form.promptMode === "file" ? form.promptFileName : "",
    promptMode: form.promptMode,
  });

  if (!isAdmin) {
    return (
      <AdminPageShell>
        <AdminPermissionNotice message="仅管理员可配置 AI 助手。" />
      </AdminPageShell>
    );
  }

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.assistantConfigs() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.assistantStats(statsParams) }),
      queryClient.invalidateQueries({ queryKey: ["admin", "assistant", "stats", "users"] }),
    ]);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setApiKeyTouched(false);
    setApiKeyVisible(false);
    setModelOptions([]);
    setTestPanel(defaultTestPanel);
    setLastSuccessfulTestSignature(null);
    setDialogOpen(true);
  };

  const openEdit = (item: AiAssistantConfigRecord) => {
    const promptMode = item.promptFileName ? "file" : "text";
    setEditingItem(item);
    setForm({
      name: item.name || "",
      baseUrl: item.baseUrl || "",
      apiKey: "",
      model: item.model || "",
      backupModel: item.backupModel || "",
      maxRetries: Number(item.maxRetries || 3),
      reasoningEffort: item.reasoningEffort || "",
      timeoutSeconds: Number(item.timeoutSeconds || timeoutMsToSeconds(item.timeoutMs)),
      systemPrompt: item.systemPrompt || "",
      promptFileName: item.promptFileName || "",
      promptMode,
      enabled: Boolean(item.enabled),
      active: Boolean(item.active),
      sortOrder: Number(item.sortOrder || 0),
      testQuestion: defaultForm.testQuestion,
    });
    setApiKeyTouched(false);
    setApiKeyVisible(false);
    setModelOptions(uniqueModels([item.model || "", item.backupModel || ""]));
    setTestPanel(defaultTestPanel);
    setLastSuccessfulTestSignature(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    const normalizedApiKey = normalizeApiKeyInput(form.apiKey);
    if (!form.name.trim() || !form.baseUrl.trim() || !form.model.trim()) {
      toast.error("请填写配置名称、Base URL 和模型名称");
      return;
    }
    if (!editingItem && !normalizedApiKey) {
      toast.error("请填写 API Key");
      return;
    }
    if (lastSuccessfulTestSignature !== currentTestSignature()) {
      toast.error("请先完成测试连接，再保存配置");
      return;
    }
    try {
      const timeoutSeconds = normalizeTimeoutSeconds(form.timeoutSeconds);
      const payload = {
        name: form.name,
        baseUrl: form.baseUrl,
        apiKey: editingItem && !apiKeyTouched ? "" : normalizedApiKey,
        model: form.model,
        backupModel: form.backupModel,
        maxRetries: normalizeRetryCount(form.maxRetries),
        reasoningEffort: form.reasoningEffort,
        timeoutMs: timeoutSecondsToMs(timeoutSeconds),
        systemPrompt: form.systemPrompt,
        promptFileName: form.promptMode === "file" ? form.promptFileName : "",
        enabled: form.enabled,
        active: form.enabled && form.active,
        sortOrder: Number(form.sortOrder || 0),
      };
      if (editingItem?.id) {
        await api.put(`/api/admin/assistant/configs/${editingItem.id}`, payload);
      } else {
        await api.post("/api/admin/assistant/configs", payload);
      }
      setDialogOpen(false);
      await refreshAll();
      toast.success(editingItem ? "AI 助手配置已更新" : "AI 助手配置已创建");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  const openConfigTest = (item: AiAssistantConfigRecord) => {
    openEdit(item);
    setTestPanel({
      latency: "-",
      status: "待测试",
      content: "请在测试面板中发起连接测试，确认 Base URL、模型与 API Key 可用。",
    });
  };

  const deleteConfig = async (item: AiAssistantConfigRecord) => {
    const confirmed = await openAdminConfirm({
      title: "删除 AI 助手配置",
      message: `确认删除 AI 助手配置“${item.name}”？`,
      confirmLabel: "删除",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/api/admin/assistant/configs/${item.id}`);
      await refreshAll();
      toast.success("AI 助手配置已删除");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  const deleteSelectedConfigs = async () => {
    const items = bulkSelection.selectedItems;
    if (items.length === 0 || bulkDeleting) return;
    const confirmed = await openAdminConfirm({
      title: "批量删除 AI 助手配置",
      message: `确认删除选中的 ${items.length} 个 AI 助手配置？`,
      confirmLabel: "删除选中",
      destructive: true,
    });
    if (!confirmed) return;
    setBulkDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/assistant/configs/${item.id}`),
      entityName: "AI 助手配置",
      errorLabel: "批量删除 AI 助手配置",
      onRefresh: refreshAll,
      onFinally: () => {
        bulkSelection.clear();
        setBulkDeleting(false);
      },
    });
  };

  const fetchModels = async () => {
    const normalizedApiKey = normalizeApiKeyInput(form.apiKey);
    setLoadingModels(true);
    try {
      const result = await api.post<{ models: Array<string | { id?: string; name?: string; model?: string }> }>("/api/admin/assistant/models", {
        configId: editingItem?.id,
        baseUrl: form.baseUrl,
        apiKey: normalizedApiKey,
        useSubmittedApiKey: !editingItem || (apiKeyTouched && Boolean(normalizedApiKey)),
      });
      const models = normalizeModelOptions(result.models || []);
      setModelOptions(models);
      if (models.length > 0 && !form.model) {
        setForm((prev) => ({ ...prev, model: models[0] }));
      }
      toast.success(models.length > 0 ? `已获取 ${models.length} 个模型` : "未返回可用模型");
      return models;
    } catch (error) {
      handleAdminError(error, navigate);
      return [];
    } finally {
      setLoadingModels(false);
    }
  };

  const runConnectionTest = async () => {
    const normalizedApiKey = normalizeApiKeyInput(form.apiKey);
    if (!form.testQuestion.trim()) {
      toast.error("请先填写测试问题");
      return;
    }
    const testSignature = currentTestSignature();
    setLoadingModels(true);
    try {
      const result = await api.post<AiAssistantTestCallResponse>("/api/admin/assistant/test-call", {
        configId: editingItem?.id,
        name: form.name,
        baseUrl: form.baseUrl,
        apiKey: normalizedApiKey,
        model: form.model,
        backupModel: form.backupModel,
        maxRetries: normalizeRetryCount(form.maxRetries),
        reasoningEffort: form.reasoningEffort,
        timeoutMs: timeoutSecondsToMs(form.timeoutSeconds),
        systemPrompt: form.systemPrompt,
        promptFileName: form.promptMode === "file" ? form.promptFileName : "",
        testQuestion: form.testQuestion,
      });
      setTestPanel(buildTestPanelFromResult(result));
      setLastSuccessfulTestSignature(testSignature);
      toast.success("测试调用成功");
    } catch (error) {
      setTestPanel({
        latency: "-",
        status: "失败",
        content: error instanceof ApiError ? error.message : "测试调用失败，请检查配置后重试。",
      });
      handleAdminError(error, navigate);
    } finally {
      setLoadingModels(false);
    }
  };

  const loadSystemDefaultPrompt = async () => {
    setLoadingDefaultPrompt(true);
    try {
      const result = await api.get<{ promptFileName?: string; systemPrompt?: string }>("/api/admin/assistant/default-prompt", { silent: true });
      setForm((prev) => ({
        ...prev,
        promptFileName: result.promptFileName || "system-prompt.txt",
        systemPrompt: result.systemPrompt || "",
        promptMode: result.promptFileName ? "file" : "text",
      }));
      toast.success("系统默认 Prompt 已读取");
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoadingDefaultPrompt(false);
    }
  };

  const saveSystemDefaultPrompt = async () => {
    if (!form.systemPrompt.trim()) {
      toast.error("请先填写系统 Prompt 内容");
      return;
    }
    setSavingDefaultPrompt(true);
    try {
      const result = await api.put<{ promptFileName?: string; systemPrompt?: string }>("/api/admin/assistant/default-prompt", {
        promptFileName: form.promptFileName,
        systemPrompt: form.systemPrompt,
      });
      setForm((prev) => ({
        ...prev,
        promptFileName: result.promptFileName || prev.promptFileName || "system-prompt.txt",
        systemPrompt: result.systemPrompt || prev.systemPrompt,
      }));
      toast.success("系统默认 Prompt 已保存");
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setSavingDefaultPrompt(false);
    }
  };

  const loadPromptFile = async (file: File) => {
    const text = await file.text();
    setForm((prev) => ({
      ...prev,
      promptMode: "file",
      promptFileName: file.name,
      systemPrompt: text,
    }));
    toast.success("Prompt 文件已读取");
  };

  return (
    <AdminPageShell
      actions={
        <>
          <button type="button" onClick={openCreate} className={assistantSecondaryButtonClassName()}>
            <RefreshCcw size={16} />
            测试调用
          </button>
          <button type="button" onClick={openCreate} className={assistantPrimaryButtonClassName()}>
            <Plus size={18} />
            新增配置
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Activity} tone="green" label={dashboardMetrics.todayCalls.label} value={dashboardMetrics.todayCalls.value} hint={dashboardMetrics.todayCalls.hint} />
        <MetricCard icon={TrendingUp} tone="orange" label={dashboardMetrics.failureRate.label} value={dashboardMetrics.failureRate.value} hint={dashboardMetrics.failureRate.hint} />
        <MetricCard icon={ShieldCheck} tone="blue" label={dashboardMetrics.fallbackCalls.label} value={dashboardMetrics.fallbackCalls.value} hint={dashboardMetrics.fallbackCalls.hint} />
        <MetricCard icon={Clock3} tone="red" label={dashboardMetrics.averageLatency.label} value={dashboardMetrics.averageLatency.value} hint={dashboardMetrics.averageLatency.hint} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.68fr)_minmax(360px,1fr)]">
        <DesignPanel
          title="模型配置表格"
          actions={
            <>
              <button
                type="button"
                onClick={() => void deleteSelectedConfigs()}
                disabled={bulkSelection.selectedCount === 0 || bulkDeleting}
                className={assistantSecondaryButtonClassName()}
              >
                <FileText size={15} />
                批量操作
                <ChevronDown size={15} />
              </button>
              <button type="button" onClick={() => void refreshAll()} className={assistantSecondaryButtonClassName()}>
                <RefreshCcw size={15} />
                刷新
              </button>
            </>
          }
        >
          {configs.length === 0 ? (
            <AdminEmptyState message="暂无 AI 助手配置。" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <AdminBulkCheckbox checked={bulkSelection.allVisibleSelected} onChange={bulkSelection.toggleAllVisible} label="选择全部 AI 助手配置" />
                    </TableHead>
                    <TableHead>配置</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>模型</TableHead>
                    <TableHead>密钥</TableHead>
                    <TableHead>Prompt</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <AdminBulkCheckbox
                          checked={bulkSelection.isSelected(item.id)}
                          onChange={() => bulkSelection.toggleOne(item.id)}
                          label={`选择 AI 助手配置 ${item.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-[#1d2939]">{item.name}</TableCell>
                      <TableCell className="max-w-[132px] truncate">{compactUrl(item.baseUrl)}</TableCell>
                      <TableCell>{item.model || "-"}</TableCell>
                      <TableCell>{item.apiKeyMasked || (item.hasApiKey ? "sk-***" : "未配置")}</TableCell>
                      <TableCell>{getPromptModeLabel(item.promptFileName, item.systemPrompt)}</TableCell>
                      <TableCell>
                        <span className={assistantStatusClassName(item.enabled, item.active)}>{getConfigStatusLabel(item.enabled, item.active)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-[#1677ff]">
                          <button type="button" onClick={() => openEdit(item)} className="font-semibold hover:text-[#0958d9]">编辑</button>
                          <span className="text-[#98a2b3]">/</span>
                          <button type="button" onClick={() => openConfigTest(item)} disabled={!item.enabled} className="font-semibold hover:text-[#0958d9] disabled:text-[#98a2b3]">测试</button>
                          <span className="text-[#98a2b3]">/</span>
                          <button type="button" onClick={() => void deleteConfig(item)} className="font-semibold text-[#d92d20] hover:text-[#b42318]">删除</button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <CompactPager total={configs.length} current={1} onChange={() => undefined} />
            </>
          )}
        </DesignPanel>

        <div className="grid gap-4">
          <SecurityPanel />
          <FailureReasonPanel rows={failureRows} />
        </div>
      </div>

      <DesignPanel title="用户调用统计">
        {statRecords.length === 0 ? (
          <AdminEmptyState message="暂无 AI 助手调用数据。" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>总调用</TableHead>
                  <TableHead>成功</TableHead>
                  <TableHead>失败</TableHead>
                  <TableHead>兜底</TableHead>
                  <TableHead>最近调用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statRecords.map((item, index) => (
                  <TableRow
                    key={String(item.userId ?? index)}
                    onClick={() => setSelectedUser(item)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserInitial name={item.username || item.email || `U${index + 1}`} index={index} />
                        <span>{item.username || `用户#${item.userId}`}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.email || "-"}</TableCell>
                    <TableCell>{formatCount(item.totalCalls)}</TableCell>
                    <TableCell className="text-[#039855]">{formatCount(item.successCalls)}</TableCell>
                    <TableCell className="text-[#ff2d2d]">{formatCount(item.failedCalls)}</TableCell>
                    <TableCell className="text-[#005bff]">{formatCount(item.fallbackCalls)}</TableCell>
                    <TableCell>{formatRelativeTime(item.lastCallTime)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <CompactPager total={Number(stats.total || 0)} current={page} onChange={setPage} />
          </>
        )}
      </DesignPanel>

      <ConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        editingItem={editingItem}
        apiKeyTouched={apiKeyTouched}
        setApiKeyTouched={setApiKeyTouched}
        apiKeyVisible={apiKeyVisible}
        setApiKeyVisible={setApiKeyVisible}
        modelOptions={visibleModelOptions}
        loadingModels={loadingModels}
        loadingDefaultPrompt={loadingDefaultPrompt}
        savingDefaultPrompt={savingDefaultPrompt}
        promptFileRef={promptFileRef}
        testPanel={testPanel}
        onFetchModels={() => void fetchModels()}
        onRunConnectionTest={() => void runConnectionTest()}
        onLoadDefaultPrompt={() => void loadSystemDefaultPrompt()}
        onSaveDefaultPrompt={() => void saveSystemDefaultPrompt()}
        onLoadPromptFile={loadPromptFile}
        onSubmit={() => void submit()}
      />

      <UserDetailDrawer
        open={Boolean(selectedUser)}
        onOpenChange={(next) => {
          if (!next) {
            setRawLogsOpen(false);
            setSelectedUser(null);
          }
        }}
        selectedUser={selectedUser}
        detail={userDetailQuery.data}
        loading={userDetailQuery.isFetching}
        onViewRawLogs={() => setRawLogsOpen(true)}
      />

      <RawLogsDialog
        open={rawLogsOpen}
        onOpenChange={setRawLogsOpen}
        userLabel={selectedUser?.username || selectedUser?.email || (selectedUser?.userId == null ? "" : `用户#${selectedUser.userId}`)}
        data={rawLogsQuery.data}
        loading={rawLogsQuery.isFetching}
      />
    </AdminPageShell>
  );
}

function MetricCard({ icon: Icon, tone, label, value, hint }: { icon: LucideIcon; tone: "green" | "orange" | "blue" | "red"; label: string; value: string; hint: string }) {
  const toneClass = {
    green: "bg-[#08b05d] shadow-[0_12px_28px_rgba(8,176,93,0.22)]",
    orange: "bg-[#f58b00] shadow-[0_12px_28px_rgba(245,139,0,0.22)]",
    blue: "bg-[#0f66ff] shadow-[0_12px_28px_rgba(15,102,255,0.22)]",
    red: "bg-[#ff1f32] shadow-[0_12px_28px_rgba(255,31,50,0.20)]",
  }[tone];
  const hintClass = tone === "red" ? "text-[#039855]" : tone === "orange" ? "text-[#039855]" : tone === "blue" ? "text-[#005bff]" : "text-[#039855]";
  return (
    <section className="rounded-[8px] border border-[#dfe7f1] bg-white p-6 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-6">
        <div className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-white ${toneClass}`}>
          <Icon size={34} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[#101828]">{label}</div>
          <div className="mt-1 text-[32px] font-semibold leading-none text-black">{value}</div>
          <div className={`mt-2 text-[15px] font-semibold ${hintClass}`}>{hint}</div>
        </div>
      </div>
    </section>
  );
}

function DesignPanel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#dfe7f1] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
      <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold leading-none text-[#101828]">{title}</h2>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function SecurityPanel() {
  const items = ["API Key 永不明文显示", "保存前必须测试连接", "Prompt 支持文本或文件", "支持主模型和备用模型"];
  return (
    <DesignPanel title="配置安全">
      <div className="space-y-3 py-1">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-3 text-[15px] font-medium text-[#344054]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#13b26b] text-white">
              <CheckCircle2 size={14} />
            </span>
            {item}
          </div>
        ))}
      </div>
    </DesignPanel>
  );
}

function FailureReasonPanel({ rows }: { rows: ReturnType<typeof buildFailureReasonRows> }) {
  return (
    <DesignPanel
      title="失败原因分析"
      actions={<button type="button" className="text-sm font-semibold text-[#005bff] hover:text-[#0040b8]">查看详情</button>}
    >
      <div className="space-y-4 py-1">
        {rows.map((row) => (
          <FailureReasonBar key={row.key} label={row.label} count={row.count} percent={row.percent} tone={row.key} />
        ))}
      </div>
    </DesignPanel>
  );
}

function FailureReasonBar({ label, count, percent, tone }: { label: string; count: number; percent: number; tone: string }) {
  const color = tone === "timeout" ? "#ff1f32" : tone === "rate_limit" ? "#ff8a00" : tone === "auth" ? "#12b76a" : "#f7b500";
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)_28px] items-center gap-3 text-sm font-medium text-[#344054]">
      <div className="flex items-center gap-2">
        <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ color }}>
          <CircleAlert size={16} />
        </span>
        {label}
      </div>
      <div className="h-1.5 rounded-full bg-[#e8edf3]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }} />
      </div>
      <div className="text-right text-[#101828]">{count}</div>
    </div>
  );
}

function ConfigDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editingItem,
  apiKeyTouched,
  setApiKeyTouched,
  apiKeyVisible,
  setApiKeyVisible,
  modelOptions,
  loadingModels,
  loadingDefaultPrompt,
  savingDefaultPrompt,
  promptFileRef,
  testPanel,
  onFetchModels,
  onRunConnectionTest,
  onLoadDefaultPrompt,
  onSaveDefaultPrompt,
  onLoadPromptFile,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  form: AssistantFormState;
  setForm: React.Dispatch<React.SetStateAction<AssistantFormState>>;
  editingItem: AiAssistantConfigRecord | null;
  apiKeyTouched: boolean;
  setApiKeyTouched: (next: boolean) => void;
  apiKeyVisible: boolean;
  setApiKeyVisible: (next: boolean) => void;
  modelOptions: string[];
  loadingModels: boolean;
  loadingDefaultPrompt: boolean;
  savingDefaultPrompt: boolean;
  promptFileRef: React.RefObject<HTMLInputElement>;
  testPanel: TestPanelState;
  onFetchModels: () => void;
  onRunConnectionTest: () => void;
  onLoadDefaultPrompt: () => void;
  onSaveDefaultPrompt: () => void;
  onLoadPromptFile: (file: File) => Promise<void>;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-h-[92vh] w-[min(1060px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-[8px] border border-[#dfe7f1] bg-white p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#dfe7f1] px-9 py-5">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[22px] font-semibold text-[#101828]">AI 助手配置</DialogTitle>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="关闭" className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[#344054] hover:bg-[#f2f4f7]">
              <X size={20} />
            </button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-9 py-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="配置名称" required>
                  <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClassName()} placeholder="生产主配置" />
                </Field>
                <Field label="Base URL" required>
                  <input value={form.baseUrl} onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))} className={inputClassName()} placeholder="https://api.openai.com/v1" />
                </Field>
                <Field label="模型名称" required>
                  <ModelInput value={form.model} options={modelOptions} onChange={(model) => setForm((prev) => ({ ...prev, model }))} />
                </Field>
                <Field label="API Key" required>
                  <div className="relative">
                    <input
                      type={apiKeyVisible ? "text" : "password"}
                      value={form.apiKey}
                      name={editingItem ? `assistant-api-key-${editingItem.id}` : "assistant-api-key-new"}
                      autoComplete="new-password"
                      spellCheck={false}
                      onChange={(event) => {
                        setApiKeyTouched(true);
                        setForm((prev) => ({ ...prev, apiKey: event.target.value }));
                      }}
                      className={`${inputClassName()} pr-10`}
                      placeholder={editingItem?.hasApiKey && !apiKeyTouched ? editingItem.apiKeyMasked || "已配置" : "sk-********************************"}
                    />
                    <button type="button" onClick={() => setApiKeyVisible(!apiKeyVisible)} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[4px] text-[#667085] hover:bg-[#f2f4f7]">
                      {apiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>
                <Field label="备用模型">
                  <ModelInput value={form.backupModel} options={modelOptions} onChange={(backupModel) => setForm((prev) => ({ ...prev, backupModel }))} />
                </Field>
                <Field label="超时时间（秒）" required>
                  <input
                    type="number"
                    min={1}
                    max={3600}
                    step={1}
                    value={form.timeoutSeconds}
                    onChange={(event) => setForm((prev) => ({ ...prev, timeoutSeconds: Number(event.target.value || 0) }))}
                    className={inputClassName()}
                  />
                </Field>
                <Field label="最大重试次数" required>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={1}
                    value={form.maxRetries}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxRetries: Number(event.target.value || 0) }))}
                    className={inputClassName()}
                  />
                </Field>
                <div className="flex items-end">
                  <div className="flex h-10 items-center gap-3">
                    <Switch
                      checked={form.enabled}
                      onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next, active: next ? prev.active : false }))}
                      className="data-[state=checked]:!bg-[#0f66ff]"
                    />
                    <span className="text-sm font-semibold text-[#344054]">启用</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[20px] font-semibold text-[#101828]">Prompt 配置</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={onLoadDefaultPrompt} disabled={loadingDefaultPrompt} className={assistantMiniToolButtonClassName()}>
                      {loadingDefaultPrompt ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                      读取默认
                    </button>
                    <button type="button" onClick={onSaveDefaultPrompt} disabled={savingDefaultPrompt} className={assistantMiniToolButtonClassName()}>
                      {savingDefaultPrompt ? <LoaderCircle size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                      保存默认
                    </button>
                    <button type="button" onClick={onFetchModels} disabled={loadingModels} className={assistantMiniToolButtonClassName()}>
                      {loadingModels ? <LoaderCircle size={14} className="animate-spin" /> : <Bot size={14} />}
                      获取模型
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="默认 Prompt">
                    <select value={form.promptMode} onChange={(event) => setForm((prev) => ({ ...prev, promptMode: event.target.value as PromptMode }))} className={inputClassName()}>
                      <option value="text">文本配置</option>
                      <option value="file">文件配置</option>
                    </select>
                  </Field>
                  <Field label="上传 Prompt 文件">
                    <div className="flex min-h-10 items-center gap-3">
                      <button type="button" onClick={() => promptFileRef.current?.click()} className={assistantSecondaryButtonClassName()}>
                        选择文件
                      </button>
                      <span className="min-w-0 truncate text-sm text-[#475467]">{form.promptFileName || "未选择任何文件"}</span>
                      <input
                        ref={promptFileRef}
                        type="file"
                        accept=".txt,.md,.prompt"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void onLoadPromptFile(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </Field>
                </div>
              </div>

              <Field label="直接编辑系统 Prompt">
                <div className="relative">
                  <textarea
                    value={form.systemPrompt}
                    onChange={(event) => setForm((prev) => ({ ...prev, systemPrompt: event.target.value }))}
                    className={`${textareaClassName()} min-h-[124px] resize-none pr-20`}
                    placeholder="留空则使用系统默认 Prompt"
                  />
                  <span className="absolute bottom-2 right-3 text-xs text-[#667085]">{form.systemPrompt.length}/2000</span>
                </div>
              </Field>

              <div className="flex items-center gap-3 rounded-[4px] border border-[#ffd591] bg-[#fff7e6] px-4 py-3 text-sm font-medium text-[#d46b08]">
                <Info size={18} />
                API Key 不会明文展示，保存前必须测试连接。
              </div>
            </div>

            <aside className="border-l border-[#e8edf3] pl-6">
              <h3 className="text-[20px] font-semibold text-[#101828]">测试面板</h3>
              <Field label="测试问题">
                <div className="relative">
                  <textarea
                    value={form.testQuestion}
                    onChange={(event) => setForm((prev) => ({ ...prev, testQuestion: event.target.value }))}
                    className={`${textareaClassName()} min-h-[68px] resize-none pr-9`}
                  />
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, testQuestion: "" }))} className="absolute right-2 top-2 text-[#667085] hover:text-[#101828]">
                    <X size={16} />
                  </button>
                </div>
              </Field>
              <button type="button" onClick={onRunConnectionTest} disabled={loadingModels} className={`${assistantPrimaryButtonClassName()} mt-3`}>
                {loadingModels ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} />}
                测试调用
              </button>
              <div className="mt-5 grid grid-cols-2 gap-5 text-sm">
                <div>
                  <div className="font-semibold text-[#344054]">返回耗时</div>
                  <div className="mt-2 text-[16px] font-semibold text-[#039855]">{testPanel.latency}</div>
                </div>
                <div>
                  <div className="font-semibold text-[#344054]">状态</div>
                  <div className={`mt-2 inline-flex rounded-[4px] px-3 py-1 text-sm font-semibold ${testPanel.status === "成功" ? "bg-[#dff7ea] text-[#039855]" : "bg-[#eef2f6] text-[#475467]"}`}>{testPanel.status}</div>
                </div>
              </div>
              <Field label="返回内容预览">
                <div className="min-h-[290px] rounded-[4px] border border-[#d0d5dd] bg-[#fbfcfe] p-3 text-sm leading-6 text-[#344054]">
                  {testPanel.content}
                </div>
              </Field>
            </aside>
          </div>
        </div>
        <DialogFooter className="border-t border-[#dfe7f1] px-9 py-5">
          <button type="button" onClick={() => onOpenChange(false)} className={assistantSecondaryButtonClassName()}>取消</button>
          <button type="button" onClick={onRunConnectionTest} disabled={loadingModels} className={assistantSecondaryButtonClassName()}>测试连接</button>
          <button type="button" onClick={onSubmit} className={assistantPrimaryButtonClassName()}>
            <CheckCircle2 size={16} />
            保存配置
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDetailDrawer({
  open,
  onOpenChange,
  selectedUser,
  detail,
  loading,
  onViewRawLogs,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  selectedUser: AiAssistantUserStatsRecord | null;
  detail?: AiAssistantUserDetailResponse;
  loading: boolean;
  onViewRawLogs: () => void;
}) {
  const profile = detail?.profile || {};
  const summary = detail?.summary || selectedUser || {};
  const metrics = buildUserDetailMetrics(summary);
  const failureRows = buildFailureReasonRows(detail?.failureReasons || []);
  const records = detail?.records || [];
  const username = profile.username || selectedUser?.username || `用户#${selectedUser?.userId || "-"}`;
  const email = profile.email || selectedUser?.email || "-";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="fixed bottom-0 left-auto right-0 top-0 flex h-screen max-h-screen w-[min(600px,100vw)] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-l border-[#dfe7f1] bg-white p-0 sm:max-w-none">
        <DialogHeader className="px-7 py-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[22px] font-semibold text-[#101828]">用户调用详情</DialogTitle>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="关闭" className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[#101828] hover:bg-[#f2f4f7]">
              <X size={21} />
            </button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5">
          <section className="rounded-[6px] border border-[#dfe7f1] bg-white p-5">
            <div className="flex items-center gap-7">
              <div className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-[#dbeafe] text-[28px] font-semibold text-[#005bff]">
                {String(username).slice(0, 1).toUpperCase()}
              </div>
              <div className="grid flex-1 gap-2 text-[15px] text-[#101828] sm:grid-cols-[90px_minmax(0,1fr)]">
                <div className="font-semibold text-[#344054]">用户名：</div>
                <div className="font-semibold">{username}</div>
                <div className="font-semibold text-[#344054]">邮箱：</div>
                <div>{email}</div>
                <div className="font-semibold text-[#344054]">等级：</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-[#c084fc] px-3 py-0.5 text-sm font-semibold text-[#7c3aed]">Lv.{Number(profile.level || 1)}</span>
                  <span>当前积分： <strong>{formatCount(profile.points)}</strong></span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <UserMetricCard label={metrics.total.label} value={metrics.total.value} />
            <UserMetricCard label={metrics.success.label} value={metrics.success.value} sub={metrics.success.rate} tone="green" />
            <UserMetricCard label={metrics.failed.label} value={metrics.failed.value} sub={metrics.failed.rate} tone="red" />
            <UserMetricCard label={metrics.fallback.label} value={metrics.fallback.value} sub={metrics.fallback.rate} tone="blue" />
            <UserMetricCard label={metrics.averageLatency.label} value={metrics.averageLatency.value} />
          </div>

          <section className="rounded-[6px] border border-[#dfe7f1] bg-white">
            <h3 className="px-4 py-3 text-[17px] font-semibold text-[#101828]">最近调用记录</h3>
            {loading ? (
              <div className="px-4 py-8 text-sm text-[#667085]">加载中...</div>
            ) : records.length === 0 ? (
              <div className="px-4 py-8 text-sm text-[#667085]">暂无明细记录</div>
            ) : (
              <Table className="table-fixed text-xs">
                <colgroup>
                  <col className="w-[118px]" />
                  <col className="w-[150px]" />
                  <col className="w-[86px]" />
                  <col className="w-[50px]" />
                  <col className="w-[52px]" />
                  <col className="w-[58px]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 px-2 text-xs">时间</TableHead>
                    <TableHead className="h-9 px-2 text-xs">问题摘要</TableHead>
                    <TableHead className="h-9 px-2 text-xs">模型</TableHead>
                    <TableHead className="h-9 px-2 text-xs">耗时</TableHead>
                    <TableHead className="h-9 px-2 text-xs">状态</TableHead>
                    <TableHead className="h-9 px-2 text-xs">错误原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, index) => (
                    <TableRow key={String(record.id ?? index)}>
                      <TableCell className="truncate px-2 py-2 text-xs">{formatTime(record.time)}</TableCell>
                      <TableCell className="truncate px-2 py-2 text-xs">{record.questionSummary || "-"}</TableCell>
                      <TableCell className="truncate px-2 py-2 text-xs">{record.model || "-"}</TableCell>
                      <TableCell className="px-2 py-2 text-xs">{formatAverageLatency(record.latencyMs)}</TableCell>
                      <TableCell className="px-2 py-2 text-xs">
                        <span className={record.success ? "rounded-[4px] bg-[#dff7ea] px-1.5 py-0.5 text-xs font-semibold text-[#039855]" : "rounded-[4px] bg-[#ffe4e8] px-1.5 py-0.5 text-xs font-semibold text-[#d92d20]"}>
                          {record.success ? "成功" : "失败"}
                        </span>
                      </TableCell>
                      <TableCell className="truncate px-2 py-2 text-xs">{record.success ? "-" : getFailureReasonLabel(record.errorReason || record.errorMessage)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <DesignPanel title="失败原因分析" actions={<Info size={16} className="text-[#667085]" />}>
            <div className="space-y-4 py-1">
              {failureRows.map((row) => (
                <div key={row.key} className="grid grid-cols-[86px_minmax(0,1fr)_72px] items-center gap-3 text-sm font-medium text-[#344054]">
                  <div>{row.label}</div>
                  <div className="h-1.5 rounded-full bg-[#e8edf3]">
                    <div className="h-full rounded-full bg-[#ff1f32]" style={{ width: `${Math.min(100, row.percent)}%` }} />
                  </div>
                  <div className="text-right text-[#101828]">{row.count}（{row.percentText}）</div>
                </div>
              ))}
            </div>
          </DesignPanel>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[#dfe7f1] px-6 py-5">
          <button type="button" onClick={() => exportUserRecords(username, records)} className={assistantSecondaryButtonClassName()}>
            <Download size={16} />
            导出记录
          </button>
          <button type="button" onClick={onViewRawLogs} className={assistantPrimaryButtonClassName()}>
            查看原始日志
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RawLogsDialog({
  open,
  onOpenChange,
  userLabel,
  data,
  loading,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  userLabel: string;
  data?: AiAssistantRawLogsResponse;
  loading: boolean;
}) {
  const rows = buildRawLogDisplayRows(data?.records || []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="fixed left-1/2 top-1/2 flex max-h-[86vh] w-[min(820px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-[6px] border border-[#dfe7f1] bg-white p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#dfe7f1] px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-[22px] font-semibold text-[#101828]">原始日志</DialogTitle>
              <div className="mt-1 text-sm text-[#667085]">{userLabel || "用户"} · 共 {formatCount(data?.total ?? rows.length)} 条</div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="关闭" className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[#101828] hover:bg-[#f2f4f7]">
              <X size={21} />
            </button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-[#667085]">
              <LoaderCircle size={18} className="animate-spin" />
              加载原始日志...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#d0d5dd] text-sm text-[#667085]">
              <FileText size={28} />
              暂无原始日志
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => (
                <article key={String(row.id)} className="rounded-[6px] border border-[#dfe7f1] bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf2f7] px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#101828]">{row.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#667085]">
                        <span>{formatTime(row.time)}</span>
                        <span>模型：{row.model}</span>
                        {row.fallbackUsed ? <span className="font-semibold text-[#0f66ff]">已兜底</span> : null}
                      </div>
                    </div>
                    <span className={row.success ? "rounded-[4px] bg-[#dff7ea] px-2.5 py-1 text-xs font-semibold text-[#039855]" : "rounded-[4px] bg-[#ffe4e8] px-2.5 py-1 text-xs font-semibold text-[#d92d20]"}>
                      {row.success ? "成功" : "失败"}
                    </span>
                  </div>
                  {!row.success && row.errorMessage !== "-" ? (
                    <div className="border-b border-[#edf2f7] px-4 py-2 text-sm text-[#d92d20]">错误：{row.errorMessage}</div>
                  ) : null}
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    <RawLogPreview title="请求预览" value={row.requestPreview} />
                    <RawLogPreview title="响应预览" value={row.responsePreview} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-[#dfe7f1] px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className={assistantSecondaryButtonClassName()}>关闭</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RawLogPreview({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-[#344054]">{title}</div>
      <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-[4px] border border-[#d0d5dd] bg-[#fbfcfe] p-3 text-xs leading-5 text-[#344054]">{value}</pre>
    </div>
  );
}

function UserMetricCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "green" | "red" | "blue" }) {
  const subClass = tone === "green" ? "text-[#039855]" : tone === "red" ? "text-[#ff2d2d]" : "text-[#005bff]";
  return (
    <div className="rounded-[6px] border border-[#dfe7f1] bg-white p-4 text-center">
      <div className="text-sm font-medium text-[#344054]">{label}</div>
      <div className="mt-3 text-[24px] font-semibold leading-none text-black">{value}</div>
      {sub ? <div className={`mt-2 text-sm font-semibold ${subClass}`}>{sub}</div> : null}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[#344054]">
        {label}
        {required ? <span className="ml-1 text-[#ff2d2d]">*</span> : null}
      </div>
      {children}
    </label>
  );
}

function ModelInput({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  if (options.length > 0) {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName()}>
        <option value="">请选择模型</option>
        {options.map((model) => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>
    );
  }
  return <input value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName()} placeholder="gpt-5.4-mini" />;
}

function CompactPager({ total, current, onChange }: { total: number; current: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[#344054]">
      <div className="flex items-center gap-5">
        <span>共 {total} 条</span>
        <button type="button" className="inline-flex h-9 items-center gap-3 rounded-[4px] border border-[#d0d5dd] bg-white px-4">
          10 条/页
          <ChevronDown size={15} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(1, current - 1))} disabled={current <= 1} className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#dfe7f1] text-[#667085] disabled:opacity-40">
          <ChevronLeft size={16} />
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#0f66ff] text-sm font-semibold text-white">{current}</span>
        <button type="button" onClick={() => onChange(Math.min(pages, current + 1))} disabled={current >= pages} className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#dfe7f1] text-[#667085] disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
        <span className="ml-5">前往</span>
        <input value={current} readOnly className="h-8 w-14 rounded-[4px] border border-[#d0d5dd] text-center" />
        <span>页</span>
      </div>
    </div>
  );
}

function UserInitial({ name, index }: { name: string; index: number }) {
  const colors = ["bg-[#0f66ff]", "bg-[#12b76a]", "bg-[#7a5af8]", "bg-[#ff8a00]"];
  return (
    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-white ${colors[index % colors.length]}`}>
      {String(name || "U").slice(0, 1).toUpperCase()}
    </span>
  );
}

function assistantPrimaryButtonClassName() {
  return "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[4px] bg-[#0f66ff] px-5 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(15,102,255,0.20)] transition hover:bg-[#0052d9] disabled:cursor-not-allowed disabled:opacity-60";
}

function assistantSecondaryButtonClassName() {
  return "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[4px] border border-[#d0d5dd] bg-white px-4 text-sm font-semibold text-[#344054] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#4096ff] hover:text-[#0f66ff] disabled:cursor-not-allowed disabled:opacity-50";
}

function assistantMiniToolButtonClassName() {
  return "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold text-[#344054] transition hover:border-[#4096ff] hover:text-[#0f66ff] disabled:cursor-not-allowed disabled:opacity-50";
}

function assistantStatusClassName(enabled?: boolean, active?: boolean) {
  if (active) return "rounded-[4px] bg-[#dff7ea] px-3 py-1 text-sm font-semibold text-[#039855]";
  if (enabled) return "rounded-[4px] bg-[#fff4db] px-3 py-1 text-sm font-semibold text-[#d46b08]";
  return "rounded-[4px] bg-[#eef2f6] px-3 py-1 text-sm font-semibold text-[#475467]";
}

function formatTime(value: unknown) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 19);
}

function formatRelativeTime(value: unknown) {
  if (!value) return "-";
  const text = String(value).replace("T", " ");
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 16);
  const diffMs = Date.now() - date.getTime();
  if (diffMs >= 0 && diffMs < 60_000) return "刚刚";
  return text.slice(5, 16);
}

export function timeoutMsToMinutes(value: unknown) {
  const timeoutMs = Number(value || 60000);
  const minutes = Math.ceil(Math.max(1000, timeoutMs) / 60000);
  return normalizeTimeoutMinutes(minutes);
}

export function timeoutMinutesToMs(value: unknown) {
  return normalizeTimeoutMinutes(value) * 60 * 1000;
}

function timeoutMsToSeconds(value: unknown) {
  const timeoutMs = Number(value || 30000);
  if (!Number.isFinite(timeoutMs)) return 30;
  return normalizeTimeoutSeconds(Math.ceil(timeoutMs / 1000));
}

function timeoutSecondsToMs(value: unknown) {
  return normalizeTimeoutSeconds(value) * 1000;
}

function normalizeTimeoutMinutes(value: unknown) {
  const minutes = Number(value || 1);
  if (!Number.isFinite(minutes)) return 1;
  return Math.min(60, Math.max(1, Math.round(minutes)));
}

function normalizeTimeoutSeconds(value: unknown) {
  const seconds = Number(value || 30);
  if (!Number.isFinite(seconds)) return 30;
  return Math.min(3600, Math.max(1, Math.round(seconds)));
}

function normalizeRetryCount(value: unknown) {
  const count = Number(value || 0);
  if (!Number.isFinite(count)) return 0;
  return Math.min(10, Math.max(0, Math.round(count)));
}

export function formatTimeoutMs(value: unknown) {
  return `${timeoutMsToMinutes(value)} 分钟`;
}

function normalizeApiKeyInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("****") || /^[*•●]+$/.test(trimmed)) {
    return "";
  }
  return trimmed;
}

function normalizeModelOptions(models: Array<string | { id?: string; name?: string; model?: string }>) {
  return uniqueModels(models.map((item) => {
    if (typeof item === "string") return item;
    return item.id || item.name || item.model || "";
  }));
}

function uniqueModels(models: string[]) {
  return Array.from(new Set(models.map((item) => item.trim()).filter(Boolean)));
}

function exportUserRecords(username: string | null | undefined, records: NonNullable<AiAssistantUserDetailResponse["records"]>) {
  if (!records || records.length === 0) {
    toast.info("暂无可导出的调用记录");
    return;
  }
  const header = ["时间", "问题摘要", "模型", "耗时", "状态", "错误原因"];
  const lines = records.map((record) => [
    formatTime(record.time),
    record.questionSummary || "",
    record.model || "",
    formatAverageLatency(record.latencyMs),
    record.success ? "成功" : "失败",
    record.success ? "" : getFailureReasonLabel(record.errorReason || record.errorMessage),
  ]);
  const csv = [header, ...lines].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${username || "assistant-user"}-调用记录.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function handleAdminError(error: unknown, navigate: ReturnType<typeof useNavigate>) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      navigate(buildCurrentAuthRedirectPath());
      return;
    }
    if (error.status === 403) {
      navigate("/admin/overview");
      return;
    }
    toast.error(error.message || "后台请求失败");
    return;
  }
  toast.error("后台请求失败");
}
