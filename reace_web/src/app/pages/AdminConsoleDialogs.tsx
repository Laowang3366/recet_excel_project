import { Component, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../lib/api";
import { getDefaultAdminPath } from "../admin/config";
import { inputClassName, primaryButtonClassName, secondaryButtonClassName } from "../admin/shared";
import type { AdminConfirmRequest, AdminDialogController, AdminDialogRequest, AdminPromptRequest } from "./AdminConsoleTypes";

let adminDialogController: AdminDialogController | null = null;

export async function adminRequest<T>(
  promise: Promise<T>,
  navigate: ReturnType<typeof useNavigate>,
  role: string | null,
  actionLabel?: string,
) {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        showAdminError("登录已过期，请重新登录");
        navigate("/auth", { replace: true });
        return null;
      }
      if (error.status === 403) {
        showAdminError("当前账号无权限执行该操作");
        navigate(getDefaultAdminPath(role), { replace: true });
        return null;
      }
      showAdminError(actionLabel ? `${actionLabel}失败：${error.message || "操作失败"}` : error.message || "操作失败");
      return null;
    }
    showAdminError(actionLabel ? `${actionLabel}失败：系统异常，请稍后重试` : "系统异常，请稍后重试");
    return null;
  }
}

export type ExcelEditorErrorBoundaryProps = {
  resetKey: string;
  fallback: ReactNode;
  children: ReactNode;
};

export class ExcelEditorErrorBoundary extends Component<ExcelEditorErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: ExcelEditorErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function AdminDialogHost() {
  const [request, setRequest] = useState<AdminDialogRequest | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const controller: AdminDialogController = {
    showFeedback: (feedback) => {
      setRequest(feedback);
    },
    openConfirm: (options) => new Promise<boolean>((resolve) => {
      setRequest({ kind: "confirm", ...options, resolve });
    }),
    openPrompt: (options) => new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue ?? "");
      setRequest({ kind: "prompt", ...options, resolve });
    }),
  };

  adminDialogController = controller;

  useEffect(() => {
    return () => {
      if (adminDialogController === controller) {
        adminDialogController = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!request || request.kind !== "feedback") return;
    if (request.type === "error" && request.durationMs === undefined) return;

    const timeoutId = window.setTimeout(() => {
      setRequest((current) => current === request ? null : current);
    }, request.durationMs ?? 2000);

    return () => window.clearTimeout(timeoutId);
  }, [request]);

  const dismiss = () => {
    if (!request) return;
    if (request.kind === "confirm") {
      request.resolve(false);
    } else if (request.kind === "prompt") {
      request.resolve(null);
    }
    setRequest(null);
  };

  const confirm = () => {
    if (!request) return;
    if (request.kind === "confirm") {
      request.resolve(true);
      setRequest(null);
      return;
    }
    if (request.kind === "prompt") {
      if (request.required && !promptValue.trim()) return;
      request.resolve(promptValue);
      setRequest(null);
    }
  };

  if (!request) return null;

  const isFeedback = request.kind === "feedback";
  const isPrompt = request.kind === "prompt";
  const isConfirm = request.kind === "confirm";
  const isError = isFeedback && request.type === "error";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onClick={() => {
      if (isFeedback) {
        setRequest(null);
        return;
      }
      dismiss();
    }}>
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`h-1.5 ${isError ? "bg-rose-500" : "bg-emerald-500"}`} />
        <div className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isError ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              {isError ? <XCircle size={22} /> : isFeedback ? <CheckCircle2 size={22} /> : <Sparkles size={20} />}
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-slate-900">
                {isConfirm ? request.title : isPrompt ? request.title : request.title || (isError ? "操作失败，请检查后重试" : "操作成功")}
              </div>
              {((isConfirm && request.message) || (isPrompt && request.message) || (isFeedback && request.message)) ? (
                <div className="mt-1 text-sm leading-6 text-slate-500">
                  {isConfirm ? request.message : isPrompt ? request.message : request.message}
                </div>
              ) : null}
            </div>
          </div>

          {isPrompt ? (
            <label className="block">
              <div className="mb-1.5 text-sm font-bold text-slate-700">{request.label || "请输入内容"}</div>
              <input
                autoFocus
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirm();
                  }
                }}
                placeholder={request.placeholder}
                className={inputClassName()}
              />
            </label>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {isFeedback ? null : (
              <button type="button" onClick={dismiss} className={secondaryButtonClassName()}>
                {isConfirm ? request.cancelLabel || "取消" : isPrompt ? request.cancelLabel || "取消" : "取消"}
              </button>
            )}
            <button
              type="button"
              onClick={isFeedback ? () => setRequest(null) : confirm}
              className={isFeedback
                ? `inline-flex h-10 min-w-24 items-center justify-center rounded-xl px-5 text-sm font-bold text-white transition ${isError ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800"}`
                : `${primaryButtonClassName()} ${isConfirm && request.destructive ? "!bg-rose-600 hover:!bg-rose-700" : ""}`}
            >
              {isFeedback
                ? request.confirmLabel || (isError ? "知道了" : "完成")
                : isConfirm
                  ? request.confirmLabel || "确认"
                  : request.confirmLabel || "确认"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function showAdminSuccess(message: string) {
  adminDialogController?.showFeedback({ kind: "feedback", type: "success", message });
}

export function showAdminError(message: string) {
  toast.error(message);
}

export async function runAdminDelete(options: {
  request: Promise<unknown>;
  successMessage: string;
  staleMessage: string;
  errorLabel: string;
  onDeleted?: () => void;
  onRefresh?: () => Promise<void>;
  onFinally?: () => void;
}) {
  const { request, successMessage, staleMessage, errorLabel, onDeleted, onRefresh, onFinally } = options;
  try {
    await request;
    onDeleted?.();
    toast.success(successMessage);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      toast.info(staleMessage);
      return false;
    }
    if (error instanceof ApiError) {
      if (error.status === 401) {
        toast.error("登录已过期，请重新登录");
        return false;
      }
      if (error.status === 403) {
        toast.error("当前账号无权限执行该操作");
        return false;
      }
      toast.error(`${errorLabel}失败：${error.message || "操作失败"}`);
      return false;
    }
    toast.error(`${errorLabel}失败：系统异常，请稍后重试`);
    return false;
  } finally {
    onFinally?.();
    if (onRefresh) {
      await onRefresh();
    }
  }
}

export function openAdminConfirm(options: Omit<AdminConfirmRequest, "kind" | "resolve">) {
  return adminDialogController?.openConfirm(options) ?? Promise.resolve(false);
}

export function openAdminPrompt(options: Omit<AdminPromptRequest, "kind" | "resolve">) {
  return adminDialogController?.openPrompt(options) ?? Promise.resolve<string | null>(null);
}
