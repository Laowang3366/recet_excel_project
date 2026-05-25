import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("practice campaign entry points", () => {
  it("does not expose chapter-list or daily-challenge actions in the campaign hub", () => {
    const hub = source("src/app/pages/PracticeCampaignHub.tsx");

    expect(hub).not.toContain("查看所有章节列表");
    expect(hub).not.toContain("/practice/daily");
    expect(hub).not.toContain("每日挑战");
  });

  it("does not register a daily challenge route or preload key", () => {
    const routes = source("src/app/routes.tsx");
    const queryKeys = source("src/app/lib/query-keys.ts");

    expect(routes).not.toContain("practice/daily");
    expect(routes).not.toContain("PracticeCampaignDaily");
    expect(queryKeys).not.toContain("campaignDaily");
    expect(queryKeys).not.toContain("practiceCampaignDaily");
  });

  it("does not keep daily challenge copy in navigation or admin question management", () => {
    const navigation = source("src/app/lib/site-navigation.ts");
    const adminQuestions = source("src/app/pages/AdminQuestions.tsx");

    expect(navigation).not.toContain("每日挑战");
    expect(adminQuestions).not.toContain("/api/admin/practice-campaign/daily-challenge");
    expect(adminQuestions).not.toContain("闯关每日挑战配置");
    expect(adminQuestions).not.toContain("保存每日挑战");
    expect(adminQuestions).not.toContain('<option value="daily">每日挑战</option>');
  });
});
