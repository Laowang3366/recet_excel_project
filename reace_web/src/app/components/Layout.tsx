import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Home, 
  BookOpen, 
  ShoppingBag, 
  Menu,
  Bell, 
  Search,
  User,
  X,
  Send,
  LoaderCircle,
  Paperclip,
  MoreVertical,
  Activity,
  Settings,
  LogOut,
  Lightbulb,
  Wrench,
  Package,
  Award,
  Ticket,
  ArrowRightLeft,
  Gift,
  History,
  Target as TargetIcon,
  ClipboardList,
  FolderKanban,
  CalendarCheck,
  Flame
} from "lucide-react";
import { startTransition, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { getDefaultAdminPath, hasAdminConsoleAccess } from "../admin/config";
import { api } from "../lib/api";
import { formatRelativeTime } from "../lib/format";
import {
  getAppShellClassName,
  getLiteCategorySearchClassName,
  getLitePublicNavigationClassName,
  getMobileBottomNavigationContentClassName,
  getCompactHeaderAccountButtonClassName,
  getCompactHeaderNotificationButtonClassName,
  shouldRenderHeaderDrawerTrigger,
  shouldRenderCompactHeaderAccountAction,
  shouldRenderCompactHeaderNotificationAction,
} from "../lib/layout-display";
import { normalizeAvatarUrl, normalizeImageUrl } from "../lib/mappers";
import { homeKeys, mallKeys, notificationKeys, pointsKeys, profileKeys } from "../lib/query-keys";
import { preloadPublicRoute } from "../lib/route-preload";
import { useSession } from "../lib/session";
import {
  getHiddenNotificationTypeFilter,
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

const OPEN_PROPS_EVENT = "excel-open-props-dialog";
const ASSISTANT_ENTRY_WIDTH = 104;
const ASSISTANT_ENTRY_HEIGHT = 132;

type AssistantWidgetResponse = {
  conversationId: string;
  answer: string;
  relatedTutorials: Array<{ id: number; title: string; summary?: string; path: string }>;
  relatedQuestions: Array<{ id: number; title: string; explanation?: string; path: string }>;
  model?: string;
  fallbackUsed?: boolean;
};

type AssistantWidgetAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  readable: boolean;
  imageDataUrl?: string;
};

type AssistantWidgetTurn = {
  id: string;
  question: string;
  answer: string;
  relatedTutorials: AssistantWidgetResponse["relatedTutorials"];
  relatedQuestions: AssistantWidgetResponse["relatedQuestions"];
  attachments?: AssistantWidgetAttachment[];
  model?: string;
  fallbackUsed?: boolean;
  pending?: boolean;
  failed?: boolean;
};

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [popupNotification, setPopupNotification] = useState<any | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantConversationId, setAssistantConversationId] = useState<string | null>(null);
  const [assistantHistory, setAssistantHistory] = useState<AssistantWidgetTurn[]>([]);
  const [assistantAttachments, setAssistantAttachments] = useState<AssistantWidgetAttachment[]>([]);
  const [assistantDragPosition, setAssistantDragPosition] = useState<{ left: number; top: number } | null>(null);
  const [assistantDragging, setAssistantDragging] = useState(false);
  const [assistantShowLatestReply, setAssistantShowLatestReply] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    type: "performance_optimization",
    content: "",
  });
  const notificationRef = useRef<HTMLDivElement>(null);
  const assistantRef = useRef<HTMLDivElement>(null);
  const assistantMessagesRef = useRef<HTMLDivElement>(null);
  const assistantLatestReplyRef = useRef<HTMLDivElement>(null);
  const assistantFileInputRef = useRef<HTMLInputElement>(null);
  const assistantDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const assistantSuppressClickRef = useRef(false);
  const assistantEntryReturnPositionRef = useRef<{ left: number; top: number } | null>(null);
  const assistantEntryHadCustomPositionRef = useRef(false);
  const assistantPanelMovedRef = useRef(false);
  const assistantShouldScrollLatestRef = useRef(false);
  const popupDismissedIdsRef = useRef<Set<number>>(new Set());

  const clampAssistantPosition = (left: number, top: number, width: number, height: number) => {
    const padding = 8;
    const maxLeft = Math.max(padding, window.innerWidth - width - padding);
    const maxTop = Math.max(padding, window.innerHeight - height - padding);
    return {
      left: Math.min(Math.max(padding, left), maxLeft),
      top: Math.min(Math.max(padding, top), maxTop),
    };
  };

  const clampAssistantToViewport = () => {
    const rect = assistantRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAssistantDragPosition((current) => {
      if (!current) return current;
      const next = clampAssistantPosition(rect.left, rect.top, rect.width, rect.height);
      if (Math.abs(current.left - next.left) < 0.5 && Math.abs(current.top - next.top) < 0.5) {
        return current;
      }
      return next;
    });
  };

  const isAssistantNearLatestReply = () => {
    const element = assistantMessagesRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  };

  const scrollAssistantToLatestReply = (behavior: ScrollBehavior = "smooth") => {
    assistantLatestReplyRef.current?.scrollIntoView({ behavior, block: "end" });
    setAssistantShowLatestReply(false);
  };

  const beginAssistantDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-assistant-no-drag='true'], input, textarea, select, a")) return;
    const rect = assistantRef.current?.getBoundingClientRect();
    if (!rect) return;
    assistantDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setAssistantDragging(true);
  };

  const moveAssistantDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = assistantDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
      drag.moved = true;
      assistantSuppressClickRef.current = true;
      if (assistantOpen) {
        assistantPanelMovedRef.current = true;
      }
    }
    if (!drag.moved) return;
    event.preventDefault();
    setAssistantDragPosition(
      clampAssistantPosition(
        drag.originLeft + deltaX,
        drag.originTop + deltaY,
        drag.width,
        drag.height,
      ),
    );
  };

  const endAssistantDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = assistantDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    assistantDragRef.current = null;
    setAssistantDragging(false);
    if (drag.moved) {
      window.setTimeout(() => {
        assistantSuppressClickRef.current = false;
      }, 0);
      return;
    }
    assistantSuppressClickRef.current = false;
  };

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
  useEffect(() => {
    if (!assistantOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (assistantRef.current && !assistantRef.current.contains(event.target as Node)) {
        closeAssistant();
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAssistant();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [assistantOpen]);

  useEffect(() => {
    if (!assistantDragPosition) return;
    const handleViewportChange = () => clampAssistantToViewport();
    const frameId = window.requestAnimationFrame(handleViewportChange);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, [assistantOpen, Boolean(assistantDragPosition)]);

  useEffect(() => {
    if (!assistantOpen || assistantHistory.length === 0) return;
    if (!assistantShouldScrollLatestRef.current) return;
    assistantShouldScrollLatestRef.current = false;
    requestAnimationFrame(() => scrollAssistantToLatestReply("smooth"));
  }, [assistantOpen, assistantHistory.length]);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  const [categorySearchScope, setCategorySearchScope] = useState<"tutorial" | "question">("tutorial");
  const [categorySearchKeyword, setCategorySearchKeyword] = useState("");
  const categorySearchRef = useRef<HTMLDivElement>(null);
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
  const hiddenNotificationTypeFilter = getHiddenNotificationTypeFilter();
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categorySearchRef.current && !categorySearchRef.current.contains(event.target as Node)) {
        setCategorySearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notificationsPreviewQuery = useQuery({
    queryKey: notificationKeys.list({ page: 1, limit: 5, type: visibleNotificationTypeFilter, scope: "layout" }),
    enabled: isAuthenticated,
    queryFn: () => api.get<{ notifications: any[] }>(`/api/notifications?page=1&limit=5&type=${encodeURIComponent(visibleNotificationTypeFilter)}`, { silent: true }),
  });
  const unreadNotificationsQuery = useQuery({
    queryKey: [...notificationKeys.all, "unread-count"] as const,
    enabled: isAuthenticated,
    queryFn: () => api.get<{ count: number }>("/api/notifications/unread-count", { silent: true }),
  });
  const hiddenNotificationsQuery = useQuery({
    queryKey: notificationKeys.list({ page: 1, limit: 100, type: hiddenNotificationTypeFilter, scope: "layout-hidden" }),
    enabled: isAuthenticated,
    queryFn: () => api.get<{ notifications: any[] }>(`/api/notifications?page=1&limit=100&type=${encodeURIComponent(hiddenNotificationTypeFilter)}`, { silent: true }),
  });
  const popupNotificationsQuery = useQuery({
    queryKey: notificationKeys.list({ page: 1, limit: 20, type: "site_notification", scope: "popup-notification" }),
    enabled: isAuthenticated,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    queryFn: () => api.get<{ notifications: any[] }>("/api/notifications?page=1&limit=20&type=site_notification", { silent: true }),
  });
  const notificationItems = (notificationsPreviewQuery.data?.notifications || []).filter((item) => shouldRenderNotificationItem(item.type));
  const popupNotifications = popupNotificationsQuery.data?.notifications || [];
  const hiddenUnreadNotificationCount = (hiddenNotificationsQuery.data?.notifications || []).filter((item) => !item.isRead).length;
  const unreadNotificationCount = hiddenNotificationsQuery.data
    ? Math.max(0, (unreadNotificationsQuery.data?.count || 0) - hiddenUnreadNotificationCount)
    : (unreadNotificationsQuery.data?.count || 0);
  const propsQuery = useQuery({
    queryKey: profileKeys.props(),
    enabled: isAuthenticated && propsOpen,
    queryFn: () => api.get<{ records: any[] }>("/api/users/me/props", { silent: true }),
  });
  const checkinStatusQuery = useQuery({
    queryKey: homeKeys.checkinStatus(),
    enabled: isAuthenticated,
    queryFn: () => api.get<any>("/api/checkin/status", { silent: true }),
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
  const assistantChatMutation = useMutation({
    mutationFn: ({
      message,
      conversationId,
      workbookContext,
      images,
    }: {
      message: string;
      conversationId: string | null;
      workbookContext?: string;
      turnId: string;
      attachments?: AssistantWidgetAttachment[];
      images?: Array<{ name: string; mimeType: string; size: number; dataUrl?: string }>;
    }) =>
      api.post<AssistantWidgetResponse>("/api/assistant/chat", {
        message,
        conversationId,
        workbookContext,
        images,
      }),
    onSuccess: (result, variables) => {
      const shouldScrollToLatest = !assistantOpen || isAssistantNearLatestReply();
      assistantShouldScrollLatestRef.current = shouldScrollToLatest;
      if (!shouldScrollToLatest) {
        setAssistantShowLatestReply(true);
      }
      setAssistantHistory((prev) => prev.map((item) => item.id === variables.turnId
        ? {
          ...item,
          answer: result.answer,
          relatedTutorials: result.relatedTutorials || [],
          relatedQuestions: result.relatedQuestions || [],
          attachments: variables.attachments || [],
          model: result.model,
          fallbackUsed: result.fallbackUsed,
          pending: false,
          failed: false,
        }
        : item));
      setAssistantConversationId(result.conversationId || null);
      if (shouldScrollToLatest) {
        requestAnimationFrame(() => scrollAssistantToLatestReply("smooth"));
      }
    },
    onError: (error: any, variables) => {
      const message = error?.message || "AI 助手暂时不可用";
      setAssistantHistory((prev) => prev.map((item) => item.id === variables?.turnId
        ? {
          ...item,
          answer: message,
          relatedTutorials: [],
          relatedQuestions: [],
          pending: false,
          failed: true,
        }
        : item));
      toast.error(message);
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
    onError: (error: any) => {
      toast.error(error?.message || "反馈提交失败");
    },
  });
  const usePropMutation = useMutation({
    mutationFn: (entitlementId: number) => api.post<any>(`/api/users/me/props/${entitlementId}/use`, {}),
    onSuccess: async (result, entitlementId) => {
      toast.success(result?.message || "道具已使用");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKeys.props() }),
        queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: ["post"] }),
        queryClient.invalidateQueries({ queryKey: ["board"] }),
        queryClient.invalidateQueries({ queryKey: ["user-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["home", "checkin-status"] }),
      ]);
    },
    onError: (error: any) => {
      toast.error(error?.message || "道具使用失败");
    },
  });
  const checkinMutation = useMutation({
    mutationFn: () => api.post<any>("/api/checkin", {}),
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
    onError: (error: any) => {
      toast.error(error?.message || "签到失败");
    },
  });
  const makeupCheckinMutation = useMutation({
    mutationFn: () => api.post<any>("/api/checkin/makeup", {}),
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
    onError: (error: any) => {
      toast.error(error?.message || "补签失败");
    },
  });
  const unequipPropMutation = useMutation({
    mutationFn: (entitlementId: number) => api.post<any>(`/api/users/me/props/${entitlementId}/unequip`, {}),
    onSuccess: async (result) => {
      toast.success(result?.message || "已取消佩戴");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKeys.props() }),
        queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
      ]);
    },
    onError: (error: any) => {
      toast.error(error?.message || "取消佩戴失败");
    },
  });

  const resolveNotificationLink = (notification: any) => {
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

  const handleCategorySearch = () => {
    const keyword = categorySearchKeyword.trim();
    const query = keyword ? `?search=${encodeURIComponent(keyword)}` : "";
    setCategorySearchOpen(false);
    if (categorySearchScope === "tutorial") {
      navigateToPrefetchedRoute(`/tutorials${query}`);
      return;
    }
    navigateToPrefetchedRoute(`/practice${query}`);
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
  const activeLiteModule = activePublicNav
    ? {
        ...activePublicNav,
        icon: navIconMap[activePublicNav.key],
      }
    : null;
  const mobileDrawerNavItems: Array<{ name: string; path: string; icon: React.ReactNode }> =
    liteMobileDrawerNavItems.map((item) => ({ ...item, icon: navIconMap[item.key] }));
  const mobileBottomNavItems = liteMobileBottomNavItems.map((item) => ({
        key: item.key,
        name: item.shortName,
        path: item.key === "profile" && !isAuthenticated ? "/auth" : item.path,
        icon: navIconMap[item.key],
      }));

  const showFloatingAssistant = !location.pathname.startsWith("/assistant");
  const assistantAnimatedAvatarSrc = "/assistant-ikun-animated.webp";
  const assistantReadableFilePattern = /\.(txt|csv|tsv|json|md|markdown|log|xml|html?|css|js|ts|tsx|sql)$/i;
  const assistantImageFilePattern = /\.(png|jpe?g|webp|gif)$/i;
  const assistantMaxAttachmentCount = 3;
  const assistantMaxImageSize = 5 * 1024 * 1024;
  const formatAssistantFileSize = (size: number) => {
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  };
  const isAssistantImageFile = (file: File) => file.type.startsWith("image/") || assistantImageFilePattern.test(file.name);
  const getAssistantImageMimeType = (file: File) => {
    const type = file.type.toLowerCase();
    if (type === "image/jpg") return "image/jpeg";
    if (type.startsWith("image/")) return type;
    const fileName = file.name.toLowerCase();
    if (/\.jpe?g$/.test(fileName)) return "image/jpeg";
    if (/\.webp$/.test(fileName)) return "image/webp";
    if (/\.gif$/.test(fileName)) return "image/gif";
    return "image/png";
  };
  const normalizeAssistantImageDataUrl = (file: File, dataUrl: string) => {
    const mimeType = getAssistantImageMimeType(file);
    if (/^data:image\/jpg;base64,/i.test(dataUrl)) {
      return dataUrl.replace(/^data:image\/jpg;base64,/i, "data:image/jpeg;base64,");
    }
    if (/^data:(?:application\/octet-stream)?;base64,/i.test(dataUrl)) {
      return dataUrl.replace(/^data:(?:application\/octet-stream)?;base64,/i, `data:${mimeType};base64,`);
    }
    return dataUrl;
  };
  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(normalizeAssistantImageDataUrl(file, String(reader.result || "")));
      reader.onerror = () => reject(reader.error || new Error("file read failed"));
      reader.readAsDataURL(file);
    });
  const readAssistantAttachment = async (file: File): Promise<AssistantWidgetAttachment> => {
    if (isAssistantImageFile(file)) {
      if (file.size > assistantMaxImageSize) {
        throw new Error(`图片 ${file.name || "clipboard-image"} 超过 5MB`);
      }
      return {
        id: `${file.name || "clipboard-image"}-${file.lastModified}-${file.size}`,
        name: file.name || "clipboard-image.png",
        size: file.size,
        type: getAssistantImageMimeType(file),
        readable: true,
        imageDataUrl: await readFileAsDataUrl(file),
      };
    }
    const readable = file.type.startsWith("text/") || assistantReadableFilePattern.test(file.name);
    if (!readable) {
      return {
        id: `${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        size: file.size,
        type: file.type || "unknown",
        readable: false,
      };
    }
    const text = await file.text();
    const clipped = text.length > 12000 ? `${text.slice(0, 12000)}\n\n[内容较长，已截取前 12000 字符]` : text;
    return {
      id: `${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      size: file.size,
      type: file.type || "text/plain",
      content: clipped,
      readable: true,
    };
  };
  const handleAssistantFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const incomingFiles = Array.from(files);
    const remainingSlots = Math.max(0, assistantMaxAttachmentCount - assistantAttachments.length);
    if (remainingSlots <= 0) {
      toast.info(`一次最多发送 ${assistantMaxAttachmentCount} 个附件`);
      return;
    }
    const picked = incomingFiles.slice(0, remainingSlots);
    try {
      const nextAttachments = await Promise.all(picked.map(readAssistantAttachment));
      setAssistantAttachments((prev) => [...prev, ...nextAttachments]);
      if (picked.length < incomingFiles.length) {
        toast.info(`一次最多发送 ${assistantMaxAttachmentCount} 个附件，已保留前 ${assistantMaxAttachmentCount} 个`);
      }
      const imageCount = nextAttachments.filter((item) => item.imageDataUrl).length;
      if (imageCount > 0) {
        toast.success(`已添加 ${imageCount} 张图片`);
      }
      const unreadableCount = nextAttachments.filter((item) => !item.readable && !item.imageDataUrl).length;
      if (unreadableCount > 0) {
        toast.info("部分附件无法在浏览器内读取内容，将只发送文件名和大小");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "附件读取失败，请换一个文件重试");
    } finally {
      if (assistantFileInputRef.current) {
        assistantFileInputRef.current.value = "";
      }
    }
  };
  const removeAssistantAttachment = (id: string) => {
    setAssistantAttachments((prev) => prev.filter((item) => item.id !== id));
  };
  const buildAssistantAttachmentContext = () => {
    if (assistantAttachments.length === 0) return "";
    return assistantAttachments
      .map((item, index) => {
        const header = `附件 ${index + 1}: ${item.name} (${formatAssistantFileSize(item.size)}, ${item.type || "unknown"})`;
        if (item.imageDataUrl) {
          return `${header}\n说明：该附件是图片，已作为图片发送给 AI 助手。`;
        }
        return item.readable && item.content
          ? `${header}\n内容：\n${item.content}`
          : `${header}\n说明：该附件已选择，但当前浏览器端无法直接读取二进制内容。`;
      })
      .join("\n\n");
  };
  const buildAssistantImagePayload = () =>
    assistantAttachments
      .filter((item) => item.imageDataUrl)
      .map((item) => ({
        name: item.name,
        mimeType: item.type || "image/png",
        size: item.size,
        dataUrl: item.imageDataUrl,
      }));
  const handleAssistantPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file && isAssistantImageFile(file)));
    if (files.length === 0) return;
    event.preventDefault();
    void handleAssistantFiles(files);
  };
  const handleAssistantMessagesScroll = () => {
    if (isAssistantNearLatestReply()) {
      setAssistantShowLatestReply(false);
    }
  };
  const openAssistant = () => {
    const rect = assistantRef.current?.getBoundingClientRect();
    if (rect) {
      const entryPosition = clampAssistantPosition(rect.left, rect.top, rect.width, rect.height);
      assistantEntryReturnPositionRef.current = entryPosition;
      assistantEntryHadCustomPositionRef.current = assistantDragPosition !== null;
      assistantPanelMovedRef.current = false;
      if (assistantDragPosition) {
        setAssistantDragPosition(
          clampAssistantPosition(
            entryPosition.left,
            entryPosition.top,
            ASSISTANT_ENTRY_WIDTH,
            ASSISTANT_ENTRY_HEIGHT,
          ),
        );
      }
    }
    assistantShouldScrollLatestRef.current = true;
    setAssistantShowLatestReply(false);
    setAssistantOpen(true);
    setShowNotifications(false);
    window.sessionStorage.setItem(
      "excelAssistantReturnPath",
      `${location.pathname}${location.search}${location.hash}`,
    );
  };
  const closeAssistant = () => {
    if (!assistantPanelMovedRef.current && assistantEntryReturnPositionRef.current) {
      if (assistantEntryHadCustomPositionRef.current) {
        setAssistantDragPosition(
          clampAssistantPosition(
            assistantEntryReturnPositionRef.current.left,
            assistantEntryReturnPositionRef.current.top,
            ASSISTANT_ENTRY_WIDTH,
            ASSISTANT_ENTRY_HEIGHT,
          ),
        );
      } else {
        setAssistantDragPosition(null);
      }
    }
    assistantEntryReturnPositionRef.current = null;
    assistantEntryHadCustomPositionRef.current = false;
    assistantPanelMovedRef.current = false;
    setAssistantOpen(false);
  };
  const submitAssistantMessage = async (text?: string) => {
    const content = (text ?? assistantMessage).trim();
    if (assistantChatMutation.isPending) return;
    if (!isAuthenticated) {
      toast.info("请先登录后再使用 AI 助手");
      navigate("/auth");
      return;
    }
    if (!content && assistantAttachments.length === 0) {
      toast.info("请先输入你的 Excel 问题");
      return;
    }
    const question = content || "请分析我发送的附件内容";
    const attachments = assistantAttachments;
    const workbookContext = buildAssistantAttachmentContext();
    const images = buildAssistantImagePayload();
    const turnId = `${Date.now()}`;
    const shouldScrollToLatest = !assistantOpen || isAssistantNearLatestReply();
    assistantShouldScrollLatestRef.current = shouldScrollToLatest;
    if (!shouldScrollToLatest) {
      setAssistantShowLatestReply(true);
    }
    setAssistantHistory((prev) => [
      ...prev,
      {
        id: turnId,
        question,
        answer: "",
        relatedTutorials: [],
        relatedQuestions: [],
        attachments,
        pending: true,
      },
    ]);
    setAssistantMessage("");
    setAssistantAttachments([]);
    try {
      await assistantChatMutation.mutateAsync({
        turnId,
        message: question,
        conversationId: assistantConversationId,
        workbookContext,
        images,
        attachments,
      });
    } catch {
      // error state is rendered by the mutation handler
    }
  };
  const assistantPromptSnippets = [
    "VLOOKUP 为什么会返回 #N/A？",
    "帮我写一个按部门汇总销售额的 SUMIFS 公式",
    "FILTER 和 SORTBY 怎么组合做排名？",
  ];
  const assistantCanSubmit = (assistantMessage.trim().length > 0 || assistantAttachments.length > 0) && !assistantChatMutation.isPending;
  const assistantFloatingClassName = assistantDragPosition
    ? "fixed z-50 h-[132px] w-[104px]"
    : "fixed right-3 top-1/2 z-50 h-[132px] w-[104px] -translate-y-1/2 md:right-5";
  const assistantFloatingStyle = assistantDragPosition
    ? { left: assistantDragPosition.left, top: assistantDragPosition.top }
    : undefined;
  const assistantPanelOpensLeft = !assistantDragPosition || assistantDragPosition.left > window.innerWidth / 2;
  const assistantPanelPositionClassName = assistantPanelOpensLeft
    ? "right-[88px] origin-bottom-right"
    : "left-[88px] origin-bottom-left";
  const assistantPanelArrowClassName = assistantPanelOpensLeft
    ? "-right-3 border-r border-t"
    : "-left-3 border-b border-l";
  const openFeedbackDialog = () => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    setFeedbackOpen(true);
  };

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
  const accountMenuPanelClassName = ONLINE_LITE_MODE
    ? "w-44 rounded-2xl border border-white/10 bg-[#06251a]/96 p-1.5 text-white shadow-[0_18px_44px_rgba(0,0,0,0.30)] backdrop-blur-xl"
    : "w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.14)]";
  const accountMenuItemClassName = ONLINE_LITE_MODE
    ? "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/74 transition hover:bg-white/10 hover:text-white"
    : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950";
  const accountMenuDangerClassName = ONLINE_LITE_MODE
    ? "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-rose-200 transition hover:bg-rose-500/14 hover:text-rose-100"
    : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-rose-600 transition hover:bg-rose-50";

  useEffect(() => {
    const handleOpenProps = () => {
      openPropsDialog();
    };
    window.addEventListener(OPEN_PROPS_EVENT, handleOpenProps);
    return () => window.removeEventListener(OPEN_PROPS_EVENT, handleOpenProps);
  });

  const resolvePropIcon = (item: any) => {
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
                <div className={getLiteCategorySearchClassName()} ref={categorySearchRef}>
                  <button
                    type="button"
                    onClick={() => setCategorySearchOpen((open) => !open)}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 text-sm font-bold text-white/82 transition hover:bg-white/14 hover:text-white xl:px-4"
                  >
                    <Search size={17} className="text-[#7cffb2]" />
                    <span className="whitespace-nowrap">分类搜索</span>
                  </button>
                  <AnimatePresence>
                    {categorySearchOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        className="absolute left-0 top-full z-50 mt-3 w-[360px] overflow-hidden rounded-[26px] border border-white/12 bg-[#06251a]/96 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.34)] backdrop-blur-xl"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: "tutorial", label: "教程" },
                            { key: "question", label: "题型" },
                          ].map((scope) => (
                            <button
                              key={scope.key}
                              type="button"
                              onClick={() => setCategorySearchScope(scope.key as "tutorial" | "question")}
                              className={`h-10 rounded-2xl text-sm font-black transition ${
                                categorySearchScope === scope.key
                                  ? "bg-[#7cffb2] text-[#00140d]"
                                  : "bg-white/8 text-white/62 hover:bg-white/12 hover:text-white"
                              }`}
                            >
                              {scope.label}
                            </button>
                          ))}
                        </div>
                        <label className="mt-3 flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4">
                          <Search size={18} className="text-white/42" />
                          <input
                            value={categorySearchKeyword}
                            onChange={(event) => setCategorySearchKeyword(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                handleCategorySearch();
                              }
                            }}
                            placeholder={categorySearchScope === "tutorial" ? "搜索函数、教程主题..." : "搜索章节、题型..."}
                            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/36"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleCategorySearch}
                          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#00b050] text-sm font-black text-white transition hover:bg-[#0ac45d]"
                        >
                          进入搜索
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
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

            {showCompactHeaderNotificationAction ? (
              <div className="relative shrink-0" ref={notificationRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate("/auth");
                      return;
                    }
                    setShowNotifications(!showNotifications);
                  }}
                  className={getCompactHeaderNotificationButtonClassName()}
                  title={isAuthenticated ? "通知" : "登录后查看通知"}
                  aria-label={isAuthenticated ? "打开通知" : "登录后查看通知"}
                >
                  <Bell size={18} strokeWidth={1.8} />
                  {isAuthenticated ? renderCountBadge(unreadNotificationCount, "rose") : null}
                </button>

                <AnimatePresence>
                  {isAuthenticated && showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(2px)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white/95 text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.20)] backdrop-blur-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between border-b border-gray-50 p-4">
                        <h3 className="font-semibold text-slate-800">通知</h3>
                        <button
                          onClick={async () => {
                            await markAllNotificationsReadMutation.mutateAsync();
                          }}
                          className="text-xs text-teal-600 hover:text-teal-700"
                        >
                          全部已读
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-b border-gray-50 bg-slate-50/70 px-3 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotifications(false);
                            navigate("/notifications?tab=points");
                          }}
                          className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-50"
                        >
                          积分通知
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotifications(false);
                            navigate("/notifications?tab=announcements");
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                          网站公告
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notificationItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={async () => {
                              if (!item.isRead) {
                                await markNotificationReadMutation.mutateAsync(item.id);
                              }
                              setShowNotifications(false);
                              navigate(resolveNotificationLink(item));
                            }}
                            className="flex cursor-pointer gap-3 border-b border-gray-50/50 p-4 hover:bg-gray-50"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                              <Bell size={18} />
                            </div>
                            <div>
                              <p className="text-sm text-slate-700">{item.content}</p>
                              <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(item.createTime)}</p>
                            </div>
                          </div>
                        ))}
                        {notificationItems.length === 0 && (
                          <div className="p-6 text-center text-sm text-slate-400">暂无通知</div>
                        )}
                      </div>
                      <div className="border-t border-gray-50 bg-slate-50 p-3 text-center">
                        <Link
                          to="/notifications"
                          onClick={() => setShowNotifications(false)}
                          className="text-[13px] font-bold text-slate-600 transition-colors hover:text-slate-900"
                        >
                          查看全部通知
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : isAuthenticated ? (
              <>
                <div className="relative" ref={notificationRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 text-slate-500 hover:bg-gray-100 rounded-full transition-colors relative"
                    title="通知"
                  >
                    <Bell size={20} />
                    {renderCountBadge(unreadNotificationCount, "rose")}
                  </button>

                  <AnimatePresence>
                    {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 15, scale: 0.95, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(2px)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="absolute right-0 mt-2 w-80 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800">通知</h3>
                      <button
                        onClick={async () => {
                          await markAllNotificationsReadMutation.mutateAsync();
                        }}
                        className="text-xs text-teal-600 hover:text-teal-700"
                      >
                        全部已读
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-b border-gray-50 bg-slate-50/70 px-3 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          navigate("/notifications?tab=points");
                        }}
                        className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-50"
                      >
                        积分通知
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          navigate("/notifications?tab=announcements");
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        网站公告
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notificationItems.map((item) => (
                        <div 
                          key={item.id}
                          onClick={async () => {
                            if (!item.isRead) {
                              await markNotificationReadMutation.mutateAsync(item.id);
                            }
                            setShowNotifications(false);
                            navigate(resolveNotificationLink(item));
                          }}
                          className="p-4 border-b border-gray-50/50 hover:bg-gray-50 flex gap-3 cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                            <Bell size={18} />
                          </div>
                          <div>
                            <p className="text-sm text-slate-700">{item.content}</p>
                            <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(item.createTime)}</p>
                          </div>
                        </div>
                      ))}
                      {notificationItems.length === 0 && (
                        <div className="p-6 text-sm text-slate-400 text-center">暂无通知</div>
                      )}
                    </div>
                    <div className="p-3 border-t border-gray-50 bg-slate-50 text-center">
                      <Link 
                        to="/notifications" 
                        onClick={() => setShowNotifications(false)}
                        className="text-[13px] font-bold text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        查看全部通知
                      </Link>
                    </div>
                  </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : null}

            <div
              className={`${
                showCompactHeaderAccountAction ? "shrink-0" : isMobile ? "" : ONLINE_LITE_MODE ? "pl-4 border-l border-white/10" : "pl-4 border-l border-gray-200"
              } flex items-center gap-2`}
            >
              {isAuthenticated && !showCompactHeaderAccountAction ? (
                <HoverCard openDelay={120} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <button type="button" className="flex items-center gap-2 cursor-pointer group">
                      <img
                        src={normalizeAvatarUrl(user?.avatar, user?.username)}
                        alt="Profile"
                        className={`w-8 h-8 rounded-full object-cover transition-colors ${
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
                  <HoverCardContent align="end" sideOffset={12} className={accountMenuPanelClassName}>
                    <button
                      type="button"
                      onClick={() => navigate("/profile")}
                      className={accountMenuItemClassName}
                    >
                      <User size={16} className={ONLINE_LITE_MODE ? "text-white/42" : "text-slate-400"} />
                      个人中心
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/settings")}
                      className={accountMenuItemClassName}
                    >
                      <Settings size={16} className={ONLINE_LITE_MODE ? "text-white/42" : "text-slate-400"} />
                      设置
                    </button>
                    {canAccessAdmin ? (
                      <button
                        type="button"
                        onClick={() => navigate(getDefaultAdminPath(user?.role))}
                        className={accountMenuItemClassName}
                      >
                        <ClipboardList size={16} className={ONLINE_LITE_MODE ? "text-white/42" : "text-slate-400"} />
                        管理后台
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        toast.success("已退出登录");
                        navigate("/auth");
                      }}
                      className={accountMenuDangerClassName}
                    >
                      <LogOut size={16} className={ONLINE_LITE_MODE ? "text-rose-300" : "text-rose-500"} />
                      退出登录
                    </button>
                  </HoverCardContent>
                </HoverCard>
              ) : isAuthenticated && showCompactHeaderAccountAction ? (
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
                    <DropdownMenuItem onClick={() => navigate("/profile")}>个人中心</DropdownMenuItem>
                    {ONLINE_LITE_MODE ? (
                      <>
                        <DropdownMenuItem onClick={openCheckinDialog}>
                          {checkinStatus?.hasCheckedInToday ? "今日已签到" : "每日签到"}
                        </DropdownMenuItem>
                        {accountLiteNavItems.map((item) => (
                          <DropdownMenuItem key={`mobile-account-${item.key}`} onClick={() => navigateToPrefetchedRoute(item.path)}>
                            {item.name}
                          </DropdownMenuItem>
                        ))}
                      </>
                    ) : null}
                    <DropdownMenuItem onClick={() => navigate("/settings")}>设置</DropdownMenuItem>
                    {canAccessAdmin && <DropdownMenuItem onClick={() => navigate(getDefaultAdminPath(user?.role))}>进入管理后台</DropdownMenuItem>}
                    <DropdownMenuItem
                      onClick={async () => {
                        await logout();
                        toast.success("已退出登录");
                        navigate("/auth");
                      }}
                    >
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : showCompactHeaderAccountAction ? (
                <Link
                  to="/auth"
                  className={getCompactHeaderAccountButtonClassName()}
                  aria-label="登录或注册"
                >
                  <img
                    src={normalizeAvatarUrl("", "登录")}
                    alt="登录或注册"
                    className="h-8 w-8 rounded-full object-cover"
                  />
                </Link>
              ) : (
                ONLINE_LITE_MODE ? (
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
                  <Link to="/auth" className="flex items-center gap-2 cursor-pointer group">
                    <img
                      src={normalizeAvatarUrl(user?.avatar, user?.username)}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border border-gray-200 group-hover:border-teal-400 transition-colors object-cover"
                    />
                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{user?.username || "去登录"}</span>
                  </Link>
                )
              )}
              {isAuthenticated && !ONLINE_LITE_MODE ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate("/settings")}
                    className={`inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
                      ONLINE_LITE_MODE
                        ? "border-white/12 bg-white/10 text-white/78 hover:bg-white/16 hover:text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    <Settings size={16} className={ONLINE_LITE_MODE ? "text-white/58" : "text-slate-400"} />
                    {!isMobile ? <span>设置</span> : null}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      toast.success("已退出登录");
                      navigate("/auth");
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    <LogOut size={16} className="text-rose-500" />
                    {!isMobile ? <span>退出登录</span> : null}
                  </button>
                </>
              ) : null}
            </div>
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

        {isMobile ? (
          <>
            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
            <div className="grid grid-cols-4 gap-1">
              {mobileBottomNavItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
                return (
                  <button
                    key={`mobile-nav-${item.key}`}
                    type="button"
                    onClick={() => navigateToPrefetchedRoute(item.path)}
                    className={`relative flex min-h-[58px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                      isActive
                        ? "bg-teal-50 text-teal-700"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                    >
                      <span className={isActive ? "text-teal-600" : "text-slate-400"}>{item.icon}</span>
                      <span className="leading-tight">{item.name}</span>
                    </button>
                );
              })}
            </div>
          </nav>
          </>
        ) : null}
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

      {showFloatingAssistant && (
        <div ref={assistantRef} className={assistantFloatingClassName} style={assistantFloatingStyle}>
          <>
            {assistantOpen && (
              <div
                className={`absolute bottom-6 z-10 w-[min(24rem,calc(100vw-7rem))] max-h-[min(76vh,620px)] animate-in fade-in-0 zoom-in-95 slide-in-from-right-4 duration-200 ${assistantPanelPositionClassName}`}
              >
                <div className="relative">
                  <span className={`pointer-events-none absolute bottom-12 h-7 w-7 rotate-45 rounded-[7px] border-slate-200 bg-white shadow-[12px_12px_34px_rgba(15,23,42,0.12)] ${assistantPanelArrowClassName}`} />
                  <div className="relative z-10 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
                  <div
                    className={`relative touch-none select-none bg-[#0f91dd] px-5 pb-5 pt-6 text-white shadow-[0_10px_22px_rgba(15,145,221,0.25)] ${
                      assistantDragging ? "cursor-grabbing" : "cursor-grab"
                    }`}
                    onPointerDown={beginAssistantDrag}
                    onPointerMove={moveAssistantDrag}
                    onPointerUp={endAssistantDrag}
                    onPointerCancel={endAssistantDrag}
                  >
                    <button
                      type="button"
                      onClick={closeAssistant}
                      data-assistant-no-drag="true"
                      className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/76 transition hover:bg-white/12 hover:text-white"
                      aria-label="关闭 AI 助手"
                    >
                      <X size={18} strokeWidth={2.2} />
                    </button>
                    <div className="pr-8">
                      <div>
                        <div className="text-xl font-black leading-none">欢迎</div>
                        <div className="mt-2 text-sm font-bold leading-6 text-white/90">
                          您好，我是 AI 助手，直接发送消息即可。
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <div
                      ref={assistantMessagesRef}
                      onScroll={handleAssistantMessagesScroll}
                      className="max-h-[min(46vh,360px)] min-h-[270px] overflow-y-auto bg-white px-4 py-4"
                    >
                    {assistantHistory.length === 0 ? (
                      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          {assistantPromptSnippets.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setAssistantMessage(item)}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-[#0f91dd]/40 hover:bg-[#0f91dd]/8 hover:text-[#0f91dd]"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {assistantHistory.map((item, index) => (
                          <div key={item.id} className="space-y-3">
                            <div className="flex justify-end">
                              <div className="min-w-0 max-w-[86%] rounded-2xl rounded-br-md bg-[#0f91dd] px-3.5 py-2.5 text-sm leading-6 text-white shadow-sm">
                                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.question}</div>
                                {item.attachments && item.attachments.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/20 pt-2">
                                    {item.attachments.map((attachment) => (
                                      <span key={attachment.id} className="inline-flex items-center gap-1 rounded-full bg-white/16 px-2 py-1 text-[11px] font-bold text-white/88">
                                        {attachment.imageDataUrl ? <img src={attachment.imageDataUrl} alt="" className="h-5 w-5 rounded object-cover" /> : <Paperclip size={12} />}
                                        {attachment.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div ref={index === assistantHistory.length - 1 ? assistantLatestReplyRef : undefined} className="flex justify-start">
                              <div className={`min-w-0 max-w-[90%] rounded-2xl rounded-bl-md border px-3.5 py-3 text-sm leading-6 shadow-sm ${
                                item.failed
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                              }`}>
                                <div className="mb-2 flex items-center gap-2 text-xs font-black text-[#0f91dd]">
                                  AI助手
                                </div>
                                {item.pending ? (
                                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-slate-500">
                                    <LoaderCircle size={15} className="animate-spin text-[#0f91dd]" />
                                    正在思考中...
                                  </div>
                                ) : (
                                  <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.answer}</div>
                                )}
                                {!item.pending && item.relatedQuestions.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                                    {item.relatedQuestions.map((question) => (
                                      <button
                                        key={`question-${question.id}`}
                                        type="button"
                                        onClick={() => {
                                          closeAssistant();
                                          navigate(question.path);
                                        }}
                                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-[#0f91dd]/40 hover:text-[#0f91dd]"
                                      >
                                        {question.title}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                    {assistantShowLatestReply && assistantHistory.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => scrollAssistantToLatestReply()}
                      data-assistant-no-drag="true"
                      className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-[#0f91dd] px-3 py-1.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(15,145,221,0.28)] transition hover:bg-[#0b82c9]"
                    >
                      <ChevronDown size={14} strokeWidth={2.4} />
                      最新回复
                    </button>
                    ) : null}
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <input
                      ref={assistantFileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.txt,.csv,.tsv,.json,.md,.markdown,.log,.xml,.html,.htm,.css,.js,.ts,.tsx,.sql,.xls,.xlsx"
                      onChange={(event) => void handleAssistantFiles(event.target.files)}
                      className="hidden"
                    />
                    {assistantAttachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {assistantAttachments.map((attachment) => (
                          <span
                            key={attachment.id}
                            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                              attachment.readable
                                ? "border-[#0f91dd]/20 bg-[#0f91dd]/8 text-[#0f91dd]"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {attachment.imageDataUrl ? (
                              <img src={attachment.imageDataUrl} alt="" className="h-7 w-7 rounded object-cover" />
                            ) : (
                              <Paperclip size={13} />
                            )}
                            <span className="max-w-[180px] truncate">{attachment.name}</span>
                            <span className="text-[10px] opacity-70">{formatAssistantFileSize(attachment.size)}</span>
                            <button
                              type="button"
                              onClick={() => removeAssistantAttachment(attachment.id)}
                              className="ml-0.5 rounded-full p-0.5 transition hover:bg-black/5"
                              aria-label={`移除 ${attachment.name}`}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-end gap-2 rounded-[18px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
                      <textarea
                        value={assistantMessage}
                        onChange={(event) => setAssistantMessage(event.target.value)}
                        onPaste={handleAssistantPaste}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void submitAssistantMessage();
                          }
                        }}
                        rows={1}
                        placeholder="输入消息..."
                        className="min-h-10 flex-1 resize-none bg-transparent py-2 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => assistantFileInputRef.current?.click()}
                        className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#0f91dd]"
                        aria-label="添加附件"
                      >
                        <Paperclip size={19} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void submitAssistantMessage()}
                        disabled={!assistantCanSubmit}
                        className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f91dd] text-white shadow-sm transition hover:bg-[#0b82c9] disabled:cursor-not-allowed disabled:bg-slate-300"
                        aria-label="发送"
                      >
                        {assistantChatMutation.isPending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            )}
              <button
                type="button"
                onClick={(event) => {
                  if (assistantSuppressClickRef.current) {
                    event.preventDefault();
                    return;
                  }
                  if (assistantOpen) {
                    closeAssistant();
                  } else {
                    openAssistant();
                  }
                }}
                onPointerDown={beginAssistantDrag}
                onPointerMove={moveAssistantDrag}
                onPointerUp={endAssistantDrag}
                onPointerCancel={endAssistantDrag}
                onPointerEnter={() => preloadNavigationTarget("/assistant")}
                onFocus={() => preloadNavigationTarget("/assistant")}
                onTouchStart={() => preloadNavigationTarget("/assistant")}
                className={`group absolute inset-0 z-20 inline-flex h-[132px] w-[104px] touch-none select-none items-end justify-center rounded-[32px] p-3 -m-3 ${
                  assistantDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                aria-label={assistantOpen ? "关闭 AI 助手" : "打开 AI 助手"}
                aria-expanded={assistantOpen}
              >
                <span className="absolute -top-3 left-1/2 z-10 inline-flex h-10 -translate-x-1/2 items-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 text-sm font-black text-[#0f91dd] shadow-[0_10px_28px_rgba(15,23,42,0.14)] transition group-hover:border-[#0f91dd]/30 group-hover:bg-[#f1f9ff]">
                  AI助手
                </span>
                <span className="relative inline-flex h-[86px] w-[78px] items-center justify-center transition group-hover:scale-[1.04]">
                  <img src={assistantAnimatedAvatarSrc} alt="" draggable={false} className="h-[82px] w-[82px] -scale-x-100 select-none object-contain drop-shadow-[0_13px_16px_rgba(0,55,84,0.30)]" />
                  <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-[#16c784] ring-2 ring-white" />
                </span>
              </button>
          </>
        </div>
      )}

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

function renderCountBadge(count: number, tone: "teal" | "rose") {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  const toneClassName = tone === "teal"
    ? "bg-teal-500 text-white"
    : "bg-rose-500 text-white";
  return (
    <span className={`absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-black leading-none shadow-sm ${toneClassName}`}>
      {label}
    </span>
  );
}
