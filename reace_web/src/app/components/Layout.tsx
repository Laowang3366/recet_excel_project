import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Home, 
  BookOpen, 
  ShoppingBag, 
  Menu,
  User,
  MoreVertical,
  ChevronDown,
  Activity,
  Lightbulb,
  Wrench,
  Package,
  Award,
  Ticket,
  ArrowRightLeft,
  Target as TargetIcon,
  FolderKanban,
  CalendarCheck,
  Flame
} from "lucide-react";
import { startTransition, useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
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
import { homeKeys, mallKeys, notificationKeys, pointsKeys, profileKeys } from "../lib/query-keys";
import { preloadPublicRoute } from "../lib/route-preload";
import { useSession } from "../lib/session";
import {
  getVisibleNotificationTypeFilter,
  shouldRenderNotificationItem,
} from "../lib/notification-display";
import {
  liteMobileBottomNavItems,
  liteMobileDrawerNavItems,
  publicNavItems,
  resolveActiveNavItem,
} from "../lib/site-navigation";
import { useIsMobile } from "./ui/use-mobile";
import { ONLINE_LITE_MODE, isLiteAllowedPath } from "../lib/site-mode";
import { AssistantWidget } from "./layout/AssistantWidget";
import { AccountMenu } from "./layout/AccountMenu";
import { CategorySearch } from "./layout/CategorySearch";
import { MobileBottomNav } from "./layout/MobileBottomNav";
import { NotificationDropdown, type LayoutNotification } from "./layout/NotificationDropdown";

const OPEN_PROPS_EVENT = "excel-open-props-dialog";

type UserPropRecord = {
  id: number;
  key?: string | null;
  type?: string | null;
  name?: string | null;
  description?: string | null;
  actionLabel?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  current?: boolean;
  canUse?: boolean;
  canUnequip?: boolean;
};

type CheckinStatus = {
  hasCheckedInToday?: boolean;
  currentContinuousDays?: number;
  previewContinuousDays?: number;
  todayExp?: number;
  previewPoints?: number;
  previewExpMin?: number;
  previewExpMax?: number;
  totalDays?: number;
  makeupCardCount?: number;
  basePoints?: number;
  previewPointsBonus?: number;
  previewExpBonus?: number;
  latestMissedDate?: string | null;
  canMakeupCheckin?: boolean;
};

type PropActionResponse = {
  message?: string;
};

type CheckinActionResponse = {
  gainedPoints?: number;
  gainedExp?: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [popupNotification, setPopupNotification] = useState<LayoutNotification | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    type: "performance_optimization",
    content: "",
  });
  const notificationRef = useRef<HTMLDivElement>(null);
  const popupDismissedIdsRef = useRef<Set<number>>(new Set());

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
  const popupNotificationsQuery = useQuery({
    queryKey: notificationKeys.list({ page: 1, limit: 20, type: "site_notification", scope: "popup-notification" }),
    enabled: isAuthenticated,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    queryFn: () => api.get<{ notifications: LayoutNotification[] }>("/api/notifications?page=1&limit=20&type=site_notification", { silent: true }),
  });
  const notificationItems = (notificationsPreviewQuery.data?.notifications || []).filter((item) => shouldRenderNotificationItem(item.type));
  const popupNotifications = popupNotificationsQuery.data?.notifications || [];
  const unreadNotificationCount = unreadNotificationsQuery.data?.count || 0;
  const propsQuery = useQuery({
    queryKey: profileKeys.props(),
    enabled: isAuthenticated && propsOpen,
    queryFn: () => api.get<{ records: UserPropRecord[] }>("/api/users/me/props", { silent: true }),
  });
  const checkinStatusQuery = useQuery({
    queryKey: homeKeys.checkinStatus(),
    enabled: isAuthenticated,
    queryFn: () => api.get<CheckinStatus>("/api/checkin/status", { silent: true }),
  });
  const propsRecords = propsQuery.data?.records || [];
  const checkinStatus = checkinStatusQuery.data;

  useEffect(() => {
    if (!isAuthenticated) {
      popupDismissedIdsRef.current.clear();
      setPopupNotification(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (popupNotification) {
      return;
    }

    const nextPopup = popupNotifications.find((item) =>
      item &&
      item.isRead !== 1 &&
      item.announcementType === "popup" &&
      typeof item.id === "number" &&
      !popupDismissedIdsRef.current.has(item.id)
    );

    if (nextPopup) {
      setPopupNotification(nextPopup);
    }
  }, [isAuthenticated, popupNotifications, popupNotification]);

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
  const feedbackMutation = useMutation({
    mutationFn: () => api.post("/api/feedback", feedbackForm),
    onSuccess: () => {
      toast.success("反馈建议已提交");
      setFeedbackOpen(false);
      setFeedbackForm({
        type: "performance_optimization",
        content: "",
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "反馈提交失败"));
    },
  });
  const usePropMutation = useMutation({
    mutationFn: (entitlementId: number) => api.post<PropActionResponse>(`/api/users/me/props/${entitlementId}/use`, {}),
    onSuccess: async (result, entitlementId) => {
      toast.success(result?.message || "道具已使用");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKeys.props() }),
        queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: ["user-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["home", "checkin-status"] }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "道具使用失败"));
    },
  });
  const checkinMutation = useMutation({
    mutationFn: () => api.post<CheckinActionResponse>("/api/checkin", {}),
    onSuccess: async (result) => {
      toast.success(`签到成功，+${result?.gainedPoints ?? 0} 积分，+${result?.gainedExp ?? 0} 经验`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: homeKeys.checkinStatus() }),
        queryClient.invalidateQueries({ queryKey: pointsKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: pointsKeys.records() }),
        queryClient.invalidateQueries({ queryKey: pointsKeys.tasks() }),
        queryClient.invalidateQueries({ queryKey: mallKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "签到失败"));
    },
  });
  const makeupCheckinMutation = useMutation({
    mutationFn: () => api.post<CheckinActionResponse>("/api/checkin/makeup", {}),
    onSuccess: async (result) => {
      toast.success(`补签成功，+${result?.gainedPoints ?? 0} 积分，+${result?.gainedExp ?? 0} 经验`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: homeKeys.checkinStatus() }),
        queryClient.invalidateQueries({ queryKey: pointsKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: pointsKeys.records() }),
        queryClient.invalidateQueries({ queryKey: pointsKeys.tasks() }),
        queryClient.invalidateQueries({ queryKey: mallKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "补签失败"));
    },
  });
  const unequipPropMutation = useMutation({
    mutationFn: (entitlementId: number) => api.post<PropActionResponse>(`/api/users/me/props/${entitlementId}/unequip`, {}),
    onSuccess: async (result) => {
      toast.success(result?.message || "已取消佩戴");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKeys.props() }),
        queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "取消佩戴失败"));
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
      default:
        return "/notifications";
    }
  };

  const handleClosePopupNotification = async () => {
    if (!popupNotification?.id) {
      setPopupNotification(null);
      return;
    }
    popupDismissedIdsRef.current.add(popupNotification.id);
    try {
      if (popupNotification.isRead !== 1) {
        await markNotificationReadMutation.mutateAsync(popupNotification.id);
      }
    } finally {
      setPopupNotification(null);
    }
  };

  const navIconMap: Record<string, React.ReactNode> = {
    home: <Home size={18} strokeWidth={1.8} />,
    practice: <TargetIcon size={18} strokeWidth={1.8} />,
    templates: <FolderKanban size={18} strokeWidth={1.8} />,
    tutorials: <BookOpen size={18} strokeWidth={1.8} />,
    mall: <ShoppingBag size={18} strokeWidth={1.8} />,
    tools: <ArrowRightLeft size={18} strokeWidth={1.8} />,
    assistant: <Lightbulb size={18} strokeWidth={1.8} />,
    profile: <User size={18} strokeWidth={1.8} />,
  };
  const navItems = publicNavItems
    .filter((item) => item.key !== "assistant")
    .map((item) => ({
      ...item,
      icon: navIconMap[item.key],
    }));
  const primaryLiteNavItems = navItems.filter((item) =>
    ["home", "practice", "tutorials"].includes(item.key)
  );
  const accountLiteNavItems = navItems.filter((item) =>
    ["mall", "tools", "templates"].includes(item.key)
  );
  const activePublicNav = resolveActiveNavItem(location.pathname);
  const mobileDrawerNavItems: Array<{ name: string; path: string; icon: React.ReactNode }> =
    liteMobileDrawerNavItems.map((item) => ({ ...item, icon: navIconMap[item.key] }));
  const mobileBottomNavItems = liteMobileBottomNavItems.map((item) => ({
        key: item.key,
        name: item.shortName,
        path: item.key === "profile" && !isAuthenticated ? "/auth" : item.path,
        icon: navIconMap[item.key],
      }));

  const openPropsDialog = () => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    setPropsOpen(true);
  };

  const openCheckinDialog = () => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    setCheckinOpen(true);
  };
  const moreLiteNavItems = [
    ...accountLiteNavItems.map((item) => ({
      ...item,
      action: () => navigateToPrefetchedRoute(item.path),
      active: activePublicNav?.key === item.key,
    })),
    {
      key: "checkin",
      name: checkinStatus?.hasCheckedInToday ? "今日已签到" : "每日签到",
      shortName: "签到",
      path: "",
      description: "连续签到获取积分和经验",
      icon: <CalendarCheck size={18} strokeWidth={1.8} />,
      action: openCheckinDialog,
      active: false,
    },
  ];
  const moreLiteActive = moreLiteNavItems.some((item) => item.active);
  useEffect(() => {
    const handleOpenProps = () => {
      openPropsDialog();
    };
    window.addEventListener(OPEN_PROPS_EVENT, handleOpenProps);
    return () => window.removeEventListener(OPEN_PROPS_EVENT, handleOpenProps);
  });

  const resolvePropIcon = (item: UserPropRecord) => {
    if (item?.key === "checkin_makeup_card") return Ticket;
    if (item?.type === "badge") return Award;
    if (item?.type === "privilege") return Wrench;
    return Package;
  };

  const resolvePropTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      badge: "头衔",
      prop: "道具",
      privilege: "权益",
      coupon: "优惠券",
      virtual: "虚拟物品",
    };
    return map[type] || type || "道具";
  };

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
              <div className="flex min-w-0 flex-1 items-center gap-3 xl:gap-7">
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
                  <HoverCard openDelay={80} closeDelay={120}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        onPointerEnter={() => {
                          accountLiteNavItems.forEach((item) => preloadNavigationTarget(item.path));
                        }}
                        onFocus={() => {
                          accountLiteNavItems.forEach((item) => preloadNavigationTarget(item.path));
                        }}
                        className={`relative inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-xs font-bold transition xl:h-11 xl:gap-2 xl:px-3 xl:text-sm ${
                          moreLiteActive
                            ? "bg-white text-[#00140d] shadow-[0_14px_32px_rgba(255,255,255,0.16)]"
                            : "text-white/78 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <MoreVertical size={17} className={moreLiteActive ? "text-[#00b050]" : "text-white/58"} />
                        <span className="whitespace-nowrap">更多</span>
                        <ChevronDown size={14} className={moreLiteActive ? "text-[#00b050]" : "text-white/42"} />
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      align="start"
                      className="w-[min(420px,calc(100vw-32px))] rounded-[24px] border border-white/12 bg-[#06251a]/96 p-3 text-white shadow-[0_24px_64px_rgba(0,0,0,0.34)] backdrop-blur-xl"
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        {moreLiteNavItems.map((item) => (
                          <button
                            key={`more-${item.key}`}
                            type="button"
                            onPointerEnter={() => preloadNavigationTarget(item.path)}
                            onFocus={() => preloadNavigationTarget(item.path)}
                            onTouchStart={() => preloadNavigationTarget(item.path)}
                            onClick={item.action}
                            className={`group rounded-[18px] border px-3 py-3 text-left transition ${
                              item.active
                                ? "border-[#7cffb2]/60 bg-[#7cffb2]/14"
                                : "border-white/10 bg-white/7 hover:border-[#7cffb2]/36 hover:bg-white/12"
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                                item.active
                                  ? "bg-[#7cffb2] text-[#00140d]"
                                  : "bg-white/10 text-[#9cffc3] group-hover:bg-[#00b050] group-hover:text-white"
                              }`}
                            >
                              {item.icon}
                            </span>
                            <span className="mt-3 block text-sm font-black text-white">{item.name}</span>
                            <span className="mt-1 line-clamp-2 block min-h-[34px] text-xs leading-[17px] text-white/52">
                              {item.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </nav>
                <CategorySearch onNavigate={navigateToPrefetchedRoute} />
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

      <Dialog open={propsOpen} onOpenChange={setPropsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>我的道具</DialogTitle>
                      <DialogDescription>这里统一收纳你通过积分经验中心兑换获得的道具、头衔与权益，可在此选择使用。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {propsRecords.length > 0 ? (
              propsRecords.map((item) => {
                const Icon = resolvePropIcon(item);
                const isUsing = usePropMutation.isPending && usePropMutation.variables === item.id;
                const isUnequipping = unequipPropMutation.isPending && unequipPropMutation.variables === item.id;
                const isPending = isUsing || isUnequipping;
                const actionLabel = item.canUnequip ? "取消佩戴" : item.actionLabel;
                return (
                  <div key={item.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-bold text-slate-800">{item.name}</div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{resolvePropTypeLabel(item.type)}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          item.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                        }`}>
                          {item.statusLabel}
                        </span>
                        {item.current ? <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">当前使用中</span> : null}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {item.key === "checkin_makeup_card"
                          ? "可用于补签最近漏签的一天，并保持连续签到记录。"
                          : item.type === "badge"
                            ? "已拥有的头衔可在这里切换佩戴。"
                            : "该道具已统一收纳到你的个人道具库。"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.canUnequip) {
                          void unequipPropMutation.mutateAsync(item.id);
                          return;
                        }
                        if (item.canUse) {
                          void usePropMutation.mutateAsync(item.id);
                        }
                      }}
                      disabled={(!item.canUse && !item.canUnequip) || isPending}
                      className="inline-flex h-10 min-w-[92px] items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {isPending ? "处理中..." : actionLabel}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
                        暂无已获得的道具，先去积分经验中心兑换吧。
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>每日签到</DialogTitle>
            <DialogDescription>连续签到会递增积分和经验，断签后从第一天重新计算。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fffe_0%,#fefbf3_100%)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                    <CalendarCheck size={16} className="text-teal-500" />
                    {checkinStatus?.hasCheckedInToday ? "今日已完成签到" : "今日可签到"}
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {checkinStatus?.hasCheckedInToday ? `连签 ${checkinStatus?.currentContinuousDays ?? 0} 天` : `第 ${checkinStatus?.previewContinuousDays ?? 1} 天奖励`}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    {checkinStatus?.hasCheckedInToday
                      ? `今日已获得 ${checkinStatus?.todayExp ?? 0} 经验，连续签到越久，明日奖励越高。`
                      : `今日签到可获得 ${checkinStatus?.previewPoints ?? 0} 积分，经验 ${checkinStatus?.previewExpMin ?? 0}-${checkinStatus?.previewExpMax ?? 0}。`}
                  </div>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-amber-500 shadow-sm ring-1 ring-slate-200">
                  <Flame size={24} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold tracking-[0.16em] text-slate-400">连续签到</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{checkinStatus?.currentContinuousDays ?? 0}</div>
                <div className="mt-1 text-xs text-slate-500">当前连续天数</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold tracking-[0.16em] text-slate-400">累计签到</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{checkinStatus?.totalDays ?? 0}</div>
                <div className="mt-1 text-xs text-slate-500">历史签到总天数</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold tracking-[0.16em] text-slate-400">积分奖励</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{checkinStatus?.previewPoints ?? 0}</div>
                <div className="mt-1 text-xs text-slate-500">含连签加成</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold tracking-[0.16em] text-slate-400">补签卡</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{checkinStatus?.makeupCardCount ?? 0}</div>
                <div className="mt-1 text-xs text-slate-500">可补最近漏签</div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <div>基础积分：{checkinStatus?.basePoints ?? 0}</div>
              <div>连签加成：+{checkinStatus?.previewPointsBonus ?? 0} 积分 / +{checkinStatus?.previewExpBonus ?? 0} 经验</div>
              {checkinStatus?.latestMissedDate ? <div>最近漏签：{checkinStatus.latestMissedDate}</div> : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => void makeupCheckinMutation.mutateAsync()}
                disabled={!checkinStatus?.canMakeupCheckin || (checkinStatus?.makeupCardCount ?? 0) <= 0 || makeupCheckinMutation.isPending}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {makeupCheckinMutation.isPending ? "补签中..." : "使用补签卡"}
              </button>
              <button
                type="button"
                onClick={() => void checkinMutation.mutateAsync()}
                disabled={checkinStatus?.hasCheckedInToday || checkinMutation.isPending}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {checkinStatus?.hasCheckedInToday ? "今日已签到" : checkinMutation.isPending ? "签到中..." : "立即签到"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(popupNotification)} onOpenChange={(open) => {
        if (!open) {
          void handleClosePopupNotification();
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{popupNotification?.title || popupNotification?.content || "站内通知"}</DialogTitle>
            <DialogDescription>管理员已向你发送一条弹窗通知，请确认内容后关闭。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-teal-100 bg-teal-50/50 px-4 py-4">
              {popupNotification?.detailContent ? (
                <div
                  className="prose prose-sm max-w-none text-slate-700"
                  dangerouslySetInnerHTML={{ __html: popupNotification.detailContent }}
                />
              ) : (
                <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                  {popupNotification?.content || "暂无通知内容"}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleClosePopupNotification()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                关闭通知
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AssistantWidget onOpen={() => setShowNotifications(false)} />

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>反馈建议</DialogTitle>
            <DialogDescription>欢迎反馈产品问题和改进建议，我们会在后台统一处理与跟进。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">反馈类型</div>
              <select
                value={feedbackForm.type}
                onChange={(e) => setFeedbackForm((prev) => ({ ...prev, type: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              >
                <option value="performance_optimization">性能优化</option>
                <option value="feature_optimization">功能优化</option>
                <option value="new_feature">新增功能</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">反馈内容</div>
              <textarea
                value={feedbackForm.content}
                onChange={(e) => setFeedbackForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="请尽量描述清楚问题场景、预期效果或新增需求。"
                className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
            </label>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-amber-500" />
                <span>建议描述具体现象、影响范围和你的预期结果。</span>
              </div>
              <span>{feedbackForm.content.trim().length}/1000</span>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const content = feedbackForm.content.trim();
                  if (!content) {
                    toast.info("请填写反馈内容");
                    return;
                  }
                  if (content.length > 1000) {
                    toast.info("反馈内容不能超过1000字");
                    return;
                  }
                  void feedbackMutation.mutateAsync();
                }}
                disabled={feedbackMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {feedbackMutation.isPending ? "提交中..." : "提交反馈"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
