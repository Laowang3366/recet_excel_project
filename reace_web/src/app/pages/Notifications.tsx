import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Radio,
  CheckCircle2,
  CheckSquare,
  Square,
  Settings,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { formatRelativeTime, formatDateTime } from "../lib/format";
import { notificationKeys } from "../lib/query-keys";
import { openGlobalConfirm } from "../components/GlobalConfirmPromptDialog";
import {
  getVisibleNotificationTypeFilter,
  getNotificationTabCount,
  normalizeNotificationTab,
  notificationFilterTabs,
  shouldRenderNotificationItem,
  type NotificationCounts,
  type NotificationTabId,
} from "../lib/notification-display";

const PAGE_SIZE = 7;

type NotificationItem = {
  id: number;
  type: string;
  title?: string | null;
  content?: string | null;
  isRead?: boolean;
  relatedId?: number | string | null;
  createTime?: string | null;
};

const typeConfig: Record<string, { icon: LucideIcon; label: string; color: string; bg: string }> = {
  system: { icon: Gift, label: "积分通知", color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
  site_notification: { icon: Radio, label: "系统公告", color: "text-slate-600", bg: "bg-slate-50 border-slate-100" },
  feedback_result: { icon: Bell, label: "反馈处理", color: "text-teal-600", bg: "bg-teal-50 border-teal-100" },
};

function getTypeConfig(type: string) {
  return typeConfig[type] || { icon: Bell, label: "通知", color: "text-slate-600", bg: "bg-slate-50 border-slate-100" };
}

function hasLink(notification: NotificationItem): boolean {
  if (notification.type === "site_notification" && notification.relatedId) return true;
  return false;
}

function tabTypeFilter(tab: NotificationTabId): string | undefined {
  switch (tab) {
    case "points": return "system";
    case "announcements": return "site_notification";
    default: return getVisibleNotificationTypeFilter();
  }
}

function useNotificationCounts() {
  return useQuery({
    queryKey: notificationKeys.counts(),
    queryFn: () => api.get<NotificationCounts>("/api/notifications/counts", { silent: true }),
  });
}

export function Notifications() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const initialTab = useMemo(() => {
    return normalizeNotificationTab(searchParams.get("tab"));
  }, [searchParams]);
  const [activeTab, setActiveTab] = useState<NotificationTabId>(initialTab);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const typeFilter = useMemo(() => tabTypeFilter(activeTab), [activeTab]);

  const gotoPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 切换 tab 时重置分页和选中
  useEffect(() => {
    gotoPage(1);
    setSelectedIds(new Set());
    setExpandedId(null);
  }, [activeTab]);

  // 主列表查询
  const notificationsQuery = useQuery({
    queryKey: notificationKeys.list({ page, limit: PAGE_SIZE, type: typeFilter ?? "all" }),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (typeFilter) params.set("type", typeFilter);
      return api.get<{ notifications: NotificationItem[]; total: number }>(`/api/notifications?${params}`, { silent: true });
    },
  });

  const notifications = notificationsQuery.data?.notifications || [];
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => shouldRenderNotificationItem(notification.type)),
    [notifications],
  );
  const total = notificationsQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 各分类数量（单次请求）
  const countsQuery = useNotificationCounts();
  const counts = countsQuery.data;

  const notificationTabIcons = {
    all: <Bell size={18} strokeWidth={1.5} />,
    points: <Gift size={18} strokeWidth={1.5} />,
    announcements: <Radio size={18} strokeWidth={1.5} />,
  };

  const tabs = notificationFilterTabs.map((tab) => ({
    ...tab,
    icon: notificationTabIcons[tab.id],
    count: getNotificationTabCount(tab, counts),
  }));

  const switchTab = (tabId: NotificationTabId) => {
    setActiveTab(tabId);
    setSearchParams(tabId === "all" ? {} : { tab: tabId });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  // 标记全部已读
  const markAllReadMutation = useMutation({
    mutationFn: () => api.put("/api/notifications/read-all", {}),
    onSuccess: async () => {
      toast.success("已将所有通知标为已读");
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  // 标记单条已读
  const markReadMutation = useMutation({
    mutationFn: (notificationId: number) => api.put(`/api/notifications/${notificationId}/read`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  // 单条删除
  const deleteMutation = useMutation({
    mutationFn: (notificationId: number) => api.delete(`/api/notifications/${notificationId}`),
    onSuccess: async (_data, notificationId) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
      toast.success("已删除通知");
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  // 批量删除
  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.delete("/api/notifications/batch", { ids }),
    onSuccess: async () => {
      const count = selectedIds.size;
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      toast.success(`已删除 ${count} 条通知`);
    },
  });

  // 选择逻辑
  const allVisibleOnPageSelected = visibleNotifications.length > 0 && visibleNotifications.every((n) => selectedIds.has(n.id));
  const someOnPageSelected = visibleNotifications.some((n) => selectedIds.has(n.id));

  const toggleSelectAll = () => {
    if (allVisibleOnPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleNotifications.map((n) => n.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await openGlobalConfirm({
      message: `确认删除选中的 ${selectedIds.size} 条通知？`,
      destructive: true,
      confirmLabel: "删除",
    });
    if (!confirmed) return;
    await batchDeleteMutation.mutateAsync(Array.from(selectedIds));
  };

  const resolveNotificationLink = (notification: NotificationItem) => {
    switch (notification.type) {
      case "site_notification":
        return notification.relatedId ? `/notification/${notification.relatedId}` : null;
      default:
        return null;
    }
  };

  const handleClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markReadMutation.mutateAsync(notification.id);
    }
    const link = resolveNotificationLink(notification);
    if (link) {
      navigate(link);
    } else {
      setExpandedId(expandedId === notification.id ? null : notification.id);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const confirmed = await openGlobalConfirm({ message: "确认删除此通知？", destructive: true, confirmLabel: "删除" });
    if (!confirmed) return;
    await deleteMutation.mutateAsync(id);
  };

  // 分页按钮
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 pb-20">
      {/* 顶部标题栏 */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <ChevronLeft size={16} strokeWidth={1.8} />
            返回
          </button>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-wide">通知中心</h1>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleBatchDelete}
              disabled={batchDeleteMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
            >
              <Trash2 size={15} />
              删除选中 ({selectedIds.size})
            </motion.button>
          )}
          <button
            onClick={() => markAllReadMutation.mutateAsync()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
          >
            <CheckCircle2 size={16} strokeWidth={1.5} /> 全部标为已读
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* 左侧分类 */}
        <div className="hidden w-full shrink-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm lg:sticky lg:top-24 lg:block lg:w-56">
          <div className="p-2 space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-[14px] ${
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-gray-50 hover:text-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={activeTab === tab.id ? "text-slate-700" : "text-slate-400"}>{tab.icon}</div>
                  {tab.label}
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === tab.id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 p-3">
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-2 text-[13px] font-bold text-slate-400 hover:text-slate-700 transition-colors w-full justify-center py-1"
            >
              <Settings size={14} strokeWidth={1.5} /> 通知设置
            </button>
          </div>
        </div>

        {/* 右侧通知列表 */}
        <div className="flex-1 w-full bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {/* 全选栏 */}
          {visibleNotifications.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-[13px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                {allVisibleOnPageSelected ? (
                  <CheckSquare size={16} className="text-teal-600" />
                ) : someOnPageSelected ? (
                  <CheckSquare size={16} className="text-slate-400" />
                ) : (
                  <Square size={16} />
                )}
                {allVisibleOnPageSelected ? "取消全选" : "全选本页"}
              </button>
              <span className="text-[12px] text-slate-400 font-medium">
                共 {total} 条通知，第 {page}/{totalPages} 页
              </span>
            </div>
          )}

          {/* 通知列表 */}
          <div className="divide-y divide-slate-100">
            <AnimatePresence mode="popLayout">
              {visibleNotifications.length > 0 ? (
                visibleNotifications.map((notification) => {
                  const config = getTypeConfig(notification.type);
                  const Icon = config.icon;
                  const linked = hasLink(notification);
                  const expanded = expandedId === notification.id;
                  const selected = selectedIds.has(notification.id);

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      key={notification.id}
                      className={`transition-all ${
                        selected ? "bg-teal-50/50" : !notification.isRead ? "bg-blue-50/30" : "hover:bg-slate-50/80"
                      }`}
                    >
                      <div
                        onClick={() => handleClick(notification)}
                        className="flex items-start gap-4 p-5 cursor-pointer"
                      >
                        {/* 选择框 */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(notification.id); }}
                          className="shrink-0 mt-1 text-slate-300 hover:text-teal-600 transition-colors"
                        >
                          {selected ? <CheckSquare size={18} className="text-teal-600" /> : <Square size={18} />}
                        </button>

                        {/* 图标 */}
                        <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border ${config.bg} relative`}>
                          <Icon size={20} className={config.color} />
                          {!notification.isRead && (
                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-500 rounded-full border-2 border-white shadow-sm" />
                          )}
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                            <span className="text-[12px] font-medium text-slate-400">
                              {formatRelativeTime(notification.createTime)}
                            </span>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-rose-500 rounded-full shrink-0" />
                            )}
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <p className={`text-[14px] leading-relaxed ${notification.isRead ? "text-slate-600" : "text-slate-800 font-bold"}`}>
                              {notification.content}
                            </p>
                            {!linked && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : notification.id); }}
                                className="shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                              >
                                <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="shrink-0 flex items-center gap-1 pt-0.5">
                          {linked && <ExternalLink size={14} className="text-slate-300" />}
                          <button
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            onClick={(e) => handleDelete(e, notification.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* 展开详情 */}
                      <AnimatePresence>
                        {expanded && !linked && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-0">
                              <div className="bg-slate-100/80 rounded-xl p-4 border border-slate-200/60">
                                <div className="mb-3 flex items-center justify-end">
                                  <span className="text-[12px] text-slate-400">{formatDateTime(notification.createTime)}</span>
                                </div>
                                <p className="text-[14px] text-slate-600 leading-relaxed">{notification.content}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              ) : !notificationsQuery.isLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-24"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                    <Bell size={32} strokeWidth={1.5} className="text-slate-300" />
                  </div>
                  <p className="text-[15px] font-bold text-slate-500">暂时没有新通知</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => gotoPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft size={18} />
              </button>
              {pageNumbers[0] > 1 && (
                <>
                  <button onClick={() => gotoPage(1)} className="w-9 h-9 rounded-lg text-[13px] font-bold text-slate-500 hover:bg-white transition-colors">1</button>
                  {pageNumbers[0] > 2 && <span className="text-slate-300 text-xs px-1">...</span>}
                </>
              )}
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => gotoPage(p)}
                  className={`w-9 h-9 rounded-lg text-[13px] font-bold transition-colors ${
                    p === page ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-white"
                  }`}
                >
                  {p}
                </button>
              ))}
              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <>
                  {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="text-slate-300 text-xs px-1">...</span>}
                  <button onClick={() => gotoPage(totalPages)} className="w-9 h-9 rounded-lg text-[13px] font-bold text-slate-500 hover:bg-white transition-colors">{totalPages}</button>
                </>
              )}
              <button
                onClick={() => gotoPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
