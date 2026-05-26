import { describe, expect, it } from "vitest";
import { applyNotificationEditorCommand } from "./notification-rich-text";

describe("notification rich text editor helpers", () => {
  it("wraps the selected content for bold and italic toolbar actions", () => {
    expect(applyNotificationEditorCommand("模型升级", { start: 0, end: 2 }, "bold")).toMatchObject({
      content: "<strong>模型</strong>升级",
      cursor: 19,
    });
    expect(applyNotificationEditorCommand("模型升级", { start: 2, end: 4 }, "italic").content).toBe("模型<em>升级</em>");
  });

  it("inserts structured snippets for link and image toolbar actions", () => {
    expect(applyNotificationEditorCommand("", { start: 0, end: 0 }, "link").content).toBe('<a href="https://">链接文本</a>');
    expect(applyNotificationEditorCommand("", { start: 0, end: 0 }, "image").content).toBe('<img src="https://" alt="图片" />');
  });
});
