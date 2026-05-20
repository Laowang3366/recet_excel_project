import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const qaPageFiles = [
  "src/app/pages/QaCenter.tsx",
  "src/app/pages/MyQaCenter.tsx",
  "src/app/pages/QaCaseDetail.tsx",
  "src/app/pages/AdminQa.tsx",
];

const internalTerms = [
  "不会物理删除",
  "历史通知",
  "仍保留用于审计",
  "前台列表",
  "前台不再展示",
  "保留做题平台",
  "不扩展论坛功能",
  "其他用户将能查看",
];

describe("qa page copy", () => {
  it("does not expose implementation or product-planning wording", () => {
    const source = qaPageFiles
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    for (const term of internalTerms) {
      expect(source).not.toContain(term);
    }
  });
});
