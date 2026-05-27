import { normalizeAvatarUrl } from "../lib/mappers";
import type { AdminModuleKey } from "./config";

export type AdminAvatarUser = {
  id?: number | string | null;
  username?: string | null;
  email?: string | null;
  avatar?: string | null;
};

export function getAdminAvatarSrc(user?: AdminAvatarUser | null) {
  const seed = user?.username || user?.email || (user?.id == null ? "admin" : String(user.id));
  return normalizeAvatarUrl(user?.avatar, seed);
}

export function getAdminSearchPlaceholder(moduleKey?: AdminModuleKey | null) {
  const placeholders: Partial<Record<AdminModuleKey, string>> = {
    notifications: "搜索通知标题、目标人群、关键词",
    users: "搜索用户、手机号、邮箱",
    "home-content": "搜索教程标题、分类、标签",
    questions: "搜索题目标题、分类、难度",
    "question-categories": "搜索分类名称、说明、题目标签",
    templates: "搜索模板标题、行业、标签",
    qa: "搜索求助标题、答疑内容、用户",
    assistant: "搜索模型、配置、单位",
    "file-recycle-bin": "搜索文件名、来源模块、删除人",
  };

  return placeholders[moduleKey || "users"] || "搜索用户、手机号、邮箱";
}

export function getAdminSidebarClassName(isMobileNavOpen: boolean) {
  const mobileState = isMobileNavOpen ? "translate-x-0" : "-translate-x-full pointer-events-none";
  return [
    "fixed inset-y-0 left-0 z-40 flex h-dvh w-[232px] flex-col overflow-hidden bg-[#001529] text-white shadow-[2px_0_8px_rgba(0,21,41,0.18)] transition-transform duration-200",
    mobileState,
    "lg:static lg:z-auto lg:h-auto lg:min-h-screen lg:w-auto lg:translate-x-0 lg:pointer-events-auto lg:transition-none",
  ].join(" ");
}

export function getAdminSidebarOverlayClassName(isMobileNavOpen: boolean) {
  return [
    "fixed inset-0 z-30 bg-slate-950/40 transition-opacity lg:hidden",
    isMobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0",
  ].join(" ");
}
