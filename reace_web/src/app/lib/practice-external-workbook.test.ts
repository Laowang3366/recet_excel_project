import { describe, expect, it } from "vitest";
import { buildExcelDesktopUri, resolveAbsoluteDownloadUrl, sanitizeWorkbookFileName } from "./practice-external-workbook";

describe("practice external workbook helpers", () => {
  it("builds an Excel desktop URI from an absolute download URL", () => {
    const uri = buildExcelDesktopUri("https://www.excelcc.cn/api/practice/questions/9/file/excelcc-practice-question.xlsx?ticket=abc");

    expect(uri).toBe("ms-excel:ofv|u|https://www.excelcc.cn/api/practice/questions/9/file/excelcc-practice-question.xlsx?ticket=abc");
  });

  it("sanitizes question titles into xlsx file names", () => {
    expect(sanitizeWorkbookFileName("SUM / 汇总: 一季度销售额")).toBe("SUM-汇总-一季度销售额.xlsx");
    expect(sanitizeWorkbookFileName("")).toBe("excelcc-practice-question.xlsx");
  });

  it("only resolves same-origin practice workbook download urls", () => {
    expect(resolveAbsoluteDownloadUrl(
      "/api/practice/questions/9/file/excelcc-practice-question.xlsx?ticket=abc",
      "https://www.excelcc.cn"
    )).toBe("https://www.excelcc.cn/api/practice/questions/9/file/excelcc-practice-question.xlsx?ticket=abc");

    expect(() => resolveAbsoluteDownloadUrl("https://evil.example/file.xlsx", "https://www.excelcc.cn")).toThrow();
    expect(() => resolveAbsoluteDownloadUrl("/uploads/private/probe.xlsx", "https://www.excelcc.cn")).toThrow();
    expect(() => resolveAbsoluteDownloadUrl("javascript:alert(1)", "https://www.excelcc.cn")).toThrow();
  });
});
