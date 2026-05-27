import { parseFunctionsInput } from "../lib/template-center";

export type AdminTemplateStatusFilter = "" | "enabled" | "draft";

export type AdminTemplateRecord = {
  id: number;
  title?: string | null;
  industryCategory?: string | null;
  useScenario?: string | null;
  previewImageUrl?: string | null;
  templateDescription?: string | null;
  functionsUsed?: string[] | null;
  difficultyLevel?: string | null;
  downloadCostPoints?: number | null;
  templateFileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileVersion?: string | null;
  lastUploadedAt?: string | null;
  usageGuide?: string | null;
  tags?: string[] | null;
  exchangeUserCount?: number | null;
  sortOrder?: number | null;
  enabled?: boolean | null;
  downloadCount?: number | null;
  updateTime?: string | null;
};

export type AdminTemplateFormState = {
  title: string;
  industryCategory: string;
  useScenario: string;
  previewImageUrl: string;
  templateDescription: string;
  functionsUsedText: string;
  difficultyLevel: string;
  downloadCostPoints: number;
  templateFileUrl: string;
  fileName: string;
  fileSize: number;
  fileVersion: string;
  sortOrder: number;
  enabled: boolean;
  usageGuide: string;
};

export type AdminTemplateFilters = {
  industryCategory?: string;
  useScenario?: string;
  difficultyLevel?: string;
  status?: AdminTemplateStatusFilter;
  keyword?: string;
};

export type AdminTemplateStats = {
  total: number;
  enabled: number;
  downloads: number;
  drafts: number;
  missingFiles: number;
};

export type AdminTemplateHealthItem = {
  key: "missingFiles" | "missingMetadata" | "drafts";
  label: string;
  count: number;
  statusLabel: string;
  actionLabel: string;
};

export function filterAdminTemplates<T extends AdminTemplateRecord>(records: T[], filters: AdminTemplateFilters) {
  const category = normalize(filters.industryCategory);
  const scenario = normalize(filters.useScenario);
  const difficulty = normalize(filters.difficultyLevel);
  const keyword = normalize(filters.keyword).toLowerCase();
  const status = filters.status || "";

  return records.filter((item) => {
    if (category && normalize(item.industryCategory) !== category) return false;
    if (scenario && normalize(item.useScenario) !== scenario) return false;
    if (difficulty && normalize(item.difficultyLevel) !== difficulty) return false;
    if (status === "enabled" && !item.enabled) return false;
    if (status === "draft" && item.enabled) return false;
    if (!keyword) return true;

    return [
      item.title,
      item.industryCategory,
      item.useScenario,
      item.difficultyLevel,
      item.templateDescription,
      item.usageGuide,
      item.fileName,
      ...(item.functionsUsed || []),
      ...(item.tags || []),
    ].some((value) => normalize(value).toLowerCase().includes(keyword));
  });
}

export function paginateAdminTemplates<T>(records: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, Number(pageSize || 1));
  const pageCount = Math.max(1, Math.ceil(records.length / safePageSize));
  const safePage = Math.min(Math.max(1, Number(page || 1)), pageCount);
  const start = (safePage - 1) * safePageSize;

  return {
    page: safePage,
    pageSize: safePageSize,
    total: records.length,
    pageCount,
    records: records.slice(start, start + safePageSize),
  };
}

export function buildTemplateStats(records: AdminTemplateRecord[]): AdminTemplateStats {
  return {
    total: records.length,
    enabled: records.filter((item) => Boolean(item.enabled)).length,
    downloads: records.reduce((sum, item) => sum + Number(item.downloadCount || 0), 0),
    drafts: records.filter((item) => !item.enabled).length,
    missingFiles: records.filter((item) => !normalize(item.templateFileUrl)).length,
  };
}

export function buildTemplateHealthItems(records: AdminTemplateRecord[]): AdminTemplateHealthItem[] {
  const missingFiles = records.filter((item) => !normalize(item.templateFileUrl)).length;
  return [
    {
      key: "missingFiles",
      label: "缺失源文件",
      count: missingFiles,
      statusLabel: missingFiles === 0 ? "正常" : "",
      actionLabel: missingFiles === 0 ? "" : "处理",
    },
    {
      key: "missingMetadata",
      label: "未填写行业/场景",
      count: records.filter((item) => !normalize(item.industryCategory) || !normalize(item.useScenario)).length,
      statusLabel: "",
      actionLabel: "去补全",
    },
    {
      key: "drafts",
      label: "草稿未发布",
      count: records.filter((item) => !item.enabled).length,
      statusLabel: "",
      actionLabel: "处理",
    },
  ];
}

export function buildTemplatePayload(form: AdminTemplateFormState) {
  const tags = parseFunctionsInput(form.functionsUsedText || "");

  return {
    title: normalize(form.title),
    industryCategory: normalize(form.industryCategory),
    useScenario: normalize(form.useScenario),
    previewImageUrl: normalize(form.previewImageUrl),
    templateDescription: normalize(form.templateDescription),
    usageGuide: normalize(form.usageGuide),
    functionsUsed: tags,
    tags,
    difficultyLevel: normalize(form.difficultyLevel),
    downloadCostPoints: Number(form.downloadCostPoints || 0),
    templateFileUrl: normalize(form.templateFileUrl),
    fileName: normalize(form.fileName),
    fileSize: Number(form.fileSize || 0),
    fileVersion: normalize(form.fileVersion),
    sortOrder: Number(form.sortOrder || 0),
    enabled: Boolean(form.enabled),
  };
}

export function getUniqueTemplateOptions(records: AdminTemplateRecord[], key: "industryCategory" | "useScenario" | "difficultyLevel") {
  return Array.from(new Set(records.map((item) => normalize(item[key])).filter(Boolean)));
}

function normalize(value: unknown) {
  return String(value ?? "").trim();
}
