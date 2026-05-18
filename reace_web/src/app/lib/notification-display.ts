export type NotificationTabId = "all" | "points" | "announcements";

export type NotificationCountKey = NotificationTabId | "legacy";

export type NotificationCounts = Partial<Record<NotificationCountKey, number>>;

const legacyNotificationTypes = [
  "follow",
  "level_up",
  "reply",
  "like",
  "favorite",
  "MENTION",
  "message",
  "post_deleted",
  "reply_deleted",
  "report_delete",
  "post_review",
  "review_request",
];

const hiddenNotificationTypes = new Set(legacyNotificationTypes);

const visibleNotificationTypes = [
  "system",
  "site_notification",
  "feedback_result",
];

export const notificationFilterTabs: Array<{
  id: NotificationTabId;
  label: string;
  countKey: NotificationCountKey;
}> = [
  { id: "all", label: "全部通知", countKey: "all" },
  { id: "points", label: "积分通知", countKey: "points" },
  { id: "announcements", label: "网站公告", countKey: "announcements" },
];

const visibleNotificationTabIds = new Set(notificationFilterTabs.map((tab) => tab.id));

export function normalizeNotificationTab(tab: string | null | undefined): NotificationTabId {
  return visibleNotificationTabIds.has(tab as NotificationTabId) ? (tab as NotificationTabId) : "all";
}

export function getNotificationTabCount(
  tab: Pick<(typeof notificationFilterTabs)[number], "countKey">,
  counts?: NotificationCounts,
) {
  if (tab.countKey === "all") {
    return getVisibleNotificationCount(counts);
  }
  return counts?.[tab.countKey] ?? 0;
}

export function getVisibleNotificationCount(counts?: NotificationCounts) {
  return Math.max(0, (counts?.all ?? 0) - (counts?.legacy ?? 0));
}

export function shouldRenderNotificationItem(type: string | null | undefined) {
  return !hiddenNotificationTypes.has(String(type || ""));
}

export function getVisibleNotificationTypeFilter() {
  return visibleNotificationTypes.join(",");
}

export function getHiddenNotificationTypeFilter() {
  return Array.from(hiddenNotificationTypes).join(",");
}

export function shouldRenderNotificationCategoryOverview() {
  return false;
}
