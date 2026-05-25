import { describe, expect, it } from "vitest";
import { normalizeAvatarUrl } from "../lib/mappers";
import {
  getAdminAvatarSrc,
  getAdminSidebarClassName,
  getAdminSidebarOverlayClassName,
} from "./display";

describe("admin display helpers", () => {
  it("uses the shared avatar fallback for admin users", () => {
    const user = { username: "admin", email: "admin@excelcc.cn", avatar: "" };

    expect(getAdminAvatarSrc(user)).toBe(normalizeAvatarUrl("", "admin"));
  });

  it("normalizes explicit avatar URLs before rendering admin users", () => {
    expect(getAdminAvatarSrc({ username: "admin", avatar: "/uploads/admin.png" })).toContain("/uploads/admin.png");
  });

  it("keeps the mobile sidebar off canvas until opened", () => {
    expect(getAdminSidebarClassName(false)).toContain("-translate-x-full");
    expect(getAdminSidebarClassName(false)).toContain("pointer-events-none");
    expect(getAdminSidebarClassName(false)).toContain("overflow-hidden");
  });

  it("opens the mobile sidebar and keeps navigation scrollable on small screens", () => {
    expect(getAdminSidebarClassName(true)).toContain("translate-x-0");
    expect(getAdminSidebarClassName(true)).toContain("h-dvh");
    expect(getAdminSidebarOverlayClassName(true)).toContain("opacity-100");
  });

  it("uses the compact ExcelCC redesign sidebar frame", () => {
    const className = getAdminSidebarClassName(true);

    expect(className).toContain("w-[232px]");
    expect(className).toContain("bg-[#001529]");
    expect(className).toContain("shadow-[2px_0_8px_rgba(0,21,41,0.18)]");
  });
});
