import { describe, expect, it } from "vitest";
import { buildLayoutNavigation } from "./navigation-items";

describe("layout navigation items", () => {
  it("promotes templates and tools into the desktop primary lite navigation", () => {
    const navigation = buildLayoutNavigation("/templates", true);

    expect(navigation.primaryLiteNavItems.map((item) => item.key)).toEqual([
      "home",
      "tutorials",
      "practice",
      "qa",
      "templates",
      "tools",
    ]);
  });

  it("keeps personal-only entries in the account avatar navigation", () => {
    const navigation = buildLayoutNavigation("/templates", true);

    expect(navigation.accountLiteNavItems.map((item) => item.key)).toEqual(["qa-my", "mall"]);
    expect(navigation.accountLiteNavItems.map((item) => item.path)).toEqual(["/qa/my", "/mall"]);
  });

  it("keeps the profile target when unauthenticated mobile users are sent to login", () => {
    const navigation = buildLayoutNavigation("/practice", false);
    const profileItem = navigation.mobileBottomNavItems.find((item) => item.key === "profile");

    expect(profileItem?.path).toBe("/auth?redirect=%2Fprofile");
  });
});
