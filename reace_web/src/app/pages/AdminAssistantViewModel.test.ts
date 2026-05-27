import { describe, expect, it } from "vitest";
import {
  buildAssistantDashboardMetrics,
  buildAssistantConfigTestSignature,
  buildFailureReasonRows,
  buildFailureReasonDetailSummary,
  buildRawLogDisplayRows,
  buildTestPanelFromResult,
  buildUserDetailMetrics,
  formatAverageLatency,
  formatFailureRate,
} from "./AdminAssistantViewModel";

describe("admin assistant view model", () => {
  it("maps overview numbers to the dashboard cards shown in the design", () => {
    const metrics = buildAssistantDashboardMetrics({
      totalCalls: 286,
      successCalls: 282,
      failedCalls: 4,
      fallbackCalls: 3,
      avgLatencyMs: 2800,
    });

    expect(metrics.todayCalls.value).toBe("286");
    expect(metrics.todayCalls.hint).toBe("成功 282");
    expect(metrics.failureRate.value).toBe("1.4%");
    expect(metrics.fallbackCalls.value).toBe("3");
    expect(metrics.averageLatency.value).toBe("2.8s");
  });

  it("normalizes failure reasons with counts and percentages", () => {
    const rows = buildFailureReasonRows([
      { reason: "timeout", count: 2 },
      { reason: "rate_limit", count: 1 },
      { reason: "auth", count: 0 },
    ]);

    expect(rows.map((row) => `${row.label}:${row.count}:${row.percentText}`)).toEqual([
      "超时:2:66.67%",
      "限流:1:33.33%",
      "认证:0:0%",
    ]);
  });

  it("formats user detail metrics consistently", () => {
    const metrics = buildUserDetailMetrics({
      totalCalls: 62,
      successCalls: 61,
      failedCalls: 1,
      fallbackCalls: 0,
      avgLatencyMs: 2800,
    });

    expect(metrics.success.rate).toBe("98.39%");
    expect(metrics.failed.rate).toBe("1.61%");
    expect(metrics.fallback.rate).toBe("0%");
    expect(metrics.averageLatency.value).toBe("2.8s");
  });

  it("guards empty and invalid rate inputs", () => {
    expect(formatFailureRate(0, 0)).toBe("0%");
    expect(formatFailureRate(1, 0)).toBe("0%");
    expect(formatAverageLatency(undefined)).toBe("-");
  });

  it("maps a real admin test-call response into the test panel", () => {
    const panel = buildTestPanelFromResult({
      answer: "VLOOKUP 会按首列查找。",
      latencyMs: 1230,
      model: "gpt-5.4-mini",
      fallbackUsed: false,
    });

    expect(panel.latency).toBe("1.2s");
    expect(panel.status).toBe("成功");
    expect(panel.content).toContain("VLOOKUP 会按首列查找。");
    expect(panel.content).toContain("模型：gpt-5.4-mini");
  });

  it("keeps raw log previews readable when payload fields are empty", () => {
    const rows = buildRawLogDisplayRows([
      { id: 1, questionSummary: "如何使用 VLOOKUP？", requestPreview: "", responsePreview: null },
    ]);

    expect(rows[0].title).toBe("如何使用 VLOOKUP？");
    expect(rows[0].requestPreview).toBe("暂无请求预览");
    expect(rows[0].responsePreview).toBe("暂无响应预览");
  });

  it("detects whether the current config still matches the last successful test", () => {
    const baseline = buildAssistantConfigTestSignature({
      baseUrl: " https://api.openai.com/v1 ",
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      backupModel: "gpt-5.5",
      maxRetries: 3,
      timeoutMinutes: 1,
      systemPrompt: "prompt",
      promptMode: "text",
    });

    expect(buildAssistantConfigTestSignature({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
      backupModel: "gpt-5.5",
      maxRetries: 3,
      timeoutMinutes: 1,
      systemPrompt: "prompt",
      promptMode: "text",
    })).toBe(baseline);
    expect(buildAssistantConfigTestSignature({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-5.5",
      maxRetries: 3,
      timeoutMinutes: 1,
      systemPrompt: "prompt",
      promptMode: "text",
    })).not.toBe(baseline);
  });

  it("summarizes failure detail rows for the detail dialog", () => {
    const rows = buildFailureReasonRows([
      { reason: "timeout", count: 2 },
      { reason: "rate_limit", count: 1 },
    ]);

    expect(buildFailureReasonDetailSummary(rows)).toEqual({
      totalFailures: 3,
      primaryReason: "超时",
      primaryCount: 2,
    });
  });
});
