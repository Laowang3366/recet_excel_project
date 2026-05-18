import { describe, expect, it } from "vitest";
import type { ExcelWorkbookSnapshot } from "./excel";
import { buildFastWorkbookGridRows, isCellInSelection } from "./fast-workbook-editor";

describe("fast workbook editor fallback", () => {
  const workbook: ExcelWorkbookSnapshot = {
    sheets: [
      {
        name: "练习",
        rowCount: 4,
        columnCount: 5,
        cells: {
          A1: { value: "部门", display: "部门" },
          E2: { formula: "COUNTA(A2:D2)-COUNTBLANK(A2:D2)", display: "=COUNTA(A2:D2)-COUNTBLANK(A2:D2)" },
        },
      },
    ],
  };

  it("keeps answer cells immediately editable while the heavy editor loads", () => {
    const rows = buildFastWorkbookGridRows(workbook, "练习", {
      sheetName: "练习",
      startRow: 2,
      startCol: 5,
      endRow: 4,
      endCol: 5,
    });

    const flatCells = rows.flatMap((row) => row.cells);
    expect(flatCells.find((cell) => cell.ref === "E2")).toMatchObject({
      editable: true,
      inputValue: "=COUNTA(A2:D2)-COUNTBLANK(A2:D2)",
    });
    expect(flatCells.find((cell) => cell.ref === "A1")).toMatchObject({
      editable: false,
      displayValue: "部门",
    });
    expect(rows).toHaveLength(4);
    expect(rows[0].cells).toHaveLength(5);
  });

  it("treats every cell as editable when no answer range is provided", () => {
    expect(isCellInSelection(null, 20, 8)).toBe(true);
  });
});
