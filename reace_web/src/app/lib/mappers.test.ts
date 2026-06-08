import { describe, expect, it } from "vitest";
import { normalizeAvatarUrl, normalizeResourceUrl } from "./mappers";

describe("resource url mappers", () => {
  it("normalizes safe local and http resources", () => {
    expect(normalizeResourceUrl("/uploads/pic.png")).toBe("/uploads/pic.png");
    expect(normalizeResourceUrl("images/pic.png")).toBe("images/pic.png");
    expect(normalizeResourceUrl("https://www.excelcc.cn/uploads/pic.png")).toBe("https://www.excelcc.cn/uploads/pic.png");
  });

  it("rejects dangerous resource protocols", () => {
    expect(normalizeResourceUrl("javascript:alert(1)")).toBe("");
    expect(normalizeResourceUrl(" java\nscript:alert(1)")).toBe("");
    expect(normalizeResourceUrl("vbscript:msgbox(1)")).toBe("");
    expect(normalizeResourceUrl("data:image/svg+xml;base64,PHN2Zy8+")).toBe("");
    expect(normalizeResourceUrl("//evil.example/pic.png")).toBe("");
  });

  it("keeps generated avatar fallbacks when explicit avatars are unsafe", () => {
    expect(normalizeAvatarUrl("javascript:alert(1)", "excel")).toContain("data:image/svg+xml");
  });
});
