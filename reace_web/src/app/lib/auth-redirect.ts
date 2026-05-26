const AUTH_PATH = "/auth";
const FORCE_PASSWORD_CHANGE_PATH = "/force-password-change";
const HOME_PATH = "/";
const SAME_ORIGIN_BASE = "https://excelcc.local";

type LocationLike = Pick<Location, "pathname" | "search" | "hash">;

export function normalizeAuthRedirectTarget(target?: string | null) {
  const rawTarget = (target || "").trim();
  if (!rawTarget) return HOME_PATH;
  if (!rawTarget.startsWith("/") || rawTarget.startsWith("//")) return HOME_PATH;
  if (/^[a-z][a-z\d+\-.]*:/i.test(rawTarget)) return HOME_PATH;

  try {
    const url = new URL(rawTarget, SAME_ORIGIN_BASE);
    const normalized = `${url.pathname}${url.search}${url.hash}`;
    if (!normalized.startsWith("/") || normalized.startsWith("//")) return HOME_PATH;
    if (url.pathname === AUTH_PATH) return HOME_PATH;
    return normalized || HOME_PATH;
  } catch {
    return HOME_PATH;
  }
}

export function buildAuthRedirectPath(returnTo?: string | null) {
  const redirect = normalizeAuthRedirectTarget(returnTo);
  const params = new URLSearchParams({ redirect });
  return `${AUTH_PATH}?${params.toString()}`;
}

export function buildForcePasswordChangePath(returnTo?: string | null) {
  const redirect = normalizeAuthRedirectTarget(returnTo);
  const params = new URLSearchParams({ redirect });
  return `${FORCE_PASSWORD_CHANGE_PATH}?${params.toString()}`;
}

export function buildCurrentAuthRedirectPath(locationLike?: LocationLike) {
  const currentLocation = locationLike ?? (typeof window !== "undefined" ? window.location : null);
  if (!currentLocation) return buildAuthRedirectPath(HOME_PATH);
  return buildAuthRedirectPath(`${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`);
}

export function resolveAuthRedirect(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return normalizeAuthRedirectTarget(params.get("redirect"));
}
