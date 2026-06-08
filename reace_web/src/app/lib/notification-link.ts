export type NotificationActionTarget = {
  kind: "internal";
  path: string;
};

export function resolveSafeNotificationAction(rawTarget: string | null | undefined, origin = getCurrentOrigin()): NotificationActionTarget | null {
  const target = String(rawTarget || "").trim();
  if (!target || !origin || /[\u0000-\u001f\u007f\\]/.test(target)) {
    return null;
  }

  try {
    if (target.startsWith("/")) {
      if (target.startsWith("//")) {
        return null;
      }
      const parsed = new URL(target, origin);
      if (parsed.origin !== origin) {
        return null;
      }
      return { kind: "internal", path: toPath(parsed) };
    }

    const parsed = new URL(target);
    if (parsed.origin !== origin) {
      return null;
    }
    return { kind: "internal", path: toPath(parsed) };
  } catch {
    return null;
  }
}

function toPath(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`;
}

function getCurrentOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "";
}
