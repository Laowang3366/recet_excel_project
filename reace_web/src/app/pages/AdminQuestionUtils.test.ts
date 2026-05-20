import { describe, expect, it } from "vitest";
import {
  applyQuestionDifficulty,
  defaultQuestionForm,
  resolveQuestionPointsByDifficulty,
} from "./AdminQuestionUtils";

describe("AdminQuestionUtils", () => {
  it("maps question difficulty to reward points", () => {
    expect(resolveQuestionPointsByDifficulty(1)).toBe(12);
    expect(resolveQuestionPointsByDifficulty(2)).toBe(15);
    expect(resolveQuestionPointsByDifficulty(5)).toBe(22);
    expect(resolveQuestionPointsByDifficulty(7)).toBe(26);
  });

  it("keeps question reward points derived from difficulty", () => {
    const form = applyQuestionDifficulty(defaultQuestionForm(), 7);

    expect(form.difficulty).toBe(7);
    expect(form.points).toBe(26);
  });
});
