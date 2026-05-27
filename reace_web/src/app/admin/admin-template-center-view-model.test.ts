import { describe, expect, it } from "vitest";
import {
  buildTemplateHealthItems,
  buildTemplatePayload,
  buildTemplateStats,
  filterAdminTemplates,
  paginateAdminTemplates,
  type AdminTemplateFormState,
  type AdminTemplateRecord,
} from "./admin-template-center-view-model";

const records: AdminTemplateRecord[] = [
  {
    id: 1,
    title: "销售数据分析看板",
    industryCategory: "销售",
    useScenario: "数据分析",
    previewImageUrl: "/uploads/sales.png",
    templateDescription: "包含销售趋势与区域对比",
    functionsUsed: ["销售分析", "业绩看板"],
    difficultyLevel: "中级",
    downloadCostPoints: 30,
    templateFileUrl: "/uploads/sales.xlsx",
    fileName: "sales.xlsx",
    fileSize: 2457600,
    fileVersion: "2.1",
    usageGuide: "请先导入原始销售数据",
    tags: ["销售分析", "业绩看板"],
    sortOrder: 10,
    enabled: true,
    downloadCount: 240,
    exchangeUserCount: 186,
  },
  {
    id: 2,
    title: "人事排班模板",
    industryCategory: "人事",
    useScenario: "排班",
    previewImageUrl: "/uploads/hr.png",
    templateDescription: "草稿缺少文件",
    functionsUsed: ["人事", "排班"],
    difficultyLevel: "基础",
    downloadCostPoints: 15,
    templateFileUrl: "",
    fileName: "",
    fileSize: 0,
    fileVersion: "",
    usageGuide: "",
    tags: ["人事", "排班"],
    sortOrder: 20,
    enabled: false,
    downloadCount: 0,
  },
  {
    id: 3,
    title: "库存周转表",
    industryCategory: "",
    useScenario: "",
    previewImageUrl: "",
    templateDescription: "未填写分类场景",
    functionsUsed: [],
    difficultyLevel: "基础",
    downloadCostPoints: 20,
    templateFileUrl: "/uploads/stock.xlsx",
    sortOrder: 30,
    enabled: true,
    downloadCount: 12,
  },
];

describe("admin template center view model", () => {
  it("filters templates by category, scenario, difficulty, status, and keyword", () => {
    const result = filterAdminTemplates(records, {
      industryCategory: "销售",
      useScenario: "数据分析",
      difficultyLevel: "中级",
      status: "enabled",
      keyword: "看板",
    });

    expect(result.map((item) => item.id)).toEqual([1]);
  });

  it("builds dashboard stats from current records", () => {
    expect(buildTemplateStats(records)).toEqual({
      total: 3,
      enabled: 2,
      downloads: 252,
      drafts: 1,
      missingFiles: 1,
    });
  });

  it("builds file health actions for missing metadata and unpublished drafts", () => {
    expect(buildTemplateHealthItems(records)).toEqual([
      { key: "missingFiles", label: "缺失源文件", count: 1, statusLabel: "", actionLabel: "处理" },
      { key: "missingMetadata", label: "未填写行业/场景", count: 1, statusLabel: "", actionLabel: "去补全" },
      { key: "drafts", label: "草稿未发布", count: 1, statusLabel: "", actionLabel: "处理" },
    ]);
  });

  it("paginates visible template cards", () => {
    expect(paginateAdminTemplates(records, 2, 2)).toEqual({
      page: 2,
      pageSize: 2,
      total: 3,
      pageCount: 2,
      records: [records[2]],
    });
  });

  it("normalizes create and update payloads for the existing admin template API", () => {
    const form: AdminTemplateFormState = {
      title: " 销售数据分析看板 ",
      industryCategory: "销售",
      useScenario: "数据分析",
      previewImageUrl: "/uploads/sales.png",
      templateDescription: " 多维度销售分析 ",
      functionsUsedText: "销售分析，业绩看板\n可视化",
      difficultyLevel: "中级",
      downloadCostPoints: 30,
      templateFileUrl: "/uploads/sales.xlsx",
      fileName: "sales_dashboard.xlsx",
      fileSize: 2457600,
      fileVersion: "1.0.0",
      sortOrder: 10,
      enabled: true,
      usageGuide: "请先导入原始销售数据",
    };

    expect(buildTemplatePayload(form)).toEqual({
      title: "销售数据分析看板",
      industryCategory: "销售",
      useScenario: "数据分析",
      previewImageUrl: "/uploads/sales.png",
      templateDescription: "多维度销售分析",
      usageGuide: "请先导入原始销售数据",
      functionsUsed: ["销售分析", "业绩看板", "可视化"],
      tags: ["销售分析", "业绩看板", "可视化"],
      difficultyLevel: "中级",
      downloadCostPoints: 30,
      templateFileUrl: "/uploads/sales.xlsx",
      fileName: "sales_dashboard.xlsx",
      fileSize: 2457600,
      fileVersion: "1.0.0",
      sortOrder: 10,
      enabled: true,
    });
  });
});
