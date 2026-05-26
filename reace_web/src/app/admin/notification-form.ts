import type { AdminNotificationForm, AdminNotificationStats } from "../pages/AdminConsoleTypes";
import { ROLE_OPTIONS } from "./shared";

export type NotificationMeta = {
  actionText?: string;
  actionUrl?: string;
  scheduled?: boolean;
  sendAt?: string;
  pinned?: boolean;
};

export const DEFAULT_NOTIFICATION_META: Required<NotificationMeta> = {
  actionText: "立即查看",
  actionUrl: "",
  scheduled: false,
  sendAt: "",
  pinned: false,
};

export function parseNotificationMeta(raw?: string | null): Required<NotificationMeta> {
  if (!raw) return { ...DEFAULT_NOTIFICATION_META };
  try {
    const parsed = JSON.parse(raw) as NotificationMeta | null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_NOTIFICATION_META };
    return normalizeNotificationMeta(parsed);
  } catch {
    return { ...DEFAULT_NOTIFICATION_META };
  }
}

export function serializeNotificationMeta(meta: NotificationMeta) {
  return JSON.stringify(normalizeNotificationMeta(meta));
}

export function buildNotificationPayload(
  form: AdminNotificationForm,
  meta: NotificationMeta,
  statusOverride?: string,
): AdminNotificationForm {
  const normalizedMeta = normalizeNotificationMeta(meta);
  const scheduledTime = normalizedMeta.scheduled && normalizedMeta.sendAt ? normalizeDateTimeLocal(normalizedMeta.sendAt) : null;
  const status = statusOverride === "sent" && scheduledTime ? "scheduled" : statusOverride || form.status || "draft";
  return {
    ...form,
    status,
    targetRoles: form.targetType === "role" ? form.targetRoles : "",
    targetUserIds: form.targetType === "user" ? normalizeTargetUserIds(form.targetUserIds) : "",
    attachments: serializeNotificationMeta(normalizedMeta),
    scheduledTime: status === "scheduled" ? scheduledTime : null,
    pinned: normalizedMeta.pinned,
  };
}

export function getNotificationTargetLabel(targetType?: string | null, targetRoles?: string | null, targetUserIds?: string | null) {
  if (targetType === "user") {
    const count = countTargetUsers(targetUserIds);
    return count > 0 ? `指定用户 ${count} 人` : "指定用户";
  }
  if (targetType !== "role") return "全体用户";
  const labels = String(targetRoles || "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
    .map((role) => ROLE_OPTIONS.find((item) => item.value === role)?.label || role);
  return labels.length > 0 ? labels.join("、") : "指定角色";
}

export function getNotificationReachEstimate(
  stats: AdminNotificationStats | null | undefined,
  targetType?: string | null,
  targetUserIds?: string | null,
) {
  const totalUsers = Number(stats?.totalUsers || 0);
  if (targetType === "user") {
    return countTargetUsers(targetUserIds);
  }
  if (targetType === "role") {
    return Math.max(1, Math.round(totalUsers * 0.35));
  }
  return totalUsers;
}

function normalizeNotificationMeta(meta: NotificationMeta): Required<NotificationMeta> {
  return {
    actionText: String(meta.actionText || DEFAULT_NOTIFICATION_META.actionText).trim().slice(0, 10) || DEFAULT_NOTIFICATION_META.actionText,
    actionUrl: String(meta.actionUrl || "").trim(),
    scheduled: Boolean(meta.scheduled),
    sendAt: String(meta.sendAt || "").trim(),
    pinned: Boolean(meta.pinned),
  };
}

function normalizeDateTimeLocal(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return trimmed.length === 16 ? `${trimmed}:00` : trimmed;
}

function normalizeTargetUserIds(value?: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^\d+$/.test(item) && Number(item) > 0)
    .filter((item, index, values) => values.indexOf(item) === index)
    .join(",");
}

function countTargetUsers(value?: string | null) {
  const normalized = normalizeTargetUserIds(value);
  return normalized ? normalized.split(",").length : 0;
}
