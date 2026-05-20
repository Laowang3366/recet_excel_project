import { describe, expect, it } from "vitest";
import {
  convertWorkbookSelectionToDateFormat,
  findMissingFormulaCellRefs,
  formatAnswerPreviewCellDisplay,
  getExcelCellErrorInfo,
  resolveExcelCellNumberFormat,
  type ExcelWorkbookSnapshot,
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
    expect(formatAnswerPreviewCellDisplay("#NAME?", "_xlfn.LET(_xlpm.ids,_xlws.FILTER(A1:A9,A1:A9<>\"\"),_xlpm.ids)")).toBe(
      "=LET(ids,FILTER(A1:A9,A1:A9<>\"\"),ids)",
    );
    expect(formatAnswerPreviewCellDisplay("_xlws.FILTER should stay inside text", "IF(A1=\"_xlws.FILTER\",1,0)")).toBe(
      "=IF(A1=\"_xlws.FILTER\",1,0)",
    );
  });

  it("infers date number formatting from an Excel serial with date display", () => {
    expect(resolveExcelCellNumberFormat({ value: 46083, display: "2026-03-02" })).toBe("yyyy-mm-dd");
    expect(resolveExcelCellNumberFormat({ value: 46083, display: "46083" })).toBe("");
  });

  it("identifies formula error cells with user-facing messages", () => {
    expect(getExcelCellErrorInfo({ value: "#NAME?", display: "#NAME?" })).toMatchObject({
      code: "#NAME?",
      title: "无效名称",
    });
    expect(getExcelCellErrorInfo({ value: 12, display: "12" })).toBeNull();
  });

  it("converts selected date-like cells to Excel date serial format", () => {
    const workbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            A1: { value: "2026-04-30", display: "2026-04-30" },
            A2: { value: 46142, display: "46142" },
            A3: { value: "not-date", display: "not-date" },
          },
        },
      ],
    };

    const result = convertWorkbookSelectionToDateFormat(workbook, {
      sheetName: "Sheet1",
      startRow: 1,
      startCol: 1,
      endRow: 3,
      endCol: 1,
    });

    expect(result.changed).toBe(2);
    expect(result.workbook.sheets[0].cells.A1).toMatchObject({
      value: 46142,
      display: "2026-04-30",
      numberFormat: "yyyy-mm-dd",
    });
    expect(result.workbook.sheets[0].cells.A2).toMatchObject({
      value: 46142,
      display: "2026-04-30",
      numberFormat: "yyyy-mm-dd",
    });
    expect(result.workbook.sheets[0].cells.A3).toMatchObject({
      value: "not-date",
      display: "not-date",
    });
  });
});
