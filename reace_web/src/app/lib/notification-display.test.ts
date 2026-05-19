import { describe, expect, it } from "vitest";
import {
  getNotificationTabCount,
  getVisibleNotificationCount,
  getVisibleNotificationTypeFilter,
  normalizeNotificationTab,
  notificationFilterTabs,
  shouldRenderNotificationItem,
  shouldRenderNotificationCategoryOverview,
} from "./notification-display";

describe("notification display helpers", () => {
  it("does not render the large category overview before the notification list", () => {
    expect(shouldRenderNotificationCategoryOverview()).toBe(false);
  });

  it("keeps only current notification tabs", () => {
    expect(notificationFilterTabs.map((tab) => tab.id)).toEqual([
      "all",
      "points",
      "announcements",
    ]);
  });

  it("falls back to all notifications for removed or unknown tabs", () => {
    expect(normalizeNotificationTab("posts")).toBe("all");
    expect(normalizeNotificationTab("follows")).toBe("all");
    expect(normalizeNotificationTab("unknown")).toBe("all");
    expect(normalizeNotificationTab("points")).toBe("points");
  });

  it("renders only current notification types", () => {
    expect(shouldRenderNotificationItem("retired_activity")).toBe(false);
    expect(shouldRenderNotificationItem("site_notification")).toBe(true);
    expect(shouldRenderNotificationItem("qa_case_answered")).toBe(true);
    expect(getVisibleNotificationTypeFilter()).toBe("system,site_notification,feedback_result,qa_case_answered");
  });

  it("uses the backend visible count directly for the all tab", () => {
    expect(getVisibleNotificationCount({ all: 5 })).toBe(5);
    expect(getNotificationTabCount({ countKey: "all" }, { all: 2 })).toBe(2);
    expect(getNotificationTabCount({ countKey: "points" }, { points: 4 })).toBe(4);
  });
});
