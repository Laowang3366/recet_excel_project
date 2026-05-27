export type AssistantOverviewInput = {
  totalCalls?: number;
  successCalls?: number;
  failedCalls?: number;
  fallbackCalls?: number;
  avgLatencyMs?: number;
};

export type AssistantFailureReasonInput = {
  reason?: string;
  count?: number;
};

export type AssistantTestCallResultInput = {
  answer?: string | null;
  latencyMs?: number | null;
  model?: string | null;
  fallbackUsed?: boolean | null;
};

export type AssistantRawLogInput = {
  id?: number | string;
  time?: string | null;
  questionSummary?: string | null;
  requestPreview?: string | null;
  responsePreview?: string | null;
  model?: string | null;
  success?: boolean | number | null;
  fallbackUsed?: boolean | number | null;
  errorMessage?: string | null;
};

export type AssistantConfigTestSignatureInput = {
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
  backupModel?: string | null;
  maxRetries?: number | string | null;
  reasoningEffort?: string | null;
  timeoutSeconds?: number | string | null;
  systemPrompt?: string | null;
  promptFileName?: string | null;
  promptMode?: string | null;
};

export function buildAssistantDashboardMetrics(overview: AssistantOverviewInput) {
  return {
    todayCalls: {
      label: "今日调用",
      value: formatCount(overview.totalCalls),
      hint: `成功 ${formatCount(overview.successCalls)}`,
    },
    failureRate: {
      label: "失败率",
      value: formatFailureRate(overview.failedCalls, overview.totalCalls),
      hint: Number(overview.failedCalls || 0) > 0 ? "需关注" : "较低",
    },
    fallbackCalls: {
      label: "兜底次数",
      value: formatCount(overview.fallbackCalls),
      hint: Number(overview.fallbackCalls || 0) > 0 ? "备用模型" : "无兜底",
    },
    averageLatency: {
      label: "平均响应",
      value: formatAverageLatency(overview.avgLatencyMs),
      hint: getLatencyHint(overview.avgLatencyMs),
    },
  };
}

export function buildUserDetailMetrics(summary: AssistantOverviewInput) {
  return {
    total: {
      label: "总调用",
      value: formatCount(summary.totalCalls),
    },
    success: {
      label: "成功",
      value: formatCount(summary.successCalls),
      rate: formatRatio(summary.successCalls, summary.totalCalls),
    },
    failed: {
      label: "失败",
      value: formatCount(summary.failedCalls),
      rate: formatRatio(summary.failedCalls, summary.totalCalls),
    },
    fallback: {
      label: "兜底",
      value: formatCount(summary.fallbackCalls),
      rate: formatRatio(summary.fallbackCalls, summary.totalCalls),
    },
    averageLatency: {
      label: "平均耗时",
      value: formatAverageLatency(summary.avgLatencyMs),
    },
  };
}

export function buildFailureReasonRows(reasons: AssistantFailureReasonInput[], totalFailures?: number) {
  const fallbackTotal = reasons.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const denominator = Math.max(0, Number(totalFailures ?? fallbackTotal));
  const rows = reasons.map((item) => {
    const count = Math.max(0, Number(item.count || 0));
    return {
      key: normalizeFailureReason(item.reason),
      label: getFailureReasonLabel(item.reason),
      count,
      percent: denominator > 0 ? (count / denominator) * 100 : 0,
      percentText: denominator > 0 ? `${formatPercent((count / denominator) * 100)}` : "0%",
    };
  });
  return rows.length > 0 ? rows : [
    { key: "timeout", label: "超时", count: 0, percent: 0, percentText: "0%" },
    { key: "rate_limit", label: "限流", count: 0, percent: 0, percentText: "0%" },
    { key: "auth", label: "认证", count: 0, percent: 0, percentText: "0%" },
  ];
}

