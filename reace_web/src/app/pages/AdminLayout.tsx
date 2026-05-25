import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Bell, ChevronDown, CircleHelp, Globe2, Menu, Search, X } from "lucide-react";
import { useSession } from "../lib/session";
import { canAccessAdminPath, getAdminModuleByPath, getAdminModulesForRole, getDefaultAdminPath, hasAdminConsoleAccess, type AdminRole } from "../admin/config";
import { getAdminAvatarSrc, getAdminSidebarClassName, getAdminSidebarOverlayClassName } from "../admin/display";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { AdminDialogHost } from "./AdminConsoleShared";

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading } = useSession();
  const role = hasAdminConsoleAccess(user?.role) ? (user?.role as AdminRole) : null;
  const modules = useMemo(() => getAdminModulesForRole(role), [role]);
  const currentModule = getAdminModuleByPath(location.pathname);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate(buildCurrentAuthRedirectPath(location), { replace: true });
      return;
    }
    if (!hasAdminConsoleAccess(user?.role)) {
      navigate("/", { replace: true });
      return;
    }
    if (!canAccessAdminPath(user?.role, location.pathname)) {
      navigate(getDefaultAdminPath(user?.role), { replace: true });
    }
  }, [isAuthenticated, loading, location.pathname, navigate, user?.role]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  if (loading || !isAuthenticated || !role) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f3f6fa] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <button
        type="button"
        aria-label="关闭后台导航"
        onClick={() => setIsMobileNavOpen(false)}
        className={getAdminSidebarOverlayClassName(isMobileNavOpen)}
      />
      <aside className={getAdminSidebarClassName(isMobileNavOpen)}>
        <div className="h-[72px] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-[4px] bg-white text-[#001529] shadow-sm">
              <span className="text-[18px] font-black leading-none">E</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[22px] font-semibold leading-none text-white">ExcelCC</div>
            </div>
            <button
              type="button"
              aria-label="关闭后台导航"
              onClick={() => setIsMobileNavOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-5 pt-1">
          <div className="space-y-1">
              {modules.map((module) => {
                const isActive = location.pathname === module.path;
                const Icon = module.icon;
                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => {
                      navigate(module.path);
                      setIsMobileNavOpen(false);
                    }}
                    className={`group relative flex h-[52px] w-full items-center gap-3 rounded-[6px] px-4 text-left text-[16px] transition ${
                      isActive
                        ? "bg-[#1677ff] font-semibold text-white shadow-[0_6px_16px_rgba(22,119,255,0.28)]"
                        : "font-medium text-white/86 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon size={21} className={isActive ? "text-white" : "text-white/86 group-hover:text-white"} />
                    <div className="min-w-0 truncate">{module.label}</div>
                  </button>
                );
              })}
              </div>
          </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[#e5e7eb] bg-white shadow-[0_1px_4px_rgba(0,21,41,0.06)]">
          <div className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 md:px-8 xl:grid-cols-[270px_minmax(360px,520px)_minmax(270px,1fr)]">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="打开后台导航"
                onClick={() => setIsMobileNavOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-[#d0d5dd] bg-white text-[#475467] transition hover:border-[#4096ff] hover:text-[#1677ff] lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div className="hidden min-w-0 items-center gap-3 text-[16px] md:flex">
                <span className="text-[#667085]">系统管理</span>
                <span className="text-[#98a2b3]">/</span>
                <span className="truncate font-semibold text-[#101828]">{currentModule?.label || "后台管理"}</span>
              </div>
            </div>
            <label className="hidden h-12 w-full items-center gap-3 rounded-[6px] border border-[#d0d5dd] bg-white px-4 text-[#98a2b3] shadow-[0_1px_2px_rgba(16,24,40,0.04)] xl:flex">
              <Search size={18} />
              <input
                type="search"
                placeholder="搜索用户、手机号、邮箱"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#344054] outline-none placeholder:text-[#98a2b3]"
              />
            </label>
            <div className="flex shrink-0 items-center justify-end gap-2 md:gap-4">
              <button type="button" aria-label="通知" className="relative hidden h-10 w-10 items-center justify-center rounded-full text-[#101828] hover:bg-[#f2f4f7] md:inline-flex">
                <Bell size={22} />
                <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff2d2d] px-1 text-[10px] font-semibold leading-none text-white">8</span>
              </button>
              <button type="button" aria-label="帮助" className="hidden h-10 w-10 items-center justify-center rounded-full text-[#101828] hover:bg-[#f2f4f7] md:inline-flex">
                <CircleHelp size={22} />
              </button>
              <button type="button" className="hidden h-10 items-center gap-2 rounded-[4px] px-2 text-sm font-semibold text-[#101828] hover:bg-[#f2f4f7] xl:inline-flex">
                <Globe2 size={22} />
                简体中文
                <ChevronDown size={16} />
              </button>
              <div className="flex items-center gap-2 border-l border-[#e5e7eb] pl-2 md:pl-4">
                <img
                  src={getAdminAvatarSrc(user)}
                  alt={user?.username || "admin"}
                  className="h-10 w-10 rounded-full border border-[#eef2f6] object-cover"
                />
                <div className="hidden leading-tight sm:block">
                  <div className="text-sm font-semibold text-[#101828]">{user?.username}</div>
                  <div className="text-xs text-[#667085]">{role === "admin" ? "管理员" : "运营"}</div>
                </div>
                <ChevronDown size={16} className="hidden text-[#667085] sm:block" />
              </div>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 md:px-6 md:py-6">
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
      <AdminDialogHost />
    </div>
  );
}

export function AdminIndex() {
  const navigate = useNavigate();
  const { user } = useSession();

  useEffect(() => {
    navigate(getDefaultAdminPath(user?.role), { replace: true });
  }, [navigate, user?.role]);

  return null;
}
