import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvCell } from "./csv";

describe("csv export helpers", () => {
  it("quotes cells and neutralizes spreadsheet formulas", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell('hello "excel"')).toBe('"hello ""excel"""');
    expect(escapeCsvCell("=cmd|' /C calc'!A0")).toBe("\"'=cmd|' /C calc'!A0\"");
    expect(escapeCsvCell("+SUM(1,2)")).toBe("\"'+SUM(1,2)\"");
    expect(escapeCsvCell("-10")).toBe("\"'-10\"");
    expect(escapeCsvCell("@HYPERLINK(\"https://evil.example\")")).toBe("\"'@HYPERLINK(\"\"https://evil.example\"\")\"");
    expect(escapeCsvCell("\t=cmd")).toBe("\"'\t=cmd\"");
  });

  it("builds rows with shared escaping rules", () => {
    expect(buildCsv([["name", "summary"], ["alice", "=unsafe"]])).toBe("name,summary\nalice,\"'=unsafe\"");
  });
});
