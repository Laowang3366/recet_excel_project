import { ApiError } from "./api";

export function getAssistantErrorMessage(error: unknown, fallback = "AI 助手暂时不可用") {
  if (error instanceof ApiError) {
    if (error.status === 504) {
      return "AI 助手响应超时，请稍后重试或缩短问题内容";
    }
    if (error.status === 502 || error.status === 503) {
      return "AI 助手服务繁忙，请稍后再试";
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
