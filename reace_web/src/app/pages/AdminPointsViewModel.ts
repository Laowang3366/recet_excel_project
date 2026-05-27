import type { PointsRecord, PointsRuleRecord, PointsStatsResponse } from "./AdminConsoleTypes";

export type PointsDashboardInput = {
  rules: PointsRuleRecord[];
  stats?: PointsStatsResponse | null;
  records: PointsRecord[];
};

export function getPointsValue(record: PointsRecord) {
  const value = record.change ?? record.points;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatSignedPoints(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value > 0 ? `+${value}` : String(value);
}

export function getPointsRuleStatus(rule: Pick<PointsRuleRecord, "enabled">) {
  return rule.enabled ? { label: "启用", tone: "success" as const } : { label: "停用", tone: "warning" as const };
}

export function buildPointsDashboard({ rules, stats, records }: PointsDashboardInput) {
  const fallbackConsumption = records.reduce((sum, item) => {
    const value = getPointsValue(item);
    return value && value < 0 ? sum + Math.abs(value) : sum;
  }, 0);
  return {
    ruleCount: rules.length,
    enabledRuleCount: rules.filter((item) => Boolean(item.enabled)).length,
    activeUsers: normalizeNumber(stats?.activeUsers),
    todayIssued: Math.max(normalizeNumber(stats?.todayIssued ?? stats?.todayPoints), 0),
    visibleConsumption: Math.max(normalizeNumber(stats?.todayConsumed) || fallbackConsumption, 0),
    abnormalRecords: normalizeNumber(stats?.anomalyRecords),
  };
}

export function getPointsBadgeClassName(tone: "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return "bg-[#e6f8ef] text-[#0f9f5f] ring-[#b7ebc6]";
  if (tone === "warning") return "bg-[#fff7e6] text-[#d46b08] ring-[#ffd591]";
  if (tone === "danger") return "bg-[#fff1f0] text-[#cf1322] ring-[#ffa39e]";
  return "bg-[#eef2f6] text-[#475467] ring-[#d0d5dd]";
}

export function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
