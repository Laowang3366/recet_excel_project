import { describe, expect, it } from "vitest";
import type { IWorkbookData } from "@univerjs/core";
import { extractRangeAnswerSnapshot } from "./excel";
import { captureUniverWorkbookSnapshot, univerDataToWorkbookSnapshot, type UniverWorkbookSnapshotSource } from "./univer-workbook";

describe("univerDataToWorkbookSnapshot", () => {
  it("reconstructs fill-down formulas stored as shared formula ids", () => {
    const snapshot = univerDataToWorkbookSnapshot({
      sheetOrder: ["sheet-1"],
      sheets: {
        "sheet-1": {
          name: "Sheet1",
          rowCount: 20,
          columnCount: 10,
          cellData: {
            1: {
              1: { v: 4, f: "=A2*2", si: "formula-fill-1" },
            },
            2: {
              1: { v: 6, si: "formula-fill-1" },
            },
            3: {
              1: { v: 8, si: "formula-fill-1" },
            },
          },
        },
      },
    } as unknown as IWorkbookData, {
      moveFormulaRefOffset: (formula, colOffset, rowOffset) => {
        expect(colOffset).toBe(0);
        if (rowOffset === 0) return formula;
        return `=A${2 + rowOffset}*2`;
      },
    });

    const sheet = snapshot.sheets[0];
    expect(sheet.cells.B2.formula).toBe("A2*2");
    expect(sheet.cells.B3.formula).toBe("A3*2");
    expect(sheet.cells.B4.formula).toBe("A4*2");
    expect(extractRangeAnswerSnapshot(snapshot, "Sheet1", "B2:B4").formulas).toEqual([
      ["A2*2"],
      ["A3*2"],
      ["A4*2"],
    ]);
  });

  it("captures dynamic array spill values from the live facade range", () => {
    const values = Array.from({ length: 20 }, () => Array.from({ length: 10 }, () => null as unknown));
    const displays = Array.from({ length: 20 }, () => Array.from({ length: 10 }, () => ""));
    const formulas = Array.from({ length: 20 }, () => Array.from({ length: 10 }, () => ""));
    values[1][1] = "A";
    values[1][2] = 1;
    values[2][1] = "B";
    values[2][2] = 2;
    displays[1][1] = "A";
    displays[1][2] = "1";
    displays[2][1] = "B";
    displays[2][2] = "2";
    formulas[1][1] = "=FILTER(A1:B9,A1:A9<>\"\")";

    const snapshot = captureUniverWorkbookSnapshot({
      save: () => ({
        sheetOrder: ["sheet-1"],
        sheets: {
          "sheet-1": {
            name: "Sheet1",
            rowCount: 20,
            columnCount: 10,
            cellData: {
              1: {
                1: { f: "=FILTER(A1:B9,A1:A9<>\"\")", v: "A" },
              },
            },
          },
        },
      } as unknown as IWorkbookData),
      getSheets: () => [
        {
          getSheetName: () => "Sheet1",
          getLastRow: () => 2,
          getLastColumn: () => 2,
          getRange: (_row, _column, numRows, numColumns) => {
            expect(numRows).toBe(20);
            expect(numColumns).toBe(10);
            return {
              getValues: () => values,
              getDisplayValues: () => displays,
              getFormulas: () => formulas,
            };
          },
        },
      ],
    } satisfies UniverWorkbookSnapshotSource);

    const sheet = snapshot.sheets[0];
    expect(extractRangeAnswerSnapshot(snapshot, "Sheet1", "B2:C3").values).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
    expect(sheet.cells.B2.formula).toBe("FILTER(A1:B9,A1:A9<>\"\")");
    expect(sheet.cells.C2.formula).toBeUndefined();
    expect(sheet.cells.B3.formula).toBeUndefined();
    expect(sheet.cells.C3.formula).toBeUndefined();
  });

  it("normalizes Excel compatibility prefixes in captured formulas", () => {
    const snapshot = univerDataToWorkbookSnapshot({
      sheetOrder: ["sheet-1"],
      sheets: {
        "sheet-1": {
          name: "Sheet1",
          rowCount: 20,
          columnCount: 12,
          cellData: {
            5: {
              10: { v: 46113 },
            },
            6: {
              10: {
                v: "#NAME?",
                f: "=_xlfn.LET(_xlpm.m,K6,_xlpm.r,L6,_xlws.FILTER(A1:A9,A1:A9<>\"\"),_xlpm.m)",
              },
            },
          },
        },
      },
    } as unknown as IWorkbookData);

    const sheet = snapshot.sheets[0];
    expect(sheet.cells.K7.formula).toBe("LET(m,K6,r,L6,FILTER(A1:A9,A1:A9<>\"\"),m)");
    expect(extractRangeAnswerSnapshot(snapshot, "Sheet1", "K7").formulas).toEqual([[
      "LET(m,K6,r,L6,FILTER(A1:A9,A1:A9<>\"\"),m)",
    ]]);
  });

  it("keeps number format metadata for formatted date cells", () => {
    const snapshot = univerDataToWorkbookSnapshot({
      sheetOrder: ["sheet-1"],
      sheets: {
        "sheet-1": {
          name: "Sheet1",
          rowCount: 20,
          columnCount: 12,
          cellData: {
            9: {
              0: {
                v: 46083,
                s: { n: { pattern: "yyyy-mm-dd" } },
              },
            },
          },
        },
      },
    } as unknown as IWorkbookData);

    expect(snapshot.sheets[0].cells.A10.value).toBe(46083);
    expect(snapshot.sheets[0].cells.A10.numberFormat).toBe("yyyy-mm-dd");
  });
});
