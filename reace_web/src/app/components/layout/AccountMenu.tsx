import { ClipboardList, LogOut, Settings, User } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { getDefaultAdminPath } from "../../admin/config";
import { getCompactHeaderAccountButtonClassName } from "../../lib/layout-display";
import { normalizeAvatarUrl } from "../../lib/mappers";
import type { SessionUser } from "../../lib/session-store";
import { ONLINE_LITE_MODE } from "../../lib/site-mode";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";

export type AccountMenuNavItem = {
  key: string;
  name: string;
  path: string;
  icon?: ReactNode;
};

type AccountMenuProps = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  compact: boolean;
  isMobile: boolean;
  canAccessAdmin: boolean;
  hasCheckedInToday?: boolean;
  accountNavItems: AccountMenuNavItem[];
  onNavigate: (path: string) => void;
  onPrefetchedNavigate: (path: string) => void;
  onOpenCheckin: () => void;
  onLogout: () => Promise<void>;
};

export function AccountMenu({
  user,
  isAuthenticated,
  compact,
  isMobile,
  canAccessAdmin,
  hasCheckedInToday,
  accountNavItems,
  onNavigate,
  onPrefetchedNavigate,
  onOpenCheckin,
  onLogout,
}: AccountMenuProps) {
  const panelClassName = ONLINE_LITE_MODE
    ? "w-44 rounded-2xl border border-white/10 bg-[#06251a]/96 p-1.5 text-white shadow-[0_18px_44px_rgba(0,0,0,0.30)] backdrop-blur-xl"
    : "w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.14)]";
  const itemClassName = ONLINE_LITE_MODE
    ? "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/74 transition hover:bg-white/10 hover:text-white"
    : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950";
  const dangerClassName = ONLINE_LITE_MODE
    ? "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-rose-200 transition hover:bg-rose-500/14 hover:text-rose-100"
    : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-rose-600 transition hover:bg-rose-50";

  const handleLogout = async () => {
    await onLogout();
    toast.success("已退出登录");
    onNavigate("/auth");
  };

  return (
    <div
      className={`${
        compact ? "shrink-0" : isMobile ? "" : ONLINE_LITE_MODE ? "border-l border-white/10 pl-4" : "border-l border-gray-200 pl-4"
      } flex items-center gap-2`}
    >
      {isAuthenticated && !compact ? (
        <HoverCard openDelay={120} closeDelay={80}>
          <HoverCardTrigger asChild>
            <button type="button" className="group flex cursor-pointer items-center gap-2">
              <img
                src={normalizeAvatarUrl(user?.avatar, user?.username)}
                alt="Profile"
                className={`h-8 w-8 rounded-full object-cover transition-colors ${
                  ONLINE_LITE_MODE
                    ? "border border-white/20 group-hover:border-white/60"
                    : "border border-gray-200 group-hover:border-teal-400"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  ONLINE_LITE_MODE
                    ? "text-white/82 group-hover:text-white"
                    : "text-slate-700 group-hover:text-slate-900"
                }`}
              >
                {user?.username || "去登录"}
              </span>
            </button>
          </HoverCardTrigger>
          <HoverCardContent align="end" sideOffset={12} className={panelClassName}>
            <button type="button" onClick={() => onNavigate("/profile")} className={itemClassName}>
              <User size={16} className={ONLINE_LITE_MODE ? "text-white/42" : "text-slate-400"} />
              个人中心
            </button>
            <button type="button" onClick={() => onNavigate("/settings")} className={itemClassName}>
              <Settings size={16} className={ONLINE_LITE_MODE ? "text-white/42" : "text-slate-400"} />
              设置
            </button>
            {canAccessAdmin ? (
              <button
                type="button"
                onClick={() => onNavigate(getDefaultAdminPath(user?.role))}
                className={itemClassName}
              >
                <ClipboardList size={16} className={ONLINE_LITE_MODE ? "text-white/42" : "text-slate-400"} />
                管理后台
              </button>
            ) : null}
            <button type="button" onClick={() => void handleLogout()} className={dangerClassName}>
              <LogOut size={16} className={ONLINE_LITE_MODE ? "text-rose-300" : "text-rose-500"} />
              退出登录
            </button>
          </HoverCardContent>
        </HoverCard>
      ) : isAuthenticated && compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={getCompactHeaderAccountButtonClassName()}>
              <img
                src={normalizeAvatarUrl(user?.avatar, user?.username)}
                alt="Profile"
                className="h-8 w-8 rounded-full object-cover"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
            <DropdownMenuItem onClick={() => onNavigate("/profile")}>个人中心</DropdownMenuItem>
            {ONLINE_LITE_MODE ? (
              <>
                <DropdownMenuItem onClick={onOpenCheckin}>
                  {hasCheckedInToday ? "今日已签到" : "每日签到"}
                </DropdownMenuItem>
                {accountNavItems.map((item) => (
                  <DropdownMenuItem key={`mobile-account-${item.key}`} onClick={() => onPrefetchedNavigate(item.path)}>
                    {item.name}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            <DropdownMenuItem onClick={() => onNavigate("/settings")}>设置</DropdownMenuItem>
            {canAccessAdmin && (
              <DropdownMenuItem onClick={() => onNavigate(getDefaultAdminPath(user?.role))}>
                进入管理后台
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => void handleLogout()}>退出登录</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : compact ? (
        <Link to="/auth" className={getCompactHeaderAccountButtonClassName()} aria-label="登录或注册">
          <img
            src={normalizeAvatarUrl("", "登录")}
            alt="登录或注册"
            className="h-8 w-8 rounded-full object-cover"
          />
        </Link>
      ) : ONLINE_LITE_MODE ? (
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            to="/auth"
            className="inline-flex h-10 items-center rounded-full px-4 text-sm font-bold text-white/84 transition hover:bg-white/10 hover:text-white"
          >
            登录
          </Link>
          <Link
            to="/auth"
            className="inline-flex h-10 items-center rounded-full bg-white px-5 text-sm font-black text-[#00140d] transition hover:bg-[#ccfff1]"
          >
            注册
          </Link>
        </div>
      ) : (
        <Link to="/auth" className="group flex cursor-pointer items-center gap-2">
          <img
            src={normalizeAvatarUrl(user?.avatar, user?.username)}
            alt="Profile"
            className="h-8 w-8 rounded-full border border-gray-200 object-cover transition-colors group-hover:border-teal-400"
          />
          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{user?.username || "去登录"}</span>
        </Link>
      )}
      {isAuthenticated && !ONLINE_LITE_MODE ? (
        <>
          <button
            type="button"
            onClick={() => onNavigate("/settings")}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            <Settings size={16} className="text-slate-400" />
            {!isMobile ? <span>设置</span> : null}
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
          >
            <LogOut size={16} className="text-rose-500" />
            {!isMobile ? <span>退出登录</span> : null}
          </button>
        </>
      ) : null}
    </div>
  );
}
