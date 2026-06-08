import { describe, expect, it } from "vitest";
import { renderRichContent, sanitizeRichHtml } from "./rich-content";

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

  it("removes dangerous markdown link and image targets", () => {
    const html = renderRichContent(`
      [unsafe link](javascript:alert(1))
      ![unsafe image](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMik+)
    `);

    expect(html).toContain("unsafe link");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("src=");
  });
});
