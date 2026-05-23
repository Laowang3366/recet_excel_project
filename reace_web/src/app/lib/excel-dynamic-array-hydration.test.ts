import { describe, expect, it } from "vitest";
import { buildWorkbookWithAnswerSnapshot, clearInferredDynamicArraySpillChildren, type ExcelWorkbookSnapshot } from "./excel";

describe("buildWorkbookWithAnswerSnapshot dynamic arrays", () => {
  it("keeps only the anchor formula when hydrating a dynamic array spill range", () => {
    const templateWorkbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          rowCount: 20,
          columnCount: 8,
          cells: {
            A1: { value: "No." },
            A3: { value: "stale spill value" },
          },
        },
      ],
    };

    const next = buildWorkbookWithAnswerSnapshot(
      templateWorkbook,
      "Sheet1",
      "A2:A5",
      JSON.stringify({
        values: [[1], [2], [3], [4]],
        formulas: [["SEQUENCE(4)"], [""], [""], [""]],
      }),
      {
        dynamicArrayRules: [
          {
            sheet: "Sheet1",
            anchorCell: "A2",
            spillRange: "A2:A5",
          },
        ],
      },
    );

    expect(next.sheets[0].cells.A2).toMatchObject({
      formula: "SEQUENCE(4)",
      display: "=SEQUENCE(4)",
    });
    expect(next.sheets[0].cells.A3).toBeUndefined();
    expect(next.sheets[0].cells.A4).toBeUndefined();
    expect(next.sheets[0].cells.A5).toBeUndefined();
    expect(next.sheets[0].cells.A1).toMatchObject({ value: "No." });
  });

  it("clears stale spill child values even before an answer snapshot exists", () => {
    const templateWorkbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            A2: { formula: "SEQUENCE(4)", value: 1, display: "1" },
            A3: { value: 2, display: "2" },
            A4: { value: 3, display: "3" },
            A5: { value: 4, display: "4" },
          },
        },
      ],
    };

    const next = buildWorkbookWithAnswerSnapshot(templateWorkbook, "Sheet1", "A2:A5", "", {
      dynamicArrayRules: [
        {
          sheet: "Sheet1",
          anchorCell: "A2",
          spillRange: "A2:A5",
        },
      ],
    });

    expect(next.sheets[0].cells.A2).toMatchObject({ formula: "SEQUENCE(4)" });
    expect(next.sheets[0].cells.A3).toBeUndefined();
    expect(next.sheets[0].cells.A4).toBeUndefined();
    expect(next.sheets[0].cells.A5).toBeUndefined();
  });

  it("can preserve spill child values for admin template preview", () => {
    const templateWorkbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            A2: { formula: "SEQUENCE(4)", value: 1, display: "1" },
            A3: { value: 2, display: "2" },
            A4: { value: 3, display: "3" },
            A5: { value: 4, display: "4" },
          },
        },
      ],
    };

    const next = buildWorkbookWithAnswerSnapshot(templateWorkbook, "Sheet1", "A2:A5", "", {
      dynamicArrayRules: [
        {
          sheet: "Sheet1",
          anchorCell: "A2",
          spillRange: "A2:A5",
        },
      ],
      preserveDynamicArraySpillChildren: true,
    });

    expect(next.sheets[0].cells.A2).toMatchObject({ formula: "SEQUENCE(4)" });
    expect(next.sheets[0].cells.A3).toMatchObject({ value: 2, display: "2" });
    expect(next.sheets[0].cells.A4).toMatchObject({ value: 3, display: "3" });
    expect(next.sheets[0].cells.A5).toMatchObject({ value: 4, display: "4" });
  });

  it("does not write saved answer spill values back into spill child cells", () => {
    const templateWorkbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            A2: { formula: "SEQUENCE(4)", value: 1, display: "1" },
            A3: { value: 2, display: "2" },
            A4: { value: 3, display: "3" },
            A5: { value: 4, display: "4" },
          },
        },
      ],
    };

    const next = buildWorkbookWithAnswerSnapshot(
      templateWorkbook,
      "Sheet1",
      "A2:A5",
      JSON.stringify({
        values: [[1], [2], [3], [4]],
        formulas: [["SEQUENCE(4)"], [""], [""], [""]],
        displays: [["1"], ["2"], ["3"], ["4"]],
      }),
      {
        dynamicArrayRules: [
          {
            sheet: "Sheet1",
            anchorCell: "A2",
            spillRange: "A2:A5",
          },
        ],
        preserveDynamicArraySpillChildren: true,
      },
    );

    expect(next.sheets[0].cells.A2).toMatchObject({
      formula: "SEQUENCE(4)",
      display: "=SEQUENCE(4)",
    });
    expect(next.sheets[0].cells.A3).toBeUndefined();
    expect(next.sheets[0].cells.A4).toBeUndefined();
    expect(next.sheets[0].cells.A5).toBeUndefined();
  });

  it("keeps the template anchor formula when a stored dynamic answer snapshot only has cached values", () => {
    const templateWorkbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            M11: {
              formula: "LET(ids,A11:A17,FILTER(ids,ids<>\"\"))",
              value: "U714",
              display: "U714",
            },
            M12: { value: "U715", display: "U715" },
          },
        },
      ],
    };

    const next = buildWorkbookWithAnswerSnapshot(
      templateWorkbook,
      "Sheet1",
      "M11:R17",
      JSON.stringify({
        values: [["U714", "张三"], ["U715", "李四"]],
        formulas: [["", ""], ["", ""]],
        displays: [["U714", "张三"], ["U715", "李四"]],
      }),
      {
        dynamicArrayRules: [
          {
            sheet: "Sheet1",
            anchorCell: "M11",
            spillRange: "M11:R17",
          },
        ],
        preserveDynamicArraySpillChildren: true,
      },
    );

    expect(next.sheets[0].cells.M11).toMatchObject({
      formula: "LET(ids,A11:A17,FILTER(ids,ids<>\"\"))",
      value: "U714",
      display: "U714",
    });
    expect(next.sheets[0].cells.N11).toBeUndefined();
    expect(next.sheets[0].cells.M12).toBeUndefined();
  });

  it("clears inferred cached spill children before editor rehydration", () => {
    const workbook: ExcelWorkbookSnapshot = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            K9: { value: "销售员", display: "销售员" },
            K10: {
              value: "张敏",
              formula: "LET(keys,UNIQUE(FILTER(HSTACK(C10:C33,D10:D33),B10:B33=L6)),TAKE(SORTBY(keys,CHOOSECOLS(keys,1),-1),5))",
              display: "张敏",
            },
            L10: { value: "硬件", display: "硬件" },
            M10: { value: 64000, display: "64000" },
            K11: { value: "王悦", display: "王悦" },
            L11: { value: "硬件", display: "硬件" },
            M11: { value: 56000, display: "56000" },
            A10: { value: 46083, display: "46083" },
            B10: { value: "华东", display: "华东" },
          },
        },
      ],
    };

    const next = clearInferredDynamicArraySpillChildren(workbook);

    expect(next.sheets[0].cells.K10).toMatchObject({ formula: expect.stringContaining("HSTACK") });
    expect(next.sheets[0].cells.K9).toMatchObject({ value: "销售员" });
    expect(next.sheets[0].cells.A10).toMatchObject({ value: 46083 });
    expect(next.sheets[0].cells.L10).toBeUndefined();
    expect(next.sheets[0].cells.M10).toBeUndefined();
    expect(next.sheets[0].cells.K11).toBeUndefined();
    expect(next.sheets[0].cells.L11).toBeUndefined();
    expect(next.sheets[0].cells.M11).toBeUndefined();
  });
});