export function buildTestPanelFromResult(result: AssistantTestCallResultInput) {
  const answer = String(result.answer || "").trim() || "测试调用成功，但模型未返回可展示内容。";
  const modelLine = result.model ? `\n\n模型：${result.model}` : "";
  const fallbackLine = result.fallbackUsed ? "\n兜底：已使用备用模型" : "";
  return {
    latency: formatAverageLatency(result.latencyMs),
    status: "成功",
    content: `${answer}${modelLine}${fallbackLine}`,
  };
}

export function buildRawLogDisplayRows(records: AssistantRawLogInput[]) {
  return records.map((record, index) => ({
    id: record.id ?? index,
    time: record.time || "-",
    title: String(record.questionSummary || "").trim() || `调用日志 #${record.id ?? index + 1}`,
    model: String(record.model || "").trim() || "-",
    success: record.success === true || record.success === 1,
    fallbackUsed: record.fallbackUsed === true || record.fallbackUsed === 1,
    errorMessage: String(record.errorMessage || "").trim() || "-",
    requestPreview: String(record.requestPreview || "").trim() || "暂无请求预览",
    responsePreview: String(record.responsePreview || "").trim() || "暂无响应预览",
  }));
}

export function buildAssistantConfigTestSignature(input: AssistantConfigTestSignatureInput) {
  return JSON.stringify({
    baseUrl: normalizeSignatureText(input.baseUrl),
    apiKey: normalizeSignatureText(input.apiKey),
    model: normalizeSignatureText(input.model),
    backupModel: normalizeSignatureText(input.backupModel),
    maxRetries: Number(input.maxRetries || 0),
    reasoningEffort: normalizeSignatureText(input.reasoningEffort).toLowerCase(),
    timeoutSeconds: Number(input.timeoutSeconds || 0),
    systemPrompt: normalizeSignatureText(input.systemPrompt),
    promptFileName: normalizeSignatureText(input.promptFileName),
    promptMode: normalizeSignatureText(input.promptMode),
  });
}

export function formatFailureRate(failedCalls: unknown, totalCalls: unknown) {
  return formatRatio(failedCalls, totalCalls);
}

export function formatAverageLatency(value: unknown) {
  const latencyMs = Number(value);
  if (!Number.isFinite(latencyMs) || latencyMs <= 0) return "-";
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

export function formatCount(value: unknown) {
  return Number(value || 0).toLocaleString("zh-CN");
}

export function formatRatio(part: unknown, total: unknown) {
  const denominator = Number(total || 0);
  const numerator = Number(part || 0);
  if (!Number.isFinite(denominator) || denominator <= 0 || !Number.isFinite(numerator)) {
    return "0%";
  }
  return formatPercent((numerator / denominator) * 100);
}

export function compactUrl(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > 14 ? `${text.slice(0, 11)}...` : text;
}

export function getPromptModeLabel(promptFileName?: string | null, systemPrompt?: string | null) {
  if (promptFileName && promptFileName.trim()) return "文件配置";
  if (systemPrompt && systemPrompt.trim()) return "文本配置";
  return "默认配置";
}

export function getConfigStatusLabel(enabled?: boolean, active?: boolean) {
  if (active) return "启用";
  if (enabled) return "备用";
  return "草稿";
}

export function normalizeFailureReason(reason: unknown) {
  const value = String(reason || "").trim().toLowerCase();
  if (value === "rate" || value === "rate_limit" || value === "limit") return "rate_limit";
  if (value === "authentication" || value === "auth_error") return "auth";
  if (value === "model_error") return "model";
  if (value === "timeout" || value === "auth" || value === "model" || value === "other") return value;
  return "other";
}

export function getFailureReasonLabel(reason: unknown) {
  const labels: Record<string, string> = {
    timeout: "超时",
    rate_limit: "限流",
    auth: "认证",
    model: "模型错误",
    other: "其他",
  };
  return labels[normalizeFailureReason(reason)] || "其他";
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}%`;
}

function normalizeSignatureText(value: unknown) {
  return String(value || "").trim();
}

function getLatencyHint(value: unknown) {
  const latencyMs = Number(value);
  if (!Number.isFinite(latencyMs) || latencyMs <= 0) return "待统计";
  return latencyMs <= 3000 ? "可接受" : "偏慢";
}
