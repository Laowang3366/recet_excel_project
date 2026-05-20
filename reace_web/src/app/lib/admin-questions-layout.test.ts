import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminQuestionsSource = () =>
  readFileSync(resolve(process.cwd(), "src/app/pages/AdminQuestions.tsx"), "utf8");

describe("admin questions layout", () => {
  it("keeps the question management area before campaign configuration blocks", () => {
    const source = adminQuestionsSource();

    expect(source.indexOf('title="题目列表"')).toBeGreaterThan(-1);
    expect(source.indexOf('title="题目列表"')).toBeLessThan(source.indexOf("闯关配置"));
  });

  it("provides direct filters for finding questions", () => {
    const source = adminQuestionsSource();

    expect(source).toContain("keyword");
    expect(source).toContain("enabledFilter");
    expect(source).toContain("difficultyFilter");
  });
});
