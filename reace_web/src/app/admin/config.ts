import {
  BellRing,
  BookMarked,
  Bot,
  Coins,
  Gauge,
  Layers3,
  PanelsTopLeft,
  Shield,
  Users,
} from "lucide-react";

export type AdminRole = "admin" | "moderator";
export type AdminModuleKey =
  | "overview"
  | "home-content"
  | "notifications"
  | "users"
  | "questions"
  | "question-categories"
  | "templates"
  | "points"
  | "levels"
  | "assistant";

export type AdminModule = {
  key: AdminModuleKey;
  label: string;
  path: string;
  icon: any;
  roles: AdminRole[];
};

export const ADMIN_MODULES: AdminModule[] = [
  { key: "overview", label: "后台总览", path: "/admin/overview", icon: Gauge, roles: ["admin", "moderator"] },
  { key: "home-content", label: "首页内容", path: "/admin/home-content", icon: PanelsTopLeft, roles: ["admin"] },
  { key: "notifications", label: "通知管理", path: "/admin/notifications", icon: BellRing, roles: ["admin"] },
  { key: "users", label: "用户管理", path: "/admin/users", icon: Users, roles: ["admin"] },
  { key: "questions", label: "题库管理", path: "/admin/questions", icon: BookMarked, roles: ["admin"] },
  { key: "question-categories", label: "题目分类", path: "/admin/question-categories", icon: Layers3, roles: ["admin"] },
  { key: "templates", label: "模板中心", path: "/admin/templates", icon: PanelsTopLeft, roles: ["admin"] },
  { key: "points", label: "积分体系", path: "/admin/points", icon: Coins, roles: ["admin"] },
  { key: "levels", label: "等级体系", path: "/admin/levels", icon: Shield, roles: ["admin"] },
  { key: "assistant", label: "AI助手", path: "/admin/assistant", icon: Bot, roles: ["admin"] },
];

export function hasAdminConsoleAccess(role?: string | null): role is AdminRole {
  return role === "admin" || role === "moderator";
}

export function getAdminModulesForRole(role?: string | null) {
  if (!hasAdminConsoleAccess(role)) return [];
  return ADMIN_MODULES.filter((module) => module.roles.includes(role));
}

export function getDefaultAdminPath(role?: string | null) {
  return "/admin/overview";
}

export function getAdminModuleByPath(pathname: string) {
  return ADMIN_MODULES.find((module) => pathname === module.path || pathname.startsWith(`${module.path}/`));
}

export function canAccessAdminPath(role: string | null | undefined, pathname: string) {
  if (!hasAdminConsoleAccess(role)) return false;
  const module = getAdminModuleByPath(pathname);
  if (!module) return pathname === "/admin";
  return module.roles.includes(role);
}

export function canManageCategoryMutations(role?: string | null) {
  return role === "admin";
}
