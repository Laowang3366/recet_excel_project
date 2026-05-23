import { describe, expect, it } from "vitest";
import {
  orderWorkbookHydrationEntries,
  preserveImportedFormulaCachedValues,
  resolveWorkbookHydrationValue,
  type ExcelWorkbookSnapshot,
} from "./excel-editor-hydration";

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

describe("resolveWorkbookHydrationValue", () => {
  it("uses cached values for imported formulas when spill children are preserved", () => {
    expect(
      resolveWorkbookHydrationValue(
        {
          formula: "LET(start,N4,n,N5,months,EDATE(start,SEQUENCE(1,n,0)),VSTACK(TEXT(months,\"yyyy-mm\")))",
          value: "2026-05",
          display: "2026-05",
        },
        { hydrateFormulaAsCachedValue: true },
      ),
    ).toBe("2026-05");
  });

  it("hydrates editable formulas as formulas when cached formula mode is disabled", () => {
    expect(
      resolveWorkbookHydrationValue(
        {
          formula: "SUM(A1:A3)",
          value: 6,
          display: "6",
        },
        { hydrateFormulaAsCachedValue: false },
      ),
    ).toBe("=SUM(A1:A3)");
  });
});

describe("preserveImportedFormulaCachedValues", () => {
  it("keeps cached values when the editor recalculates an imported Excel 365 formula as an error", () => {
    const previous: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M10: {
              formula: "LET(start,N4,n,N5,months,EDATE(start,SEQUENCE(1,n,0)),VSTACK(TEXT(months,\"yyyy-mm\")))",
              value: "2026-05",
              display: "2026-05",
            },
          },
        },
      ],
    };
    const captured: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M10: {
              formula: "LET(start,N4,n,N5,months,EDATE(start,SEQUENCE(1,n,0)),VSTACK(TEXT(months,\"yyyy-mm\")))",
              value: "#NAME?",
              display: "#NAME?",
            },
          },
        },
      ],
    };

    const result = preserveImportedFormulaCachedValues(previous, captured);

    expect(result.sheets[0].cells.M10).toEqual({
      formula: "LET(start,N4,n,N5,months,EDATE(start,SEQUENCE(1,n,0)),VSTACK(TEXT(months,\"yyyy-mm\")))",
      value: "2026-05",
      display: "2026-05",
    });
  });

  it("does not hide a changed user formula error", () => {
    const previous: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M10: {
              formula: "SUM(A1:A2)",
              value: 3,
              display: "3",
            },
          },
        },
      ],
    };
    const captured: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M10: {
              formula: "LET(x,1,x)",
              value: "#NAME?",
              display: "#NAME?",
            },
          },
        },
      ],
    };

    const result = preserveImportedFormulaCachedValues(previous, captured);

    expect(result.sheets[0].cells.M10).toEqual(captured.sheets[0].cells.M10);
  });

  it("retains the imported formula when the editor was hydrated with the cached value only", () => {
    const previous: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M10: {
              formula: "LET(x,SEQUENCE(1,3),HSTACK(x))",
              value: "合同 ID",
              display: "合同 ID",
            },
          },
        },
      ],
    };
    const captured: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M10: {
              formula: null,
              value: "合同 ID",
              display: "合同 ID",
            },
          },
        },
      ],
    };

    const result = preserveImportedFormulaCachedValues(previous, captured);

    expect(result.sheets[0].cells.M10).toEqual({
      formula: "LET(x,SEQUENCE(1,3),HSTACK(x))",
      value: "合同 ID",
      display: "合同 ID",
    });
  });
});
