export const TEMPLATE_INDUSTRY_CATEGORIES = ["财务", "人事", "生产", "销售", "运营", "仓储", "采购"] as const;

export const TEMPLATE_DIFFICULTY_LEVELS = ["入门", "基础", "进阶", "高级", "专家"] as const;

export function formatTemplateDifficulty(value?: string | null) {
  return value || "入门";
}

export function formatTemplateCost(value?: number | null) {
  const points = Number(value || 0);
  return points > 0 ? `${points} 积分` : "免费";
}

export function parseFunctionsInput(value: string) {
  return value
    .split(/[\n,，、；;]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function filterTemplatesBySearch<T extends {
  title?: string | null;
  industryCategory?: string | null;
  useScenario?: string | null;
  templateDescription?: string | null;
  functionsUsed?: string[] | null;
}>(records: T[], searchTerm?: string | null) {
  const keyword = (searchTerm || "").trim().toLowerCase();
  if (!keyword) return records;
  return records.filter((item) => [
    item.title,
    item.industryCategory,
    item.useScenario,
    item.templateDescription,
    ...(item.functionsUsed || []),
  ].some((value) => String(value || "").toLowerCase().includes(keyword)));
}
