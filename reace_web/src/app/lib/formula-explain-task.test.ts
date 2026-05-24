import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { api } from "./api";
import {
  getFormulaExplainTaskSnapshot,
  hydrateFormulaExplainTask,
  resetFormulaExplainTask,
  startFormulaExplainTask,
  subscribeFormulaExplainTask,
} from "./formula-explain-task";
import type { FormulaExplainRequest, FormulaExplainResponse } from "./formula-explainer";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

describe("formula explain background task", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
    });
    localStorage.clear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.info).mockClear();
    vi.mocked(toast.error).mockClear();
    resetFormulaExplainTask();
  });

  it("keeps the request alive after subscribers unmount and notifies when complete", async () => {
    let resolveStart: (value: { taskId: string; status: "pending"; request: FormulaExplainRequest }) => void = () => undefined;
    vi.spyOn(api, "post").mockReturnValue(new Promise((resolve) => {
      resolveStart = resolve;
    }));
    const request: FormulaExplainRequest = {
      formula: "=SUM(A1:A10)",
      locale: "zh-CN",
      detailLevel: "standard",
    };
    const response: FormulaExplainResponse = {
      formula: request.formula,
      normalizedFormula: "SUM(A1:A10)",
      summary: "求和。",
      segments: [],
      functions: [],
      warnings: [],
      suggestions: [],
    };
    vi.spyOn(api, "get").mockResolvedValue({
      taskId: "task-1",
      status: "success",
      request,
      result: response,
    });
    const seenStatuses: string[] = [];

    const unsubscribe = subscribeFormulaExplainTask(() => {
      seenStatuses.push(getFormulaExplainTaskSnapshot().status);
    });
    const taskPromise = startFormulaExplainTask(request);
    unsubscribe();

    expect(getFormulaExplainTaskSnapshot().status).toBe("pending");
    resolveStart({
      taskId: "task-1",
      status: "pending",
      request,
    });
    await expect(taskPromise).resolves.toEqual(response);

    expect(api.post).toHaveBeenCalledWith("/api/tools/formula/explain/tasks", request, { silent: true });
    expect(api.get).toHaveBeenCalledWith("/api/tools/formula/explain/tasks/task-1", { silent: true });
    expect(seenStatuses).toContain("pending");
    expect(getFormulaExplainTaskSnapshot()).toMatchObject({
      status: "success",
      taskId: "task-1",
      result: response,
      request,
    });
    expect(localStorage.getItem("excel-formula-explain-task-id")).toBe("task-1");
    expect(toast.success).toHaveBeenCalledWith(
      "公式解释完成",
      expect.objectContaining({
        description: "结果已保留，可回到实用工具查看。",
      }),
    );
  });

  it("hydrates a pending server task after page reload and notifies when polling completes", async () => {
    vi.useFakeTimers();
    localStorage.setItem("excel-formula-explain-task-id", "task-2");
    const request: FormulaExplainRequest = {
      formula: "=LET(x,1,x)",
      locale: "zh-CN",
      detailLevel: "standard",
    };
    const response: FormulaExplainResponse = {
      formula: request.formula,
      normalizedFormula: "LET(x,1,x)",
      summary: "定义 x 后返回 x。",
      segments: [],
      functions: [],
      warnings: [],
      suggestions: [],
    };
    vi.spyOn(api, "get")
      .mockResolvedValueOnce({
        taskId: "task-2",
        status: "pending",
        request,
      })
      .mockResolvedValueOnce({
        taskId: "task-2",
        status: "success",
        request,
        result: response,
      });

    const hydratePromise = hydrateFormulaExplainTask();
    await Promise.resolve();

    expect(getFormulaExplainTaskSnapshot()).toMatchObject({
      status: "pending",
      taskId: "task-2",
      request,
    });
    await vi.advanceTimersByTimeAsync(1500);
    await expect(hydratePromise).resolves.toEqual(response);

    expect(api.get).toHaveBeenNthCalledWith(1, "/api/tools/formula/explain/tasks/task-2", { silent: true });
    expect(api.get).toHaveBeenNthCalledWith(2, "/api/tools/formula/explain/tasks/task-2", { silent: true });
    expect(getFormulaExplainTaskSnapshot()).toMatchObject({
      status: "success",
      taskId: "task-2",
      result: response,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "公式解释完成",
      expect.objectContaining({
        description: "结果已保留，可回到实用工具查看。",
      }),
    );
  });
});
