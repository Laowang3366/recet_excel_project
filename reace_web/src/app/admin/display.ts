import { normalizeAvatarUrl } from "../lib/mappers";

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
