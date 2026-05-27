export type FileRecycleItemView = {
  id: number;
  resourceType: string;
  resourceId: number;
  displayName?: string | null;
  originalFileUrl?: string | null;
  recycleFileUrl?: string | null;
  fileCount?: number;
  fileSizeBytes?: number | null;
  fileSizeLabel?: string | null;
  deletedBy?: number | string | null;
  deletedByName?: string | null;
  deletedAt?: string | null;
  expiresAt?: string | null;
  expired?: boolean;
  status?: string | null;
};

export type RecycleStatusTone = "success" | "warning" | "danger" | "neutral";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 7;
const STATUS_WARNING_DAYS = 2;

export function getRecycleSourceLabel(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  const map: Record<string, string> = {
    question: "题库模板",
    template: "模板中心",
    qa_case: "答疑管理",
    qa_answer: "答疑附件",
  };
  return map[normalized] || String(value ?? "-") || "-";
}

export function getRecycleFileName(item: FileRecycleItemView) {
  const path = String(item.originalFileUrl || item.recycleFileUrl || "").trim();
  if (path) {
    const normalized = path.replace(/\\/g, "/");
    const fileName = normalized.split("/").filter(Boolean).pop();
    if (fileName) return decodeFileName(fileName);
  }
  if (item.displayName?.trim()) return item.displayName.trim();
  return `回收站记录 ${item.id}`;
}

export function getRecycleFileExtension(item: FileRecycleItemView) {
  const fileName = getRecycleFileName(item);
  const match = fileName.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() || "";
}

export function getRecycleFileSizeLabel(item: FileRecycleItemView) {
  if (item.fileSizeLabel?.trim()) return item.fileSizeLabel.trim();
  if (typeof item.fileSizeBytes === "number" && Number.isFinite(item.fileSizeBytes)) {
    return formatBytes(item.fileSizeBytes);
  }
  return "未提供";
}

export function getRecycleDeletedByLabel(value: FileRecycleItemView["deletedBy"]) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return `ID ${value}`;
  return String(value);
}

export function getRecycleRetentionDays(item: FileRecycleItemView, now = new Date()) {
  const expiresAt = parseRecycleDate(item.expiresAt);
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY));
}

export function getRecycleStatus(item: FileRecycleItemView, now = new Date()): { label: string; tone: RecycleStatusTone } {
  const days = getRecycleRetentionDays(item, now);
  const isExpired = item.expired === true || days === 0 || (days !== null && days < 0);
  if (isExpired) return { label: "已过期", tone: "danger" };
  if (days !== null && days <= STATUS_WARNING_DAYS) return { label: "即将过期", tone: "warning" };
  return { label: "可恢复", tone: "success" };
}

export function buildRecycleStats(records: readonly FileRecycleItemView[], total: number, now = new Date()) {
  let recoverableRecords = 0;
  let expiringSoonRecords = 0;
  let todayDeletedRecords = 0;
  let expiredRecords = 0;
  let totalFileCount = 0;
  let totalSizeBytes = 0;
  let expiredFileCount = 0;
  let expiredSizeBytes = 0;
  let hasUnknownSize = false;
  let hasUnknownExpiredSize = false;
  const sourceModules = new Set<string>();
  const expiredSourceModuleCounts = new Map<string, number>();
  const todayKey = toLocalDateKey(now);

  records.forEach((item) => {
    const status = getRecycleStatus(item, now);
    const days = getRecycleRetentionDays(item, now);
    const deletedAt = parseRecycleDate(item.deletedAt);
    const fileCount = normalizeFileCount(item.fileCount);
    totalFileCount += fileCount;
    const sourceLabel = getRecycleSourceLabel(item.resourceType);
    sourceModules.add(sourceLabel);
    if (typeof item.fileSizeBytes === "number" && Number.isFinite(item.fileSizeBytes)) {
      totalSizeBytes += item.fileSizeBytes;
    } else {
      hasUnknownSize = true;
    }

    if (status.tone === "danger") {
      expiredRecords += 1;
      expiredFileCount += fileCount;
      expiredSourceModuleCounts.set(sourceLabel, (expiredSourceModuleCounts.get(sourceLabel) ?? 0) + fileCount);
      if (typeof item.fileSizeBytes === "number" && Number.isFinite(item.fileSizeBytes)) {
        expiredSizeBytes += item.fileSizeBytes;
      } else {
        hasUnknownExpiredSize = true;
      }
    } else {
      recoverableRecords += 1;
      if (days !== null && days <= EXPIRING_SOON_DAYS) {
        expiringSoonRecords += 1;
      }
    }
    if (deletedAt && toLocalDateKey(deletedAt) === todayKey) {
      todayDeletedRecords += 1;
    }
  });

  return {
    totalRecords: total,
    currentPageRecords: records.length,
    recoverableRecords,
    expiringSoonRecords,
    todayDeletedRecords,
    expiredRecords,
    totalFileCount,
    totalSizeBytes,
    totalSizeLabel: hasUnknownSize ? "未提供" : formatBytes(totalSizeBytes),
    hasUnknownSize,
    sourceModules: Array.from(sourceModules),
    expiredFileCount,
    expiredSizeBytes,
    expiredSizeLabel: hasUnknownExpiredSize ? "未提供" : formatBytes(expiredSizeBytes),
    hasUnknownExpiredSize,
    expiredSourceModules: Array.from(expiredSourceModuleCounts.keys()),
    expiredSourceModuleCounts: Array.from(expiredSourceModuleCounts, ([label, count]) => ({ label, count })),
  };
}

export function buildRecycleRiskSummary(records: readonly FileRecycleItemView[]) {
  const sourceLabels = Array.from(new Set(records.map((item) => getRecycleSourceLabel(item.resourceType))));
  const sizeBytes = records.reduce((sum, item) => {
    if (typeof item.fileSizeBytes !== "number" || !Number.isFinite(item.fileSizeBytes)) return sum;
    return sum + item.fileSizeBytes;
  }, 0);
  const hasCompleteSize = records.length > 0 && records.every((item) => typeof item.fileSizeBytes === "number" && Number.isFinite(item.fileSizeBytes));

  return {
    fileCount: records.reduce((sum, item) => sum + normalizeFileCount(item.fileCount), 0),
    releaseSizeLabel: hasCompleteSize ? formatBytes(sizeBytes) : "未提供",
    sourceLabels,
  };
}

export function buildRecycleSourceBreakdown(records: readonly FileRecycleItemView[]) {
  const counts = new Map<string, number>();
  records.forEach((item) => {
    const label = getRecycleSourceLabel(item.resourceType);
    counts.set(label, (counts.get(label) ?? 0) + normalizeFileCount(item.fileCount));
  });
  return Array.from(counts, ([label, count]) => ({ label, count }));
}

export function formatRetentionText(days: number | null) {
  if (days === null) return "-";
  if (days <= 0) return "已过期";
  return `${days} 天`;
}

function normalizeFileCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function parseRecycleDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function decodeFileName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatBytes(value: number) {
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${trimNumber(value / 1024)}KB`;
  if (value < 1024 * 1024 * 1024) return `${trimNumber(value / 1024 / 1024)}MB`;
  return `${trimNumber(value / 1024 / 1024 / 1024)}GB`;
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}
