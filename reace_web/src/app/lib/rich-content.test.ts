import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "./rich-content";

describe("sanitizeRichHtml", () => {
  it("removes script tags, inline handlers, and javascript urls", () => {
    const html = sanitizeRichHtml(`
      <p onclick="alert(1)">通知内容</p>
      <script>alert(1)</script>
      <a href="javascript:alert(2)">危险链接</a>
      <img src="/uploads/pic.png" onerror="alert(3)" />
    `);

    expect(html).toContain("通知内容");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("src=\"/uploads/pic.png\"");
  });
});
