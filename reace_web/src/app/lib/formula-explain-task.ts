import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api, ApiError } from "./api";
import type { FormulaExplainRequest, FormulaExplainResponse } from "./formula-explainer";

type FormulaExplainTaskStatus = "idle" | "pending" | "success" | "error";

export const FORMULA_EXPLAIN_TASK_OPEN_EVENT = "excel-formula-explain-open-result";

export type FormulaExplainTaskSnapshot = {
  status: FormulaExplainTaskStatus;
  request?: FormulaExplainRequest;
  result?: FormulaExplainResponse;
  errorMessage?: string;
  startedAt?: number;
  finishedAt?: number;
};

const idleSnapshot: FormulaExplainTaskSnapshot = { status: "idle" };
const listeners = new Set<() => void>();

let snapshot = idleSnapshot;
let activePromise: Promise<FormulaExplainResponse> | null = null;
let activeTaskId = 0;

export function getFormulaExplainTaskSnapshot() {
  return snapshot;
}

export function subscribeFormulaExplainTask(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFormulaExplainTask() {
  return useSyncExternalStore(
    subscribeFormulaExplainTask,
    getFormulaExplainTaskSnapshot,
    getFormulaExplainTaskSnapshot,
  );
}

export function resetFormulaExplainTask() {
  if (snapshot.status === "pending") return;
  setSnapshot(idleSnapshot);
}

export function startFormulaExplainTask(request: FormulaExplainRequest) {
  if (activePromise && snapshot.status === "pending") {
    return activePromise;
  }

  const taskId = activeTaskId + 1;
  activeTaskId = taskId;
  const startedAt = Date.now();
  setSnapshot({ status: "pending", request, startedAt });

  activePromise = api
    .post<FormulaExplainResponse>("/api/tools/formula/explain", request, { silent: true })
    .then((result) => {
      if (activeTaskId === taskId) {
        setSnapshot({
          status: "success",
          request,
          result,
          startedAt,
          finishedAt: Date.now(),
        });
        toast.success("公式解释完成", {
          description: "结果已保留，可回到实用工具查看。",
          action: {
            label: "查看结果",
            onClick: () => {
              window.dispatchEvent(new CustomEvent(FORMULA_EXPLAIN_TASK_OPEN_EVENT));
            },
          },
        });
      }
      return result;
    })
    .catch((error: unknown) => {
      const message = resolveFormulaExplainErrorMessage(error);
      if (activeTaskId === taskId) {
        setSnapshot({
          status: "error",
          request,
          errorMessage: message,
          startedAt,
          finishedAt: Date.now(),
        });
        showFormulaExplainErrorToast(error, message);
      }
      throw error;
    })
    .finally(() => {
      if (activeTaskId === taskId) {
        activePromise = null;
      }
    });

  return activePromise;
}

function setSnapshot(nextSnapshot: FormulaExplainTaskSnapshot) {
  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener());
}

function resolveFormulaExplainErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "公式解释失败，请稍后重试";
}

function showFormulaExplainErrorToast(error: unknown, message: string) {
  if (error instanceof ApiError && error.status === 401) {
    toast.info("请先登录后继续操作");
    return;
  }
  if (error instanceof ApiError && error.status === 402) {
    toast.info(message || "积分不足，请获取积分后再使用公式解释器");
    return;
  }
  if (error instanceof ApiError && error.status === 400) {
    toast.info(message || "公式或上下文格式不正确，请检查后重试");
    return;
  }
  toast.error(message || "公式解释失败，请稍后重试");
}
