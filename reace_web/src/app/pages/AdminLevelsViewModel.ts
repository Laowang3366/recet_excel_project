import type { LevelUserRecord, LevelsOverviewResponse } from "./AdminConsoleTypes";

export type LevelDashboard = {
  levelRuleCount: number;
  enabledLevelRuleCount: number;
  expRuleCount: number;
  enabledExpRuleCount: number;
  pendingReviewCount: number;
  logCount: number;
  highestLevelUsers: number;
  distribution: NonNullable<LevelsOverviewResponse["distribution"]>;
};

export type LevelBadgeTone = "blue" | "teal" | "green" | "orange" | "purple" | "amber";

export function buildLevelDashboard(overview?: LevelsOverviewResponse | null): LevelDashboard {
  const levelRules = overview?.levelRules || [];
  const expRules = overview?.expRules || [];

  return {
    levelRuleCount: levelRules.length,
    enabledLevelRuleCount: levelRules.filter((item) => item.enabled !== false).length,
    expRuleCount: expRules.length,
    enabledExpRuleCount: expRules.filter((item) => item.enabled !== false).length,
    pendingReviewCount: 0,
    logCount: 0,
    highestLevelUsers: normalizeNumber(overview?.stats?.highestLevelUsers),
    distribution: overview?.distribution || [],
  };
}

export function getLevelProgressPercent(user: Pick<LevelUserRecord, "progress">) {
  const current = normalizeNumber(user.progress?.current);
  const next = normalizeNumber(user.progress?.nextThreshold);
  if (next <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / next) * 100)));
}

export function getLevelBadgeTone(level: unknown): LevelBadgeTone {
  const numeric = normalizeNumber(level);
  if (numeric <= 1) return "blue";
  if (numeric === 2) return "teal";
  if (numeric === 3) return "green";
  if (numeric === 4) return "orange";
  if (numeric === 5) return "purple";
  return "amber";
}

export function getLevelBadgeClassName(tone: LevelBadgeTone) {
  const map: Record<LevelBadgeTone, string> = {
    blue: "bg-[#e6f4ff] text-[#0958d9] ring-[#91caff]",
    teal: "bg-[#e6fffb] text-[#08979c] ring-[#87e8de]",
    green: "bg-[#e6f8ef] text-[#0f9f5f] ring-[#b7ebc6]",
    orange: "bg-[#fff7e6] text-[#d46b08] ring-[#ffd591]",
    purple: "bg-[#f4edff] text-[#722ed1] ring-[#d3adf7]",
    amber: "bg-[#fff4de] text-[#b76b00] ring-[#ffd666]",
  };
  return map[tone];
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
