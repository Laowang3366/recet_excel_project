import { describe, expect, it } from "vitest";
import { normalizeApiErrorMessage } from "./api";

describe("normalizeApiErrorMessage", () => {
  it("does not expose nginx html error pages to users", () => {
    const html = `<html>
<head><title>504 Gateway Time-out</title></head>
<body><center><h1>504 Gateway Time-out</h1></center></body>
</html>`;

    expect(normalizeApiErrorMessage(html, "请求失败(504)")).toBe("请求失败(504)");
  });

  it("keeps readable plain text backend errors", () => {
    expect(normalizeApiErrorMessage("参数错误", "请求失败")).toBe("参数错误");
  });
});
