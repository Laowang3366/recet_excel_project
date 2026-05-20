import { useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Edit3, LoaderCircle, Power, RefreshCcw, Save, Trash2, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  AddButton,
  AdminEmptyState,
  AdminPageShell,
  AdminPagination,
  AdminPermissionNotice,
  AdminSection,
  AdminStatCard,
  AdminStatGrid,
  FilterBar,
  FilterField,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  statusBadgeClassName,
  textareaClassName,
} from "../admin/shared";
import { hasAdminConsoleAccess } from "../admin/config";
import { api, ApiError } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { adminKeys } from "../lib/query-keys";
import { useSession } from "../lib/session";

type AiAssistantConfigRecord = {
  id: number;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  model: string;
  reasoningEffort?: string;
  timeoutMs?: number;
  timeoutMinutes?: number;
  systemPrompt: string;
  promptFileName: string;
  enabled: boolean;
  active: boolean;
  sortOrder: number;
  updateTime?: string;
};

type AiAssistantStatsResponse = {
  overview?: {
    totalCalls?: number;
    successCalls?: number;
    failedCalls?: number;
    activeUsers?: number;
  };
  records?: Array<{
    userId?: number | string;
    username?: string | null;
    email?: string | null;
    totalCalls?: number;
    successCalls?: number;
    failedCalls?: number;
    fallbackCalls?: number;
    lastCallTime?: string | null;
  }>;
  total?: number;
  current?: number;
  size?: number;
};

const defaultForm = {
  name: "",
  baseUrl: "",
  apiKey: "",
  model: "",
  reasoningEffort: "",
  timeoutMinutes: 1,
  systemPrompt: "",
  promptFileName: "",
  enabled: true,
  active: false,
  sortOrder: 0,
};

