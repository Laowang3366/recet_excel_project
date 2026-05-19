import { describe, expect, it } from "vitest";
import {
  buildModuleSearchPath,
  resolveHeaderSearchModule,
} from "./module-search";

describe("module search helpers", () => {
  it("shows module search only for practice and templates", () => {
    expect(resolveHeaderSearchModule("/practice")?.key).toBe("practice");
    expect(resolveHeaderSearchModule("/practice/question/121")?.key).toBe("practice");
    expect(resolveHeaderSearchModule("/templates")?.key).toBe("templates");
    expect(resolveHeaderSearchModule("/tutorials")).toBeNull();
  });

  it("builds search urls while preserving template filters", () => {
    expect(buildModuleSearchPath("practice", "SUM", "")).toBe("/practice?search=SUM");
    expect(buildModuleSearchPath("templates", "考勤", "category=人事")).toBe(
      "/templates?category=%E4%BA%BA%E4%BA%8B&search=%E8%80%83%E5%8B%A4"
    );
    expect(buildModuleSearchPath("templates", "  ", "category=财务&search=旧词")).toBe(
      "/templates?category=%E8%B4%A2%E5%8A%A1"
    );
  });
});
