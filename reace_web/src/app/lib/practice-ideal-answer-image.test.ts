import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const practiceDetailSource = () =>
  readFileSync(resolve(process.cwd(), "src/app/pages/PracticeDetail.tsx"), "utf8");

describe("practice ideal answer reference image", () => {
  it("keeps the reference image behind an explicit view action", () => {
    const source = practiceDetailSource();

    expect(source).toContain("idealAnswerImageUrl");
    expect(source).toContain("查看参考图");
    expect(source).toContain("normalizeResourceUrl");
  });

  it("keeps the question action toolbar aligned when the reference image action is present", () => {
    const source = practiceDetailSource();

    expect(source).toContain("practiceDetailHeaderClassName");
    expect(source).toContain("practiceDetailActionBarClassName");
    expect(source).toContain("xl:grid-cols-[minmax(0,1fr)_auto]");
    expect(source).toContain("xl:w-[720px]");
    expect(source).toContain("xl:justify-end");
  });
});
