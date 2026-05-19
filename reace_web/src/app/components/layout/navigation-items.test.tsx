import { describe, expect, it } from "vitest";
import { buildLayoutNavigation } from "./navigation-items";

describe("layout navigation items", () => {
  it("promotes templates into the desktop primary lite navigation", () => {
    const navigation = buildLayoutNavigation("/templates", true);

    expect(navigation.primaryLiteNavItems.map((item) => item.key)).toEqual([
      "home",
      "tutorials",
      "practice",
      "templates",
    ]);
  });

  it("keeps templates out of the more menu once it is promoted", () => {
    const navigation = buildLayoutNavigation("/templates", true);

    expect(navigation.accountLiteNavItems.map((item) => item.key)).toEqual(["mall", "tools"]);
  });
});
