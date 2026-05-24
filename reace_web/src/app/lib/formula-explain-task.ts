import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api, ApiError } from "./api";
import type { FormulaExplainRequest, FormulaExplainResponse } from "./formula-explainer";

type FormulaExplainTaskStatus = "idle" | "pending" | "success" | "error";

export const FORMULA_EXPLAIN_TASK_OPEN_EVENT = "excel-formula-explain-open-result";
const FORMULA_EXPLAIN_TASK_STORAGE_KEY = "excel-formula-explain-task-id";
const FORMULA_EXPLAIN_POLL_INTERVAL_MS = 1500;

export type FormulaExplainTaskSnapshot = {
  status: FormulaExplainTaskStatus;
  taskId?: string;
  request?: FormulaExplainRequest;
  result?: FormulaExplainResponse;
  errorMessage?: string;
  startedAt?: number;
  finishedAt?: number;
};

type FormulaExplainServerTask = {
  taskId: string;
  status: "pending" | "success" | "error";
  request?: FormulaExplainRequest;
  result?: FormulaExplainResponse;
  errorMessage?: string;
  createTime?: string | null;
  updateTime?: string | null;
};

const idleSnapshot: FormulaExplainTaskSnapshot = { status: "idle" };
const listeners = new Set<() => void>();

let snapshot = idleSnapshot;
let activePromise: Promise<FormulaExplainResponse> | null = null;
let activeTaskId = 0;
let lastNotifiedTaskId: string | null = null;

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
  removeStoredTaskId();
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
    .post<FormulaExplainServerTask>("/api/tools/formula/explain/tasks", request, { silent: true })
    .then((serverTask) => {
      if (activeTaskId === taskId) {
        persistStoredTaskId(serverTask.taskId);
        setSnapshot({
          status: normalizeServerTaskStatus(serverTask.status),
          taskId: serverTask.taskId,
          request: serverTask.request || request,
          result: serverTask.result,
          errorMessage: serverTask.errorMessage,
          startedAt,
        });
      }
      return pollFormulaExplainTask(serverTask.taskId, taskId, request, startedAt);
    })
    .then((result) => {
      if (activeTaskId === taskId) {
        setSnapshot({
          status: "success",
          taskId: snapshot.taskId,
          request,
          result,
          startedAt,
          finishedAt: Date.now(),
        });
        showFormulaExplainSuccessToast(snapshot.taskId);
      }
      return result;
    })
    .catch((error: unknown) => {
      const message = resolveFormulaExplainErrorMessage(error);
      if (activeTaskId === taskId) {
        setSnapshot({
          status: "error",
          taskId: snapshot.taskId,
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

export function hydrateFormulaExplainTask() {
  if (activePromise && snapshot.status === "pending") {
    return activePromise;
  }
  const taskId = getStoredTaskId();
  if (!taskId) {
    return null;
  }

  const localTaskId = activeTaskId + 1;
  activeTaskId = localTaskId;
  const startedAt = Date.now();
  activePromise = pollFormulaExplainTask(taskId, localTaskId, snapshot.request, startedAt)
    .finally(() => {
      if (activeTaskId === localTaskId) {
        activePromise = null;
      }
    });
  return activePromise;
}

function setSnapshot(nextSnapshot: FormulaExplainTaskSnapshot) {
  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener());
}

async function pollFormulaExplainTask(
  taskId: string,
  localTaskId: number,
  fallbackRequest: FormulaExplainRequest | undefined,
  startedAt: number,
) {
  let task = await getFormulaExplainServerTask(taskId);
  while (task.status === "pending") {
    if (activeTaskId === localTaskId) {
      persistStoredTaskId(task.taskId);
      setSnapshot({
        status: "pending",
        taskId: task.taskId,
        request: task.request || fallbackRequest,
        startedAt,
      });
    }
    await delay(FORMULA_EXPLAIN_POLL_INTERVAL_MS);
    task = await getFormulaExplainServerTask(taskId);
  }

  if (task.status === "success" && task.result) {
    if (activeTaskId === localTaskId) {
      persistStoredTaskId(task.taskId);
      setSnapshot({
        status: "success",
        taskId: task.taskId,
        request: task.request || fallbackRequest,
        result: task.result,
        startedAt,
        finishedAt: Date.now(),
      });
      showFormulaExplainSuccessToast(task.taskId);
    }
    return task.result;
  }

  throw new Error(task.errorMessage || "公式解释失败，请稍后重试");
}

function getFormulaExplainServerTask(taskId: string) {
  return api.get<FormulaExplainServerTask>(`/api/tools/formula/explain/tasks/${encodeURIComponent(taskId)}`, {
    silent: true,
  });
}

function normalizeServerTaskStatus(status: FormulaExplainServerTask["status"]): FormulaExplainTaskStatus {
  if (status === "success" || status === "error") return status;
  return "pending";
}

function showFormulaExplainSuccessToast(taskId?: string) {
  if (taskId && lastNotifiedTaskId === taskId) return;
  lastNotifiedTaskId = taskId || null;
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

function getStoredTaskId() {
  return getStorage()?.getItem(FORMULA_EXPLAIN_TASK_STORAGE_KEY) || null;
}

function persistStoredTaskId(taskId: string | undefined) {
  if (!taskId) return;
  getStorage()?.setItem(FORMULA_EXPLAIN_TASK_STORAGE_KEY, taskId);
}

function removeStoredTaskId() {
  getStorage()?.removeItem(FORMULA_EXPLAIN_TASK_STORAGE_KEY);
}

function getStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
