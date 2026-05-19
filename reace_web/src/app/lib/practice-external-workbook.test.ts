import { describe, expect, it } from "vitest";
import { buildExcelDesktopUri, sanitizeWorkbookFileName } from "./practice-external-workbook";

describe("practice external workbook helpers", () => {
  it("builds an Excel desktop URI from an absolute download URL", () => {
    const uri = buildExcelDesktopUri("https://www.excelcc.cn/api/practice/questions/9/file?ticket=abc");

    expect(uri).toBe("ms-excel:ofe|u|https://www.excelcc.cn/api/practice/questions/9/file?ticket=abc");
  });

  it("sanitizes question titles into xlsx file names", () => {
    expect(sanitizeWorkbookFileName("SUM / 汇总: 一季度销售额")).toBe("SUM-汇总-一季度销售额.xlsx");
    expect(sanitizeWorkbookFileName("")).toBe("excelcc-practice-question.xlsx");
  });
});
