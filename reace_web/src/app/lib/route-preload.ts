type RoutePreloader = () => Promise<unknown>;

const publicRoutePreloaders: Record<string, RoutePreloader> = {
  "/": () => import("../pages/Home"),
  "/tutorials": () => import("../pages/TutorialCenter"),
  "/practice": () => import("../pages/PracticeCampaignHub"),
  "/qa": () => import("../pages/QaCenter"),
  "/templates": () => import("../pages/TemplateCenter"),
  "/mall": () => import("../pages/Mall"),
  "/tools": () => import("../pages/Tools"),
  "/assistant": () => import("../pages/Assistant"),
  "/profile": () => import("../pages/ProfileCenter"),
};

const preloadCache = new Map<string, Promise<unknown>>();

export function getPublicRoutePreloadTargets() {
  return Object.keys(publicRoutePreloaders);
}

export function resolvePublicRoutePreloadPath(pathname: string) {
  const normalizedPathname = normalizeRoutePreloadPath(pathname);
  if (!normalizedPathname) {
    return null;
  }
  if (publicRoutePreloaders[normalizedPathname]) {
    return normalizedPathname;
  }

  return getPublicRoutePreloadTargets()
    .filter((path) => path !== "/")
    .sort((left, right) => right.length - left.length)
    .find((path) => normalizedPathname.startsWith(`${path}/`)) || null;
}

export function preloadPublicRoute(pathname: string) {
  const preloadPath = resolvePublicRoutePreloadPath(pathname);
  if (!preloadPath) {
    return null;
  }

  const cachedPreload = preloadCache.get(preloadPath);
  if (cachedPreload) {
    return cachedPreload;
  }

  const preload = publicRoutePreloaders[preloadPath]()
    .catch((error) => {
      preloadCache.delete(preloadPath);
      throw error;
    });
  preloadCache.set(preloadPath, preload);
  return preload;
}

function normalizeRoutePreloadPath(pathname: string) {
  const rawPathname = pathname.trim();
  if (!rawPathname) {
    return "";
  }
  const normalized = rawPathname.split("#")[0].split("?")[0];
  if (normalized === "/") {
    return "/";
  }
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}
