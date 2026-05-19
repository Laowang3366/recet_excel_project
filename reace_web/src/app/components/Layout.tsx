import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Menu,
  Activity,
  CalendarCheck,
} from "lucide-react";
import { startTransition, useCallback, useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { hasAdminConsoleAccess } from "../admin/config";
import { api } from "../lib/api";
import {
  getAppShellClassName,
  getLitePublicNavigationClassName,
  getMobileBottomNavigationContentClassName,
  shouldRenderHeaderDrawerTrigger,
  shouldRenderCompactHeaderAccountAction,
  shouldRenderCompactHeaderNotificationAction,
} from "../lib/layout-display";
import { notificationKeys } from "../lib/query-keys";
import { preloadPublicRoute } from "../lib/route-preload";
import { useSession } from "../lib/session";
import {
  getVisibleNotificationTypeFilter,
  shouldRenderNotificationItem,
} from "../lib/notification-display";
import { useIsMobile } from "./ui/use-mobile";
import { ONLINE_LITE_MODE, isLiteAllowedPath } from "../lib/site-mode";
import { AssistantWidget } from "./layout/AssistantWidget";
import { AccountMenu } from "./layout/AccountMenu";
import { CheckinDialog, useCheckinStatusQuery } from "./layout/CheckinDialog";
import { FeedbackDialog } from "./layout/FeedbackDialog";
import { MobileBottomNav } from "./layout/MobileBottomNav";
import { NotificationDropdown, type LayoutNotification } from "./layout/NotificationDropdown";
import { SitePopupNotificationDialog } from "./layout/SitePopupNotificationDialog";
import { UserPropsDialog } from "./layout/UserPropsDialog";
import { buildLayoutNavigation } from "./layout/navigation-items";

const OPEN_PROPS_EVENT = "excel-open-props-dialog";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showNotifications]);
  const isMobile = useIsMobile();
  const showCompactHeaderAccountAction = shouldRenderCompactHeaderAccountAction({
    onlineLiteMode: ONLINE_LITE_MODE,
    isMobile,
  });
  const showCompactHeaderNotificationAction = shouldRenderCompactHeaderNotificationAction({
    onlineLiteMode: ONLINE_LITE_MODE,
    isMobile,
  });
  const showHeaderDrawerTrigger = shouldRenderHeaderDrawerTrigger({
    onlineLiteMode: ONLINE_LITE_MODE,
    isMobile,
  });
  const { user, isAuthenticated, logout } = useSession();
  const canAccessAdmin = hasAdminConsoleAccess(user?.role);
  const visibleNotificationTypeFilter = getVisibleNotificationTypeFilter();
  const preloadNavigationTarget = (path: string) => {
    if (!path) return;
    void preloadPublicRoute(path);
  };
  const navigateToPrefetchedRoute = (path: string) => {
    if (!path) return;
    void preloadPublicRoute(path);
    startTransition(() => {
      navigate(path);
    });
  };

  useEffect(() => {
    if (!ONLINE_LITE_MODE) return;
    if (location.pathname.startsWith("/admin")) return;
    if (!isLiteAllowedPath(location.pathname)) {
      navigate("/", { replace: true });
    }
  }, [location.pathname, navigate]);

  const notificationsPreviewQuery = useQuery({
    queryKey: notificationKeys.list({ page: 1, limit: 5, type: visibleNotificationTypeFilter, scope: "layout" }),
    enabled: isAuthenticated,
    queryFn: () => api.get<{ notifications: LayoutNotification[] }>(`/api/notifications?page=1&limit=5&type=${encodeURIComponent(visibleNotificationTypeFilter)}`, { silent: true }),
  });
  const unreadNotificationsQuery = useQuery({
    queryKey: [...notificationKeys.all, "unread-count"] as const,
    enabled: isAuthenticated,
    queryFn: () => api.get<{ count: number }>("/api/notifications/unread-count", { silent: true }),
  });
  const notificationItems = (notificationsPreviewQuery.data?.notifications || []).filter((item) => shouldRenderNotificationItem(item.type));
  const unreadNotificationCount = unreadNotificationsQuery.data?.count || 0;
  const checkinStatusQuery = useCheckinStatusQuery(isAuthenticated);
  const checkinStatus = checkinStatusQuery.data;

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: () => api.put("/api/notifications/read-all", {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: (notificationId: number) => api.put(`/api/notifications/${notificationId}/read`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const resolveNotificationLink = (notification: LayoutNotification) => {
    switch (notification.type) {
      case "site_notification":
        return notification.relatedId ? `/notification/${notification.relatedId}` : "/notifications";
      case "system":
        return "/points-history";
      case "feedback_result":
        return "/notifications";
      case "qa_case_answered":
      case "qa_answer_accepted":
        return notification.relatedId ? `/qa/cases/${notification.relatedId}#answers` : "/qa/my";
      default:
        return "/notifications";
    }
  };

  const {
    activePublicNav,
    navItems,
    primaryLiteNavItems,
    accountLiteNavItems,
    mobileDrawerNavItems,
    mobileBottomNavItems,
  } = buildLayoutNavigation(location.pathname, isAuthenticated);

  const openPropsDialog = useCallback(() => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    setPropsOpen(true);
  }, [isAuthenticated, navigate]);

  const openCheckinDialog = useCallback(() => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    setCheckinOpen(true);
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const handleOpenProps = () => {
      openPropsDialog();
    };
    window.addEventListener(OPEN_PROPS_EVENT, handleOpenProps);
    return () => window.removeEventListener(OPEN_PROPS_EVENT, handleOpenProps);
  }, [openPropsDialog]);

  return (
    <div className={getAppShellClassName()}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(0,176,80,0.38),transparent_32%),radial-gradient(circle_at_72%_8%,rgba(34,197,94,0.22),transparent_28%),linear-gradient(180deg,#00140d_0%,#001b12_44%,#f4fff8_44%,#f4fff8_100%)]" />
      {/* Sidebar */}
      <aside
        className="hidden"
      >
        <div className="flex min-h-20 items-center px-6 border-b border-slate-200/60">
          <div className="flex items-center gap-3 text-teal-600">
            <Activity size={24} strokeWidth={2.5} />
            <div>
              <div className="font-black text-lg tracking-tight text-slate-900">Excel学习平台</div>
              <div className="text-[11px] font-bold tracking-[0.18em] text-slate-400">LITE WORKSPACE</div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-6">
          {ONLINE_LITE_MODE ? (
            <div className="space-y-4">
              <div>
                <div className="px-2 text-[11px] font-black tracking-[0.18em] text-slate-400">主导航</div>
                <div className="mt-3 space-y-1.5">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`));
                    return (
                      <button
                        key={`lite-module-${item.path}`}
                        type="button"
                        onPointerEnter={() => preloadNavigationTarget(item.path)}
                        onFocus={() => preloadNavigationTarget(item.path)}
                        onTouchStart={() => preloadNavigationTarget(item.path)}
                        onClick={() => navigateToPrefetchedRoute(item.path)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                          isActive
                            ? "bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] text-white shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
                            : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                        }`}
                      >
                        <span className={isActive ? "text-white" : "text-slate-400"}>{item.icon}</span>
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <nav className="space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200 ${
                      isActive
                        ? "bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] text-white font-black shadow-[0_16px_36px_rgba(15,23,42,0.12)]"
                        : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                    }`}
                  >
                    <div className={isActive ? "text-white" : "text-slate-400"}>
                      {item.icon}
                    </div>
                    <span>{item.name}</span>
                    {isActive && (
                      <motion.div
                        layoutId="active-nav-indicator"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        className="absolute left-2 h-7 w-1 rounded-r-full bg-white/88"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

      </aside>

      {/* Main Content */}
      <div className="relative z-10 flex w-full flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-2 border-b border-white/10 bg-[#00140d]/86 px-3 text-white backdrop-blur-2xl sm:gap-4 sm:px-4 md:h-20 md:px-4 xl:px-8">
          
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            {showHeaderDrawerTrigger ? (
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition ${
                      ONLINE_LITE_MODE
                        ? "border-white/12 bg-white/8 text-white hover:border-white/24 hover:bg-white/14 lg:hidden"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 md:hidden"
                    }`}
                    aria-label="打开导航菜单"
                  >
                    <Menu size={18} />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[86vw] max-w-none border-r border-slate-200 bg-white p-0">
                  <SheetHeader className="border-b border-slate-100 px-5 py-5 text-left">
                    <SheetTitle className="flex items-center gap-2 text-teal-600">
                      <Activity size={20} strokeWidth={2.5} />
                      <span className="text-base font-black tracking-tight text-slate-900">Excel学习平台</span>
                    </SheetTitle>
                    <SheetDescription>移动端快捷导航</SheetDescription>
                  </SheetHeader>
                  <div className="flex min-h-0 flex-1 flex-col">
                    <nav className="flex-1 space-y-1 px-4 py-4">
                      {mobileDrawerNavItems.map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
                        return (
                          <button
                            key={item.path}
                            type="button"
                            onPointerEnter={() => preloadNavigationTarget(item.path)}
                            onFocus={() => preloadNavigationTarget(item.path)}
                            onTouchStart={() => preloadNavigationTarget(item.path)}
                            onClick={() => {
                              setMobileNavOpen(false);
                              navigateToPrefetchedRoute(item.path);
                            }}
                            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                              isActive
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            <span className={isActive ? "text-white" : "text-slate-400"}>{item.icon}</span>
                            <span>{item.name}</span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            ) : null}
            {ONLINE_LITE_MODE ? (
              <div className="flex min-w-0 flex-1 items-center gap-3 xl:gap-5">
                <button
                  type="button"
                  onPointerEnter={() => preloadNavigationTarget("/")}
                  onFocus={() => preloadNavigationTarget("/")}
                  onTouchStart={() => preloadNavigationTarget("/")}
                  onClick={() => navigateToPrefetchedRoute("/")}
                  className="group flex shrink-0 items-center gap-2 sm:gap-3"
                  aria-label="返回首页"
                >
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#00b050] text-white shadow-[0_12px_28px_rgba(0,176,80,0.38)]">
                    <Activity size={22} strokeWidth={2.4} />
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#7cffb2] ring-2 ring-[#00140d]" />
                  </div>
                  <div className="text-left">
                    <div className="text-base font-black leading-tight tracking-tight text-white sm:text-lg">Excel学习平台</div>
                    <div className="hidden text-[10px] font-bold uppercase tracking-[0.24em] text-white/46 min-[360px]:block">Skill Cloud</div>
                  </div>
                </button>
                <nav className={getLitePublicNavigationClassName()}>
                  {primaryLiteNavItems.map((item) => {
                    const isActive = activePublicNav?.key === item.key;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onPointerEnter={() => preloadNavigationTarget(item.path)}
                        onFocus={() => preloadNavigationTarget(item.path)}
                        onTouchStart={() => preloadNavigationTarget(item.path)}
                        onClick={() => navigateToPrefetchedRoute(item.path)}
                        className={`relative inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-xs font-bold transition xl:h-11 xl:gap-2 xl:px-3 xl:text-sm ${
                          isActive
                            ? "bg-white text-[#00140d] shadow-[0_14px_32px_rgba(255,255,255,0.16)]"
                            : "text-white/78 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className={isActive ? "text-[#00b050]" : "text-white/58"}>{item.icon}</span>
                        <span className="whitespace-nowrap xl:hidden">{item.shortName}</span>
                        <span className="hidden whitespace-nowrap xl:inline">{item.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            ) : null}
          </div>

          <div className={`flex items-center ${isMobile ? "gap-1.5 ml-2" : "gap-2 ml-2 xl:gap-4 xl:ml-6"}`}>
            {!ONLINE_LITE_MODE ? (
              <button
                type="button"
                onClick={openCheckinDialog}
                className={`inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
                  checkinStatus?.hasCheckedInToday
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
                title={checkinStatus?.hasCheckedInToday ? "今日已签到" : "每日签到"}
              >
                <CalendarCheck size={16} className={checkinStatus?.hasCheckedInToday ? "text-emerald-600" : "text-amber-600"} />
                {!isMobile ? <span>{checkinStatus?.hasCheckedInToday ? "已签到" : "签到"}</span> : null}
              </button>
            ) : null}

            <NotificationDropdown
              compact={showCompactHeaderNotificationAction}
              isAuthenticated={isAuthenticated}
              open={showNotifications}
              unreadCount={unreadNotificationCount}
              items={notificationItems}
              rootRef={notificationRef}
              onOpenChange={setShowNotifications}
              onNavigate={navigate}
              onMarkAllRead={async () => {
                await markAllNotificationsReadMutation.mutateAsync();
              }}
              onMarkRead={async (id) => {
                await markNotificationReadMutation.mutateAsync(id);
              }}
              resolveNotificationLink={resolveNotificationLink}
            />

            <AccountMenu
              user={user}
              isAuthenticated={isAuthenticated}
              compact={showCompactHeaderAccountAction}
              isMobile={isMobile}
              canAccessAdmin={canAccessAdmin}
              hasCheckedInToday={checkinStatus?.hasCheckedInToday}
              accountNavItems={accountLiteNavItems}
              onNavigate={navigate}
              onPrefetchedNavigate={navigateToPrefetchedRoute}
              onOpenCheckin={openCheckinDialog}
              onLogout={logout}
            />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className={getMobileBottomNavigationContentClassName(isMobile)}
          >
            <Outlet />
          </motion.div>
        </main>

        <MobileBottomNav
          isMobile={isMobile}
          items={mobileBottomNavItems}
          pathname={location.pathname}
          onNavigate={navigateToPrefetchedRoute}
        />
      </div>

      <UserPropsDialog open={propsOpen} isAuthenticated={isAuthenticated} onOpenChange={setPropsOpen} />
      <CheckinDialog open={checkinOpen} status={checkinStatus} onOpenChange={setCheckinOpen} />
      <SitePopupNotificationDialog isAuthenticated={isAuthenticated} />

      <AssistantWidget onOpen={() => setShowNotifications(false)} />

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