const reasoningEffortOptions = [
  { value: "", label: "默认（不发送）" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

export function AdminAssistant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const isAdmin = hasAdminConsoleAccess(user?.role) && user?.role === "admin";
  const promptFileRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AiAssistantConfigRecord | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingDefaultPrompt, setLoadingDefaultPrompt] = useState(false);
  const [savingDefaultPrompt, setSavingDefaultPrompt] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const size = 10;

  const statsParams = { page, size, keyword: keyword.trim(), startDate, endDate };
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
        if (keyword.trim()) params.set("keyword", keyword.trim());
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        return await api.get<AiAssistantStatsResponse>(`/api/admin/assistant/stats?${params.toString()}`, { silent: true });
      } catch (error) {
        handleAdminError(error, navigate);
        return { overview: {}, records: [], total: 0, current: page, size };
      }
    },
  });

  const configs = configsQuery.data?.records || [];
  const stats = statsQuery.data || {};
  const overview = stats.overview || {};
  const statRecords = stats.records || [];
  const visibleModelOptions = uniqueModels([form.model, ...modelOptions]);

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
    ]);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setApiKeyTouched(false);
    setModelOptions([]);
    setDialogOpen(true);
  };

  const openEdit = (item: AiAssistantConfigRecord) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      baseUrl: item.baseUrl || "",
      apiKey: "",
      model: item.model || "",
      reasoningEffort: item.reasoningEffort || "",
      timeoutMinutes: Number(item.timeoutMinutes || timeoutMsToMinutes(item.timeoutMs)),
      systemPrompt: item.systemPrompt || "",
      promptFileName: item.promptFileName || "",
      enabled: Boolean(item.enabled),
      active: Boolean(item.active),
      sortOrder: Number(item.sortOrder || 0),
    });
    setApiKeyTouched(false);
    setModelOptions(item.model ? [item.model] : []);
    setDialogOpen(true);
  };

  const submit = async () => {
    const normalizedApiKey = normalizeApiKeyInput(form.apiKey);
    if (!form.name.trim() || !form.baseUrl.trim() || !form.model.trim()) {
      toast.error("请填写配置名称、URL 和模型");
      return;
    }
    if (!editingItem && !normalizedApiKey) {
      toast.error("请填写 SK 密钥");
      return;
    }
    try {
      const timeoutMinutes = normalizeTimeoutMinutes(form.timeoutMinutes);
      const payload = {
        ...form,
        sortOrder: Number(form.sortOrder || 0),
        timeoutMinutes,
        timeoutMs: timeoutMinutesToMs(timeoutMinutes),
        apiKey: editingItem && !apiKeyTouched ? "" : normalizedApiKey,
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

  const activateConfig = async (item: AiAssistantConfigRecord) => {
    try {
      await api.put(`/api/admin/assistant/configs/${item.id}/activate`, {});
      await refreshAll();
      toast.success("AI 助手配置已生效");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  const deleteConfig = async (item: AiAssistantConfigRecord) => {
    if (!window.confirm(`确认删除 AI 助手配置“${item.name}”？`)) {
      return;
    }
    try {
      await api.delete(`/api/admin/assistant/configs/${item.id}`);
      await refreshAll();
      toast.success("AI 助手配置已删除");
    } catch (error) {
      handleAdminError(error, navigate);
    }
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
    } catch (error) {
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
      }));
      toast.success("系统默认 prompt 已读取");
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoadingDefaultPrompt(false);
    }
  };

  const saveSystemDefaultPrompt = async () => {
    if (!form.systemPrompt.trim()) {
      toast.error("请先填写 system prompt 内容");
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
      toast.success("系统默认 prompt 已保存");
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
      promptFileName: file.name,
      systemPrompt: text,
    }));
    toast.success("system prompt 文件已读取");
  };

  return (
    <AdminPageShell>
      <AdminSection
        title="AI 助手配置"
        actions={
          <>
            <button type="button" onClick={() => void refreshAll()} className={secondaryButtonClassName()}>
              <RefreshCcw size={15} />
              刷新
            </button>
            <AddButton onClick={openCreate}>新增配置</AddButton>
          </>
        }
      >
        {configs.length === 0 ? (
          <AdminEmptyState message="暂无 AI 助手配置。" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>配置</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>密钥</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-semibold text-[#262626]">{item.name}</div>
                    <div className="mt-1 text-xs text-[#8c8c8c]">排序 {item.sortOrder || 0}</div>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">{item.baseUrl}</TableCell>
                  <TableCell>
                    <div>{item.model || "-"}</div>
                    <div className="mt-1 text-xs text-[#8c8c8c]">推理：{formatReasoningEffort(item.reasoningEffort)}</div>
                    <div className="mt-1 text-xs text-[#8c8c8c]">超时：{formatTimeoutMs(item.timeoutMs)}</div>
                  </TableCell>
                  <TableCell>{item.apiKeyMasked || (item.hasApiKey ? "已配置" : "未配置")}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{item.promptFileName || (item.systemPrompt ? "文本配置" : "默认")}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={statusBadgeClassName(item.enabled ? "active" : "deleted")}>{item.enabled ? "启用" : "停用"}</span>
                      {item.active ? <span className={statusBadgeClassName("approved")}>生效中</span> : null}
                    </div>
                  </TableCell>
                  <TableCell>{formatTime(item.updateTime)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void activateConfig(item)} disabled={!item.enabled || item.active} className={secondaryButtonClassName()}>
                        <Power size={14} />
                        生效
                      </button>
                      <button type="button" onClick={() => openEdit(item)} className={secondaryButtonClassName()}>
                        <Edit3 size={14} />
                        编辑
                      </button>
                      <button type="button" onClick={() => void deleteConfig(item)} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[2px] border border-rose-200 bg-white px-3 text-sm text-rose-600 transition hover:border-rose-300 hover:bg-rose-50">
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminSection>

      <AdminStatGrid>
        <AdminStatCard label="调用总数" value={formatNumber(overview.totalCalls)} />
        <AdminStatCard label="成功调用" value={formatNumber(overview.successCalls)} />
        <AdminStatCard label="失败调用" value={formatNumber(overview.failedCalls)} />
        <AdminStatCard label="使用用户" value={formatNumber(overview.activeUsers)} />
      </AdminStatGrid>

      <AdminSection title="用户调用统计">
        <FilterBar>
          <FilterField label="用户">
            <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="用户名 / 邮箱" className={inputClassName()} />
          </FilterField>
          <FilterField label="开始日期">
            <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className={inputClassName()} />
          </FilterField>
          <FilterField label="结束日期">
            <input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className={inputClassName()} />
          </FilterField>
        </FilterBar>

        <div className="mt-5">
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
                  {statRecords.map((item) => (
                    <TableRow key={String(item.userId)}>
                      <TableCell>{item.username || `用户#${item.userId}`}</TableCell>
                      <TableCell>{item.email || "-"}</TableCell>
                      <TableCell>{formatNumber(item.totalCalls)}</TableCell>
                      <TableCell>{formatNumber(item.successCalls)}</TableCell>
                      <TableCell>{formatNumber(item.failedCalls)}</TableCell>
                      <TableCell>{formatNumber(item.fallbackCalls)}</TableCell>
                      <TableCell>{formatTime(item.lastCallTime)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4">
                <AdminPagination current={page} size={size} total={Number(stats.total || 0)} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      </AdminSection>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingItem ? "编辑 AI 助手配置" : "新增 AI 助手配置"}
        description="配置会应用到前台 AI 助手；同一时间只有一个配置处于生效状态。"
        submitLabel={editingItem ? "保存配置" : "创建配置"}
        onSubmit={submit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="配置名称">
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClassName()} placeholder="生产 OpenAI 兼容接口" />
          </Field>
          <Field label="URL">
            <input value={form.baseUrl} onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))} className={inputClassName()} placeholder="https://api.example.com/v1" />
          </Field>
          <Field label="SK 密钥">
            <input
              type="password"
              value={form.apiKey}
              name={editingItem ? `assistant-api-key-${editingItem.id}` : "assistant-api-key-new"}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => {
                setApiKeyTouched(true);
                setForm((prev) => ({ ...prev, apiKey: event.target.value }));
              }}
              className={inputClassName()}
              placeholder={editingItem?.hasApiKey ? `留空保留 ${editingItem.apiKeyMasked}` : "sk-..."}
            />
          </Field>
          <Field label="模型">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              {modelOptions.length > 0 ? (
                <select
                  value={form.model}
                  onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                  className={inputClassName()}
                >
                  <option value="">请选择模型</option>
                  {visibleModelOptions.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.model}
                  onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                  className={inputClassName()}
                  placeholder="gpt-4.1-mini"
                />
              )}
              <button type="button" onClick={() => void fetchModels()} disabled={loadingModels} className={secondaryButtonClassName()}>
                {loadingModels ? <LoaderCircle size={15} className="animate-spin" /> : <Bot size={15} />}
                获取模型
              </button>
            </div>
          </Field>
          <Field label="推理等级">
            <select
              value={form.reasoningEffort}
              onChange={(event) => setForm((prev) => ({ ...prev, reasoningEffort: event.target.value }))}
              className={inputClassName()}
            >
              {reasoningEffortOptions.map((option) => (
                <option key={option.value || "default"} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="模型超时（分钟）">
            <input
              type="number"
              min={1}
              max={60}
              step={1}
              value={form.timeoutMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, timeoutMinutes: Number(event.target.value || 0) }))}
              className={inputClassName()}
            />
          </Field>
          <Field label="排序">
            <input type="number" value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value || 0) }))} className={inputClassName()} />
          </Field>
          <div className="flex items-end">
            <div className="grid w-full gap-2 sm:grid-cols-2">
              <AdminFormSwitch label="启用" checked={form.enabled} onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next, active: next ? prev.active : false }))} />
              <AdminFormSwitch label="保存后生效" checked={form.active} onCheckedChange={(next) => setForm((prev) => ({ ...prev, active: next, enabled: next ? true : prev.enabled }))} />
            </div>
          </div>
        </div>

        <Field label="system prompt 文件">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <input value={form.promptFileName} onChange={(event) => setForm((prev) => ({ ...prev, promptFileName: event.target.value }))} className={inputClassName()} placeholder="system-prompt.txt" />
            <button type="button" onClick={() => void loadSystemDefaultPrompt()} disabled={loadingDefaultPrompt} className={secondaryButtonClassName()}>
              {loadingDefaultPrompt ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
              读取默认
            </button>
            <button type="button" onClick={() => void saveSystemDefaultPrompt()} disabled={savingDefaultPrompt} className={secondaryButtonClassName()}>
              {savingDefaultPrompt ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
              保存默认
            </button>
            <button type="button" onClick={() => promptFileRef.current?.click()} className={secondaryButtonClassName()}>
              <UploadCloud size={15} />
              读取本地
            </button>
            <input
              ref={promptFileRef}
              type="file"
              accept=".txt,.md,.prompt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadPromptFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </Field>

        <Field label="system prompt 内容">
          <textarea
            value={form.systemPrompt}
            onChange={(event) => setForm((prev) => ({ ...prev, systemPrompt: event.target.value }))}
            className={`${textareaClassName()} min-h-[220px]`}
            placeholder="留空则使用系统默认 prompt"
          />
        </Field>
      </FormDialog>
    </AdminPageShell>
  );
}

function AdminFormSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex h-9 items-center justify-between rounded-[2px] border border-[#d9d9d9] bg-white px-3 text-sm text-[#595959]">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: () => Promise<void> | void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#f0f0f0] px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">{children}</div>
        </div>
        <DialogFooter className="border-t border-[#f0f0f0] bg-white px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>
            取消
          </button>
          <button type="button" onClick={() => void onSubmit()} className={primaryButtonClassName()}>
            <CheckCircle2 size={15} />
            {submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold text-[#595959]">{label}</div>
      {children}
    </label>
  );
}

function formatNumber(value: unknown) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatTime(value: unknown) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

function formatReasoningEffort(value: unknown) {
  const normalized = String(value || "").trim();
  return reasoningEffortOptions.find((item) => item.value === normalized)?.label || "默认";
}

export function timeoutMsToMinutes(value: unknown) {
  const timeoutMs = Number(value || 60000);
  const minutes = Math.ceil(Math.max(60000, timeoutMs) / 60000);
  return normalizeTimeoutMinutes(minutes);
}

export function timeoutMinutesToMs(value: unknown) {
  return normalizeTimeoutMinutes(value) * 60 * 1000;
}

function normalizeTimeoutMinutes(value: unknown) {
  const minutes = Number(value || 1);
  if (!Number.isFinite(minutes)) return 1;
  return Math.min(60, Math.max(1, Math.round(minutes)));
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
