import {
  ArrowRightLeft,
  BookOpen,
  FolderKanban,
  Home,
  Lightbulb,
  MessageSquareText,
  ShoppingBag,
  Target,
  User,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  liteMobileBottomNavItems,
  liteMobileDrawerNavItems,
  publicNavItems,
  resolveActiveNavItem,
} from "../../lib/site-navigation";

type PublicNavItem = (typeof publicNavItems)[number];

export type LayoutNavItem = PublicNavItem & {
  icon: ReactNode;
};

export type LayoutMobileDrawerNavItem = {
  name: string;
  path: string;
  icon: ReactNode;
};

export type LayoutMobileBottomNavItem = {
  key: string;
  name: string;
  path: string;
  icon: ReactNode;
};

const navIconMap: Record<string, ReactNode> = {
  home: <Home size={18} strokeWidth={1.8} />,
  practice: <Target size={18} strokeWidth={1.8} />,
  templates: <FolderKanban size={18} strokeWidth={1.8} />,
  tutorials: <BookOpen size={18} strokeWidth={1.8} />,
  qa: <MessageSquareText size={18} strokeWidth={1.8} />,
  mall: <ShoppingBag size={18} strokeWidth={1.8} />,
  tools: <ArrowRightLeft size={18} strokeWidth={1.8} />,
  assistant: <Lightbulb size={18} strokeWidth={1.8} />,
  profile: <User size={18} strokeWidth={1.8} />,
};

export function buildLayoutNavigation(pathname: string, isAuthenticated: boolean) {
  const navItems: LayoutNavItem[] = publicNavItems
    .filter((item) => item.key !== "assistant")
    .map((item) => ({
      ...item,
      icon: navIconMap[item.key],
    }));
  const primaryLiteNavItems = navItems.filter((item) =>
    ["home", "practice", "qa", "templates", "tutorials", "tools"].includes(item.key)
  );
  const qaNavItem = navItems.find((item) => item.key === "qa");
  const accountLiteNavItems = [
    ...(qaNavItem ? [{ ...qaNavItem, key: "qa-my", name: "查看答疑", shortName: "答疑", path: "/qa/my" }] : []),
    ...navItems.filter((item) => ["mall"].includes(item.key)),
  ];
  const mobileDrawerNavItems: LayoutMobileDrawerNavItem[] =
    liteMobileDrawerNavItems.map((item) => ({ ...item, icon: navIconMap[item.key] }));
  const mobileBottomNavItems: LayoutMobileBottomNavItem[] = liteMobileBottomNavItems.map((item) => ({
    key: item.key,
    name: item.shortName,
    path: item.key === "profile" && !isAuthenticated ? "/auth" : item.path,
    icon: navIconMap[item.key],
  }));

  return {
    activePublicNav: resolveActiveNavItem(pathname),
    navItems,
    primaryLiteNavItems,
    accountLiteNavItems,
    mobileDrawerNavItems,
    mobileBottomNavItems,
  };
}
