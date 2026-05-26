import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { parseNotificationMeta } from "../../admin/notification-form";
import { api } from "../../lib/api";
import { notificationKeys } from "../../lib/query-keys";
import { renderRichContent } from "../../lib/rich-content";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import type { LayoutNotification } from "./NotificationDropdown";

type SitePopupNotificationDialogProps = {
  isAuthenticated: boolean;
};

export function SitePopupNotificationDialog({ isAuthenticated }: SitePopupNotificationDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const popupDismissedIdsRef = useRef<Set<number>>(new Set());
  const [popupNotification, setPopupNotification] = useState<LayoutNotification | null>(null);

  const popupNotificationsQuery = useQuery({
    queryKey: notificationKeys.list({ page: 1, limit: 20, type: "site_notification", scope: "popup-notification" }),
    enabled: isAuthenticated,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    queryFn: () => api.get<{ notifications: LayoutNotification[] }>("/api/notifications?page=1&limit=20&type=site_notification", { silent: true }),
  });
  const popupNotifications = popupNotificationsQuery.data?.notifications || [];

  const markNotificationReadMutation = useMutation({
    mutationFn: (notificationId: number) => api.put(`/api/notifications/${notificationId}/read`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      popupDismissedIdsRef.current.clear();
      setPopupNotification(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || popupNotification) {
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

  const handlePrimaryAction = async () => {
    const current = popupNotification;
    const meta = parseNotificationMeta(current?.attachments);
    await handleClosePopupNotification();
    const actionUrl = current?.targetLink || meta.actionUrl;
    if (!actionUrl) return;
    if (actionUrl.startsWith("http://") || actionUrl.startsWith("https://")) {
      window.location.href = actionUrl;
      return;
    }
    navigate(actionUrl);
  };

  const popupMeta = parseNotificationMeta(popupNotification?.attachments);

  return (
    <Dialog
      open={Boolean(popupNotification)}
      onOpenChange={(open) => {
        if (!open) {
          void handleClosePopupNotification();
        }
      }}
    >
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
                dangerouslySetInnerHTML={{ __html: renderRichContent(popupNotification.detailContent) }}
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
              onClick={() => void handlePrimaryAction()}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-5 text-sm font-semibold text-white transition hover:bg-teal-600"
            >
              {popupMeta.actionUrl ? popupMeta.actionText || "立即查看" : "关闭通知"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
