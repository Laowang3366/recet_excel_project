import { describe, expect, it } from "vitest";
import { orderWorkbookHydrationEntries, type ExcelWorkbookSnapshot } from "./excel-editor-hydration";

describe("orderWorkbookHydrationEntries", () => {
  it("hydrates source values before formulas so dynamic formulas can calculate against complete data", () => {
    const cells: ExcelWorkbookSnapshot["sheets"][number]["cells"] = {
      M10: { formula: "LET(ids,A11:A12,ids)", value: "CT900", display: "CT900" },
      A11: { value: "CT900", display: "CT900" },
      B11: { value: "松果零售", display: "松果零售" },
      N10: { value: "客户", display: "客户" },
      O10: { formula: "SUM(F11:F12)", value: 355000, display: "355000" },
    };

    expect(orderWorkbookHydrationEntries(cells).map((entry) => entry.cellRef)).toEqual([
      "A11",
      "B11",
      "N10",
      "M10",
      "O10",
    ]);
  });
});
