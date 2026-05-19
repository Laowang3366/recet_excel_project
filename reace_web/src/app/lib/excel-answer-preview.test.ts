import { describe, expect, it } from "vitest";
import {
  findMissingFormulaCellRefs,
  formatAnswerPreviewCellDisplay,
  resolveExcelCellNumberFormat,
  type ExcelAnswerSnapshot,
} from "./excel";

describe("excel answer preview", () => {
  it("reports non-formula cells inside a formula-checked answer range", () => {
    const snapshot: ExcelAnswerSnapshot = {
      values: [[100], [200], [300], [400], [500]],
      formulas: [["SUM(C3:E3)"], ["SUM(C4:E4)"], [""], [""], [""]],
    };

    expect(findMissingFormulaCellRefs(snapshot, "F3:F7")).toEqual(["F5", "F6", "F7"]);
  });

  it("renders formulas as formulas and plain values as values", () => {
    expect(formatAnswerPreviewCellDisplay(434000, "SUM(C5:E5)")).toBe("=SUM(C5:E5)");
    expect(formatAnswerPreviewCellDisplay(434000, "")).toBe("434000");
  });

  it("renders external Excel formulas without compatibility prefixes", () => {
    expect(formatAnswerPreviewCellDisplay("#NAME?", "_xlfn.LET(_xlpm.m,K6,_xlpm.m)")).toBe("=LET(m,K6,m)");
  });

  it("infers date number formatting from an Excel serial with date display", () => {
    expect(resolveExcelCellNumberFormat({ value: 46083, display: "2026-03-02" })).toBe("yyyy-mm-dd");
    expect(resolveExcelCellNumberFormat({ value: 46083, display: "46083" })).toBe("");
  });
});
