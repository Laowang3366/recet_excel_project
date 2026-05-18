import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Menu, X } from "lucide-react";
import { useSession } from "../lib/session";
import { canAccessAdminPath, getAdminModulesForRole, getDefaultAdminPath, hasAdminConsoleAccess, type AdminRole } from "../admin/config";
import { getAdminAvatarSrc, getAdminSidebarClassName, getAdminSidebarOverlayClassName } from "../admin/display";
import { secondaryButtonClassName } from "../admin/shared";
import { AdminDialogHost } from "./AdminConsoleShared";

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading } = useSession();
  const role = hasAdminConsoleAccess(user?.role) ? (user?.role as AdminRole) : null;
  const modules = useMemo(() => getAdminModulesForRole(role), [role]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
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
    <div className="min-h-screen bg-[#f0f2f5] lg:grid lg:grid-cols-[208px_minmax(0,1fr)]">
      <button
        type="button"
        aria-label="关闭后台导航"
        onClick={() => setIsMobileNavOpen(false)}
        className={getAdminSidebarOverlayClassName(isMobileNavOpen)}
      />
      <aside className={getAdminSidebarClassName(isMobileNavOpen)}>
        <div className="h-16 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#1677ff] text-white">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-white">Excel社区</div>
              <div className="text-xs text-white/45">Admin Console</div>
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

        <div className="flex-1 overflow-y-auto py-3">
          <div className="mb-2 px-5 text-[11px] font-black uppercase tracking-[0.22em] text-white/35">模块导航</div>
          <div className="space-y-0.5">
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
                    className={`group relative flex h-10 w-full items-center gap-3 px-5 text-left transition ${
                      isActive
                        ? "bg-[#1677ff] font-medium text-white"
                        : "text-white/65 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-[#69c0ff]" />}
                    <Icon size={16} className={isActive ? "text-white" : "text-white/45 group-hover:text-white/80"} />
                    <div className="min-w-0 text-sm">{module.label}</div>
                  </button>
                );
              })}
              </div>
          </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[#f0f0f0] bg-white shadow-[0_1px_4px_rgba(0,21,41,0.08)]">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-label="打开后台导航"
                onClick={() => setIsMobileNavOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-[#d9d9d9] bg-white text-[#595959] transition hover:border-[#4096ff] hover:text-[#1677ff] lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0 truncate text-[18px] font-medium text-[#262626]">站点管理后台</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2">
                <img
                  src={getAdminAvatarSrc(user)}
                  alt={user?.username || "admin"}
                  className="h-8 w-8 rounded-full border border-[#f0f0f0] object-cover"
                />
                <div className="hidden leading-tight sm:block">
                  <div className="text-sm font-medium text-[#262626]">{user?.username}</div>
                  <div className="text-xs text-[#8c8c8c]">{role === "admin" ? "管理员" : "运营"}</div>
                </div>
              </div>
              <Link to="/" className={secondaryButtonClassName()}>
                <ArrowLeft size={16} />
                返回站点
              </Link>
            </div>
          </div>
        </header>

        <div className="px-4 py-4 md:px-6 md:py-5">
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
