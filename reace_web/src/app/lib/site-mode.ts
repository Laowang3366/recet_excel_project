export const ONLINE_LITE_MODE = true;

const LITE_ALLOWED_PREFIXES = [
  "/",
  "/auth",
  "/admin",
  "/practice",
  "/qa",
  "/templates",
  "/tutorials",
  "/mall",
  "/profile",
  "/settings",
  "/notifications",
  "/notification",
  "/tools",
  "/assistant",
  "/points-history",
  "/task-center",
];

export function isLiteAllowedPath(pathname: string) {
  if (!ONLINE_LITE_MODE) return true;
  if (pathname === "/") return true;
  return LITE_ALLOWED_PREFIXES.some((prefix) => prefix !== "/" && pathname.startsWith(prefix));
}
