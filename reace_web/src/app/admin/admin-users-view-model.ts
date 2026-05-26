export type AdminUserViewRecord = {
  id: number;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: number | null;
  isMuted?: boolean | null;
  level?: number | null;
  levelName?: string | null;
  points?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
  lastActiveTime?: string | null;
};

export type AdminUserLevelRuleLike = {
  level?: number | null;
  name?: string | null;
};

export type AdminUserSummary = {
  totalUsers: number;
  todayNew: number;
  activeUsers: number;
  frozenUsers: number;
};

export type AdminUserCompositionSegment = {
  label: string;
  count: number;
  percent: number;
  color: string;
};

export type AdminUserTrendPoint = {
  date: string;
  label: string;
  count: number;
};

const COMPOSITION_COLORS = ["#22c55e", "#94a3b8", "#f59e0b", "#2563eb", "#8b5cf6"];

function toDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toShortDateLabel(dateKey: string) {
  return dateKey.slice(5);
}

export function resolveAdminUserLevelLabel(record: AdminUserViewRecord, levelRules: AdminUserLevelRuleLike[] = []) {
  const level = Number(record.level || 1);
  const directName = record.levelName?.trim();
  if (directName) return directName;
  const matchedRule = levelRules.find((item) => Number(item.level || 0) === level);
  const ruleName = matchedRule?.name?.trim();
  return ruleName || `Lv.${level}`;
}

export function buildUserSummary(records: AdminUserViewRecord[], totalUsers: number, now = new Date()): AdminUserSummary {
  const todayKey = toDateKey(now);
  return {
    totalUsers,
    todayNew: records.filter((item) => {
      const date = toDate(item.createTime);
      return date ? toDateKey(date) === todayKey : false;
    }).length,
    activeUsers: records.filter((item) => Number(item.status ?? 0) === 0).length,
    frozenUsers: records.filter((item) => Number(item.status ?? 0) === 1 || Boolean(item.isMuted)).length,
  };
}

export function buildUserComposition(records: AdminUserViewRecord[], levelRules: AdminUserLevelRuleLike[] = []): AdminUserCompositionSegment[] {
  const total = records.length || 1;
  const grouped = records.reduce<Record<string, number>>((acc, item) => {
    const label = resolveAdminUserLevelLabel(item, levelRules);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort((left, right) => right[1] - left[1])
    .map(([label, count], index) => ({
      label,
      count,
      percent: Math.round((count / total) * 100),
      color: COMPOSITION_COLORS[index % COMPOSITION_COLORS.length],
    }));
}

export function buildRegistrationTrend(records: AdminUserViewRecord[], days = 7, now = new Date()): AdminUserTrendPoint[] {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const keys = Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (days - index - 1));
    return toDateKey(date);
  });
  const counts = new Map(keys.map((key) => [key, 0]));
  records.forEach((item) => {
    const date = toDate(item.createTime);
    if (!date) return;
    const key = toDateKey(date);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  });

  return keys.map((key) => ({ date: key, label: toShortDateLabel(key), count: counts.get(key) || 0 }));
}

export function maskAdminPhone(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length < 7) return text;
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

export function sanitizeCsvCell(value: unknown) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text.trim()) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function buildUsersCsv(records: AdminUserViewRecord[]) {
  const header = ["用户ID", "用户名", "邮箱", "角色", "状态", "等级", "积分", "创建时间"];
  const rows = records.map((item) => [
    item.id,
    item.username || "",
    item.email || "",
    item.role || "",
    Number(item.status ?? 0) === 1 ? "已锁定" : "正常",
    item.level ?? "",
    item.points ?? "",
    item.createTime || "",
  ]);
  return [header, ...rows].map((row) => row.map(sanitizeCsvCell).join(",")).join("\n");
}
