import { describe, expect, it } from "vitest";
import { filterTemplatesBySearch } from "./template-center";

describe("template center helpers", () => {
  it("filters templates by title, category, scenario, description, and functions", () => {
    const records = [
      {
        title: "销售日报",
        industryCategory: "销售",
        useScenario: "门店复盘",
        templateDescription: "汇总业绩",
        functionsUsed: ["SUMIF"],
      },
      {
        title: "人事考勤",
        industryCategory: "人事",
        useScenario: "月度考勤",
        templateDescription: "统计迟到",
        functionsUsed: ["COUNTIF"],
      },
    ];

    expect(filterTemplatesBySearch(records, "countif")).toEqual([records[1]]);
    expect(filterTemplatesBySearch(records, "销售")).toEqual([records[0]]);
    expect(filterTemplatesBySearch(records, " ")).toEqual(records);
  });
});
