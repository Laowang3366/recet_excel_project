import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { api } from "./api";
import {
  getFormulaExplainTaskSnapshot,
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
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.info).mockClear();
    vi.mocked(toast.error).mockClear();
    resetFormulaExplainTask();
  });

  it("keeps the request alive after subscribers unmount and notifies when complete", async () => {
    let resolveResponse: (value: FormulaExplainResponse) => void = () => undefined;
    vi.spyOn(api, "post").mockReturnValue(new Promise<FormulaExplainResponse>((resolve) => {
      resolveResponse = resolve;
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
    const seenStatuses: string[] = [];

    const unsubscribe = subscribeFormulaExplainTask(() => {
      seenStatuses.push(getFormulaExplainTaskSnapshot().status);
    });
    const taskPromise = startFormulaExplainTask(request);
    unsubscribe();

    expect(getFormulaExplainTaskSnapshot().status).toBe("pending");
    resolveResponse(response);
    await expect(taskPromise).resolves.toEqual(response);

    expect(api.post).toHaveBeenCalledWith("/api/tools/formula/explain", request, { silent: true });
    expect(seenStatuses).toContain("pending");
    expect(getFormulaExplainTaskSnapshot()).toMatchObject({
      status: "success",
      result: response,
      request,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "公式解释完成",
      expect.objectContaining({
        description: "结果已保留，可回到实用工具查看。",
      }),
    );
  });
});
