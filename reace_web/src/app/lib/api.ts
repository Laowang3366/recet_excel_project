import { toast } from "sonner";
import { isLoginRequiredResponse } from "./auth-errors";
import { clearStoredSession, getStoredToken } from "./session-store";

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  silent?: boolean;
};

function normalizeErrorMessage(data: unknown, fallback: string) {
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const candidate = (data as Record<string, unknown>).message;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return fallback;
}

export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiRequestInternal<T>(path, options, 0);
}

export async function downloadFile(path: string, fallbackFileName = "download", options: Pick<RequestOptions, "headers" | "auth" | "silent"> = {}) {
  const { headers = {}, auth = true, silent = false } = options;
  const token = auth ? getStoredToken() : null;
  const requestHeaders = new Headers(headers);
  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(resolveApiUrl(path), {
    method: "GET",
    headers: requestHeaders,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");
    const message = normalizeErrorMessage(data, `请求失败(${response.status})`);
    const loginRequired = isLoginRequiredResponse(response.status, message, data);
    if (loginRequired) {
      clearStoredSession();
    }
    if (!silent) {
      if (loginRequired) {
        toast.info("请先登录后继续操作", {
          action: {
            label: "去登录",
            onClick: () => {
              window.location.assign("/auth");
            },
          },
        });
      } else {
        toast.error(message);
      }
    }
    throw new ApiError(message, response.status, data);
  }

  const blob = await response.blob();
  const fileName = resolveDownloadFileName(response.headers.get("content-disposition"), fallbackFileName);
  triggerBrowserDownload(blob, fileName);
}

async function apiRequestInternal<T = any>(path: string, options: RequestOptions, retryCount: number): Promise<T> {
  const { method = "GET", body, headers = {}, auth = true, silent = false } = options;
  const token = auth ? getStoredToken() : null;
  const requestHeaders = new Headers(headers);
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: requestHeaders,
    body: payload,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    if (response.status === 503 && retryCount < 2 && shouldRetryRequest(path, method)) {
      await delay(300 * (retryCount + 1));
      return apiRequestInternal<T>(path, options, retryCount + 1);
    }
    const message = normalizeErrorMessage(data, `请求失败(${response.status})`);
    const loginRequired = isLoginRequiredResponse(response.status, message, data);
    if (loginRequired) {
      clearStoredSession();
    }
    if (!silent) {
      if (loginRequired) {
        toast.info("请先登录后继续操作", {
          action: {
            label: "去登录",
            onClick: () => {
              window.location.assign("/auth");
            },
          },
        });
      } else {
        toast.error(message);
      }
    }
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

function resolveApiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

function resolveDownloadFileName(disposition: string | null, fallbackFileName: string) {
  if (!disposition) return fallbackFileName;
  const encodedMatch = disposition.match(/filename\*\s*=\s*[^']*''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, "")) || fallbackFileName;
    } catch {
      return fallbackFileName;
    }
  }
  const quotedMatch = disposition.match(/filename\s*=\s*"([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1] || fallbackFileName;
  const plainMatch = disposition.match(/filename\s*=\s*([^;]+)/i);
  return plainMatch?.[1]?.trim() || fallbackFileName;
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function shouldRetryRequest(path: string, method: string) {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "GET") return true;
  return path.startsWith("/api/auth/");
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const api = {
  get: <T = any>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T = any>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  put: <T = any>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  delete: <T = any>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE", body }),
  download: downloadFile,
};
