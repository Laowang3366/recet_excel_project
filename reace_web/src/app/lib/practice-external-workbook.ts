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

export function resolveAbsoluteDownloadUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();
}
