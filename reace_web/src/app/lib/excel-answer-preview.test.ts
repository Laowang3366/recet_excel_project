import { describe, expect, it } from "vitest";
import {
  convertWorkbookSelectionToDateFormat,
  extractDateAwareRangeAnswerSnapshot,
  extractStoredAnswerSnapshot,
  extractRangeAnswerSnapshot,
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
    expect(formatAnswerPreviewCellDisplay(46122, "", "2026-04-10")).toBe("2026-04-10");
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

  it("converts only date columns inside a selected answer table", () => {
    const workbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M10: { value: "日期", display: "日期" },
            N10: { value: "订单号", display: "订单号" },
            O10: { value: "客户", display: "客户" },
            P10: { value: "销售额", display: "销售额" },
            Q10: { value: "渠道", display: "渠道" },
            M11: { value: 46115, display: "2026-04-03" },
            N11: { value: "SO1003", display: "SO1003" },
            O11: { value: "禾田餐饮", display: "禾田餐饮" },
            P11: { value: 30600, display: "30600" },
            Q11: { value: "官网", display: "官网" },
            M12: { value: 46122, display: "46122" },
            N12: { value: "SO1010", display: "SO1010" },
            O12: { value: "北辰贸易", display: "北辰贸易" },
            P12: { value: 27800, display: "27800" },
            Q12: { value: "官网", display: "官网" },
          },
        },
      ],
    };

    const result = convertWorkbookSelectionToDateFormat(workbook, {
      sheetName: "Sheet1",
      startRow: 11,
      startCol: 13,
      endRow: 12,
      endCol: 17,
    });

    expect(result.changed).toBe(2);
    expect(result.workbook.sheets[0].cells.M11).toMatchObject({
      value: 46115,
      display: "2026-04-03",
      numberFormat: "yyyy-mm-dd",
    });
    expect(result.workbook.sheets[0].cells.M12).toMatchObject({
      value: 46122,
      display: "2026-04-10",
      numberFormat: "yyyy-mm-dd",
    });
    expect(result.workbook.sheets[0].cells.P11).toMatchObject({
      value: 30600,
      display: "30600",
    });
    expect(result.workbook.sheets[0].cells.P12).toMatchObject({
      value: 27800,
      display: "27800",
    });
  });

  it("extracts answer snapshot display metadata for date cells", () => {
    const workbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M11: { value: 46115, display: "2026-04-03", numberFormat: "yyyy-mm-dd" },
            M12: { value: 46122, display: "2026-04-10", numberFormat: "yyyy-mm-dd" },
          },
        },
      ],
    };

    const snapshot = extractRangeAnswerSnapshot(workbook, "Sheet1", "M11:M12");

    expect(snapshot.values).toEqual([[46115], [46122]]);
    expect(snapshot.displays).toEqual([["2026-04-03"], ["2026-04-10"]]);
    expect(snapshot.numberFormats).toEqual([["yyyy-mm-dd"], ["yyyy-mm-dd"]]);
  });

  it("extracts date-aware answer preview without converting adjacent numeric columns", () => {
    const workbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M10: { value: "日期", display: "日期" },
            N10: { value: "订单号", display: "订单号" },
            O10: { value: "客户", display: "客户" },
            P10: { value: "销售额", display: "销售额" },
            Q10: { value: "渠道", display: "渠道" },
            M11: { value: 46115, display: "2026-04-03" },
            N11: { value: "SO1003", display: "SO1003" },
            O11: { value: "禾田餐饮", display: "禾田餐饮" },
            P11: { value: 30600, display: "30600" },
            Q11: { value: "官网", display: "官网" },
            M12: { value: 46122, display: "46122" },
            N12: { value: "SO1010", display: "SO1010" },
            O12: { value: "北辰贸易", display: "北辰贸易" },
            P12: { value: 27800, display: "27800" },
            Q12: { value: "官网", display: "官网" },
          },
        },
      ],
    };

    const snapshot = extractDateAwareRangeAnswerSnapshot(workbook, "Sheet1", "M11:Q12");

    expect(snapshot.displays?.[1]?.[0]).toBe("2026-04-10");
    expect(snapshot.numberFormats?.[1]?.[0]).toBe("yyyy-mm-dd");
    expect(snapshot.displays?.[1]?.[3]).toBe("27800");
    expect(snapshot.numberFormats?.[1]?.[3]).toBe("");
  });

  it("uses stored dynamic-array answer snapshots for readonly preview", () => {
    const snapshot = extractStoredAnswerSnapshot(JSON.stringify({
      values: [["张敏", "硬件"], ["王悦", "硬件"]],
      formulas: [["LET(ids,FILTER(A1:A9,A1:A9<>\"\"),ids)", ""], ["", ""]],
      displays: [["张敏", "硬件"], ["王悦", "硬件"]],
      numberFormats: [["", ""], ["", ""]],
    }), "Sheet1", "K10:L11");

    expect(snapshot.values).toEqual([["张敏", "硬件"], ["王悦", "硬件"]]);
    expect(snapshot.formulas?.[0]?.[0]).toBe("LET(ids,FILTER(A1:A9,A1:A9<>\"\"),ids)");
    expect(snapshot.displays?.[1]?.[1]).toBe("硬件");
  });
});
