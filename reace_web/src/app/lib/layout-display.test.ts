import { describe, expect, it } from "vitest";
import {
  getAppShellClassName,
  getLiteCategorySearchClassName,
  getLitePublicNavigationClassName,
  getMobileBottomNavigationContentClassName,
  getMobileBottomNavigationReserveClassName,
  getCompactHeaderAccountButtonClassName,
  getCompactHeaderNotificationButtonClassName,
  shouldRenderHeaderDrawerTrigger,
  shouldRenderCompactHeaderAccountAction,
  shouldRenderCompactHeaderNotificationAction,
} from "./layout-display";

describe("layout display helpers", () => {
  it("uses the dynamic viewport height for the app shell", () => {
    expect(getAppShellClassName()).toContain("h-dvh");
    expect(getAppShellClassName()).not.toContain("h-screen");
  });

  it("keeps the account entry visible on mobile lite headers", () => {
    expect(shouldRenderCompactHeaderAccountAction({ onlineLiteMode: true, isMobile: true })).toBe(true);
  });

  it("keeps compact account buttons from shrinking out of the mobile header", () => {
    expect(getCompactHeaderAccountButtonClassName()).toContain("shrink-0");
  });

  it("keeps the notification entry visible on mobile lite headers", () => {
    expect(shouldRenderCompactHeaderNotificationAction({ onlineLiteMode: true, isMobile: true })).toBe(true);
    expect(shouldRenderCompactHeaderNotificationAction({ onlineLiteMode: true, isMobile: false })).toBe(false);
    expect(shouldRenderCompactHeaderNotificationAction({ onlineLiteMode: false, isMobile: true })).toBe(false);
  });

  it("keeps compact notification buttons visible on dark mobile headers", () => {
    const className = getCompactHeaderNotificationButtonClassName();
    expect(className).toContain("shrink-0");
    expect(className).toContain("text-white");
    expect(className).toContain("border-white");
  });

  it("uses the full public navigation on tablet lite headers instead of the mobile drawer", () => {
    expect(shouldRenderHeaderDrawerTrigger({ onlineLiteMode: true, isMobile: true })).toBe(true);
    expect(shouldRenderHeaderDrawerTrigger({ onlineLiteMode: true, isMobile: false })).toBe(false);
    expect(shouldRenderHeaderDrawerTrigger({ onlineLiteMode: false, isMobile: true })).toBe(true);
  });

  it("shows compact public navigation before the desktop breakpoint", () => {
    expect(getLitePublicNavigationClassName()).toContain("md:flex");
    expect(getLitePublicNavigationClassName()).not.toContain("lg:flex");
    expect(getLitePublicNavigationClassName()).toContain("md:ml-[clamp(56px,10vw,260px)]");
    expect(getLiteCategorySearchClassName()).toContain("xl:block");
    expect(getLiteCategorySearchClassName()).not.toContain("lg:block");
  });

  it("reserves enough mobile content space for app and browser bottom bars", () => {
    expect(getMobileBottomNavigationReserveClassName()).toBe("pb-[calc(176px+env(safe-area-inset-bottom))]");
    expect(getMobileBottomNavigationContentClassName(true)).toContain(getMobileBottomNavigationReserveClassName());
    expect(getMobileBottomNavigationContentClassName(false)).toBe("h-full");
  });
});
