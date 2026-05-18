import { describe, expect, it } from "vitest";
import {
  liteMobileBottomNavItems,
  liteMobileDrawerNavItems,
  publicNavItems,
  resolveActiveNavItem,
} from "./site-navigation";
import {
  getPublicRoutePreloadTargets,
  preloadPublicRoute,
  resolvePublicRoutePreloadPath,
} from "./route-preload";

describe("resolveActiveNavItem", () => {
  it("keeps tutorial center directly after home in the public navigation", () => {
    expect(publicNavItems.map((item) => item.key)).toEqual([
      "home",
      "tutorials",
      "practice",
      "templates",
      "mall",
      "tools",
      "assistant",
    ]);
  });

  it("resolves nested template pages to the template nav item", () => {
    expect(resolveActiveNavItem("/templates/records")?.name).toBe("模板中心");
  });

  it("resolves tutorial pages to the tutorial nav item", () => {
    expect(resolveActiveNavItem("/tutorials")?.name).toBe("教程中心");
  });

  it("resolves nested mall pages to the points mall nav item", () => {
    expect(resolveActiveNavItem("/mall/redemptions")?.name).toBe("积分经验中心");
  });

  it("resolves the root page to the home nav item", () => {
    expect(resolveActiveNavItem("/")?.name).toBe("首页");
  });

  it("keeps only the primary destinations in the mobile bottom navigation", () => {
    expect(liteMobileBottomNavItems.map((item) => item.key)).toEqual(["home", "tutorials", "practice", "profile"]);
  });

  it("keeps secondary destinations in the mobile drawer", () => {
    expect(liteMobileDrawerNavItems.map((item) => item.key)).toEqual(["mall", "tools", "assistant", "templates"]);
  });

  it("keeps every public module reachable across compact navigation surfaces", () => {
    const reachableKeys = new Set([
      ...liteMobileBottomNavItems.map((item) => item.key),
      ...liteMobileDrawerNavItems.map((item) => item.key),
    ]);

    publicNavItems.forEach((item) => {
      expect(reachableKeys.has(item.key)).toBe(true);
    });
  });

  it("keeps public navigation destinations prefetchable", () => {
    const preloadTargets = getPublicRoutePreloadTargets();

    publicNavItems.forEach((item) => {
      expect(resolvePublicRoutePreloadPath(item.path)).toBe(item.path);
      expect(preloadTargets).toContain(item.path);
    });
  });

  it("normalizes searchable module urls before prefetching their route chunk", () => {
    expect(resolvePublicRoutePreloadPath("/tutorials?search=SUM")).toBe("/tutorials");
    expect(resolvePublicRoutePreloadPath("/practice/chapters?search=SUM")).toBe("/practice");
  });

  it("preloads the dark campaign hub for the practice navigation entry", async () => {
    const module = await preloadPublicRoute("/practice") as Record<string, unknown>;

    expect(module.PracticeCampaignHub).toBeTypeOf("function");
    expect(module.PracticeCampaignChapters).toBeUndefined();
  });

  it("ignores action-only navigation entries without a route path", () => {
    expect(resolvePublicRoutePreloadPath("")).toBeNull();
  });
});
