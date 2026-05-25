import { describe, expect, it } from "vitest";
import {
  buildNotificationPayload,
  getNotificationReachEstimate,
  getNotificationTargetLabel,
  parseNotificationMeta,
  serializeNotificationMeta,
} from "./notification-form";

describe("notification admin form helpers", () => {
  it("keeps action controls in attachments without losing the core payload fields", () => {
    const payload = buildNotificationPayload(
      {
        title: "AI 助手升级通知",
        content: "新的模型配置已上线。",
        type: "announcement",
        status: "draft",
        targetType: "all",
        targetRoles: "",
        attachments: "",
      },
      { actionText: "立即查看", actionUrl: "https://www.excelcc.cn/tools", scheduled: true, sendAt: "2026-05-26T10:00" },
      "sent",
    );

    expect(payload.status).toBe("sent");
    expect(payload.title).toBe("AI 助手升级通知");
    expect(parseNotificationMeta(payload.attachments)).toMatchObject({
      actionText: "立即查看",
      actionUrl: "https://www.excelcc.cn/tools",
      scheduled: true,
      sendAt: "2026-05-26T10:00",
    });
  });

  it("falls back to safe notification meta defaults for old records", () => {
    expect(parseNotificationMeta("not-json")).toMatchObject({
      actionText: "立即查看",
      actionUrl: "",
      scheduled: false,
      pinned: false,
    });
    expect(serializeNotificationMeta({ actionText: "查看详情" })).toContain("查看详情");
  });

  it("builds confirmation copy from target and stats", () => {
    expect(getNotificationTargetLabel("role", "admin,user")).toBe("管理员、普通用户");
    expect(getNotificationTargetLabel("all", "")).toBe("全体用户");
    expect(getNotificationReachEstimate({ totalUsers: 2386 }, "all")).toBe(2386);
  });
});
