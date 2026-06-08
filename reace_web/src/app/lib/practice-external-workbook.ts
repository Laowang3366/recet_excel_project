export function buildExcelDesktopUri(downloadUrl: string) {
  return `ms-excel:ofv|u|${downloadUrl}`;
}

export function sanitizeWorkbookFileName(title?: string | null) {
  const normalized = (title || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return `${normalized || "excelcc-practice-question"}.xlsx`;
}

export function resolveAbsoluteDownloadUrl(path: string, origin = getCurrentOrigin()) {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath || !origin) {
    throw new Error("无效的题目下载地址");
  }

  const baseUrl = new URL(origin);
  const candidateUrl = new URL(normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`, baseUrl);
  if (candidateUrl.origin !== baseUrl.origin || !candidateUrl.pathname.startsWith("/api/practice/questions/")) {
    throw new Error("无效的题目下载地址");
  }
  return candidateUrl.toString();
}

function getCurrentOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "";
}
