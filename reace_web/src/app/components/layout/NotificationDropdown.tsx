import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router";
import type { RefObject } from "react";

import { formatRelativeTime } from "../../lib/format";
import { getCompactHeaderNotificationButtonClassName } from "../../lib/layout-display";

export type LayoutNotification = {
  id: number;
  type: string;
  title?: string | null;
  content?: string | null;
  detailContent?: string | null;
  relatedId?: number | null;
  isRead?: number | boolean | null;
  announcementType?: string | null;
  createTime?: string | null;
};

type NotificationDropdownProps = {
  compact: boolean;
  isAuthenticated: boolean;
  open: boolean;
  unreadCount: number;
  items: LayoutNotification[];
  rootRef: RefObject<HTMLDivElement>;
  loginPath: string;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  onMarkAllRead: () => Promise<void>;
  onMarkRead: (id: number) => Promise<void>;
  resolveNotificationLink: (notification: LayoutNotification) => string;
};

function renderCountBadge(count: number) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black leading-none text-white shadow-sm">
      {label}
    </span>
  );
}

export function NotificationDropdown({
  compact,
  isAuthenticated,
  open,
  unreadCount,
  items,
  rootRef,
  loginPath,
  onOpenChange,
  onNavigate,
  onMarkAllRead,
  onMarkRead,
  resolveNotificationLink,
}: NotificationDropdownProps) {
  if (!compact && !isAuthenticated) return null;

  const panelClassName = compact
    ? "absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white/95 text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.20)] backdrop-blur-xl"
    : "absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl";

  const handleOpen = () => {
    if (!isAuthenticated) {
      onNavigate(loginPath);
      return;
    }
    onOpenChange(!open);
  };

  return (
    <div className={compact ? "relative shrink-0" : "relative"} ref={rootRef}>
      <button
        type="button"
        onClick={handleOpen}
        className={compact ? getCompactHeaderNotificationButtonClassName() : "relative rounded-full p-2 text-slate-500 transition-colors hover:bg-gray-100"}
        title={isAuthenticated ? "通知" : "登录后查看通知"}
        aria-label={isAuthenticated ? "打开通知" : "登录后查看通知"}
      >
        <Bell size={compact ? 18 : 20} strokeWidth={compact ? 1.8 : 2} />
        {isAuthenticated ? renderCountBadge(unreadCount) : null}
      </button>

      <AnimatePresence>
        {isAuthenticated && open ? (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(2px)" }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={panelClassName}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-50 p-4">
              <h3 className="font-semibold text-slate-800">通知</h3>
              <button
                type="button"
                onClick={() => void onMarkAllRead()}
                className="text-xs text-teal-600 hover:text-teal-700"
              >
                全部已读
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 border-b border-gray-50 bg-slate-50/70 px-3 py-3">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onNavigate("/notifications?tab=points");
                }}
                className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-50"
              >
                积分通知
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onNavigate("/notifications?tab=announcements");
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                网站公告
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={async () => {
                    if (!item.isRead) {
                      await onMarkRead(item.id);
                    }
                    onOpenChange(false);
                    onNavigate(resolveNotificationLink(item));
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
              {items.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-400">暂无通知</div>
              )}
            </div>
            <div className="border-t border-gray-50 bg-slate-50 p-3 text-center">
              <Link
                to="/notifications"
                onClick={() => onOpenChange(false)}
                className="text-[13px] font-bold text-slate-600 transition-colors hover:text-slate-900"
              >
                查看全部通知
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
