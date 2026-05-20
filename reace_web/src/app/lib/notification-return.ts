const NOTIFICATION_HOME = "/notifications";

function isNotificationPath(path: string) {
  return path === NOTIFICATION_HOME
    || path.startsWith(`${NOTIFICATION_HOME}?`)
    || path.startsWith(`${NOTIFICATION_HOME}#`)
    || path.startsWith("/notification/");
}

function normalizeLocalReturnTarget(rawTarget: string | null | undefined, fallback: string) {
  const target = rawTarget || fallback || "/";
  try {
    const decoded = decodeURIComponent(target);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback || "/";
    if (/^[a-z][a-z\d+\-.]*:/i.test(decoded)) return fallback || "/";
    if (isNotificationPath(decoded)) return fallback || "/";
    return decoded;
  } catch {
    return fallback || "/";
  }
}

export function resolveNotificationReturnTarget(search: string | URLSearchParams, fallback = "/") {
  const params = typeof search === "string"
    ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    : search;
  return normalizeLocalReturnTarget(params.get("returnTo"), fallback);
}

export function buildNotificationReturnPath(returnTo: string, notificationPath = NOTIFICATION_HOME) {
  const normalizedReturnTo = normalizeLocalReturnTarget(returnTo, "/");
  const [pathWithSearch, hash = ""] = notificationPath.split("#", 2);
  const [path, search = ""] = pathWithSearch.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("returnTo", normalizedReturnTo);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}
