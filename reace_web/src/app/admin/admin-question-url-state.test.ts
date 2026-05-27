import { describe, expect, it } from "vitest";
import { resolveInitialQuestionCategoryId } from "./admin-question-url-state";

describe("admin question url state", () => {
  it("reads the initial question category filter from the route query string", () => {
    expect(resolveInitialQuestionCategoryId("?questionCategoryId=7&keyword=SUM")).toBe("7");
  });

  it("ignores missing or invalid question category query values", () => {
    expect(resolveInitialQuestionCategoryId("")).toBe("");
    expect(resolveInitialQuestionCategoryId("?questionCategoryId=abc")).toBe("");
  });
});
