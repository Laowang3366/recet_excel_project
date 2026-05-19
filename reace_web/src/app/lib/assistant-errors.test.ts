import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { getAssistantErrorMessage } from "./assistant-errors";

describe("getAssistantErrorMessage", () => {
  it("turns assistant gateway timeout html into a short user message", () => {
    const error = new ApiError("<html><title>504 Gateway Time-out</title></html>", 504, "<html></html>");

    expect(getAssistantErrorMessage(error)).toBe("AI 助手响应超时，请稍后重试或缩短问题内容");
  });
});
