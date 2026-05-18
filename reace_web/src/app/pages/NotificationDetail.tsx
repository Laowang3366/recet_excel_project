import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, FileText, Download, Trash2, Clock, Share2, Eye, Users, AlertCircle, Link as LinkIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { normalizeAvatarUrl, normalizeImageUrl, parseJsonText } from "../lib/mappers";
import { notificationKeys } from "../lib/query-keys";
import { openGlobalConfirm } from "../components/GlobalConfirmPromptDialog";

function formatNotificationKind(value?: string | null) {
  const normalized = String(value || "").toLowerCase();
  const map: Record<string, string> = {
    system: "系统通知",
    announcement: "站内公告",
    activity: "活动通知",
    popup: "弹窗通知",
  };
  return map[normalized] || "站内通知";
}

function formatRoleList(value?: string | null) {
  if (!value || !value.trim()) return "指定角色";
  const map: Record<string, string> = {
    admin: "管理员",
    moderator: "运营",
    user: "普通用户",
  };
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => map[item.toLowerCase()] || item)
    .join("、");
}

export function NotificationDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();

  const notificationQuery = useQuery({
    queryKey: notificationKeys.detail(id || "unknown"),
    enabled: Boolean(id),
    queryFn: async () => {
      try {
        return await api.get(`/api/notifications/${id}`, { silent: true });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          try {
            return await api.get(`/api/notifications/announcements/${id}`, { silent: true });
          } catch (inner) {
            if (inner instanceof ApiError && inner.status === 404) return null;
            throw inner;
          }
        }
        throw e;
      }
    },
    retry: false,
  });
  const notification = notificationQuery.data;
  const isLoading = notificationQuery.isLoading;

  const markReadMutation = useMutation({
    mutationFn: (notificationId: number) => api.put(`/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  useEffect(() => {
    if (notification?.id && !notification?.isAnnouncement) {
      markReadMutation.mutate(notification.id);
    }
  }, [notification?.id, notification?.isAnnouncement]);

  const handleShare = async () => {
    const url = notification?.targetLink
      ? `${window.location.origin}${notification.targetLink}`
      : `${window.location.origin}/notification/${id}`;
    await navigator.clipboard.writeText(url);
    toast.success("链接已复制到剪贴板");
  };

  const handleBackDelete = async () => {
    const confirmed = await openGlobalConfirm({ message: "确认删除此通知？", destructive: true, confirmLabel: "确认删除" });
    if (!confirmed) return;
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    navigate("/notifications", { replace: true });
  };

  // 通知不存在或已被删除（API 返回 null 表示请求失败）
  if (!isLoading && !notification) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 pb-20">
        <button onClick={() => navigate("/notifications", { replace: true })} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 group">
          <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-bold text-[14px]">返回通知中心</span>
        </button>
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200">
            <AlertCircle size={32} className="text-slate-400" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 mb-2">通知不存在</h2>
          <p className="text-sm text-slate-500 mb-8">该通知可能已被删除或您没有访问权限</p>
          <div className="flex gap-3">
            <button onClick={() => navigate("/notifications", { replace: true })} className="px-5 py-2.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
              返回通知中心
            </button>
            <button onClick={handleBackDelete} className="px-5 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors">
              删除此通知
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || notificationQuery.isFetching) {
    return <div className="p-10 text-center text-slate-400">加载中...</div>;
  }

  const attachments = parseJsonText<any[]>(notification?.attachments, []);
  const targetLink = notification?.targetLink || null;
  const isAnnouncement = Boolean(notification?.isAnnouncement);

  const handleDownload = (file: any) => {
    const url = typeof file === "string" ? file : file?.url;
    if (!url) return;
    window.open(normalizeImageUrl(url), "_blank", "noopener,noreferrer");
    toast.success(`开始下载: ${typeof file === "string" ? file : file?.name || "附件"}`);
  };

  const handleDelete = async () => {
    const confirmed = await openGlobalConfirm({ message: "确认删除此通知？", destructive: true, confirmLabel: "确认删除" });
    if (!confirmed) return;
    await api.delete(`/api/notifications/${notification.id}`);
    toast.success("通知已删除");
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    navigate("/notifications", { replace: true });
  };

  const readCount = notification.readCount || 0;
  const totalCount = notification.totalCount || 0;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 pb-20">
      {/* 返回导航 */}
      <button onClick={() => navigate("/notifications", { replace: true })} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 group">
        <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-bold text-[14px]">返回通知中心</span>
      </button>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 主内容区 */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden"
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 to-cyan-500" />

          <div className="p-6 sm:p-10">
            {/* 标题与操作 */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shrink-0">
                  <Bell size={24} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                    {formatNotificationKind(notification.type)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleShare} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all" title="分享">
                  <Share2 size={18} />
                </button>
                <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="删除">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* 标题 */}
            <h1 className="text-2xl font-extrabold text-slate-800 mb-6 leading-tight">
              {notification.title}
            </h1>

            {/* 元信息 */}
            <div className="flex flex-wrap items-center gap-3 mb-8 pb-8 border-b border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
                <img src={normalizeAvatarUrl(notification.sender?.avatar, notification.sender?.username)} alt="" className="w-6 h-6 rounded-full ring-2 ring-white" />
                <span className="text-[13px] font-bold text-slate-700">{notification.sender?.username || "社区管理委员会"}</span>
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">官方</span>
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-slate-400 font-medium bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
                <Clock size={14} />
                {formatDateTime(notification.sendTime || notification.createTime)}
              </div>
              {totalCount > 0 && (
                <div className="flex items-center gap-1.5 text-[13px] text-slate-400 font-medium bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
                  <Eye size={14} />
                  {readCount}/{totalCount} 已读
                </div>
              )}
            </div>

            {/* 正文 */}
            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed mb-10">
              {isAnnouncement ? (
                <div dangerouslySetInnerHTML={{ __html: notification.content }} />
              ) : (
                <div className="whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-700">
                  {notification.content}
                </div>
              )}
            </div>

            {targetLink && (
              <div className="mb-8 flex justify-start">
                <button
                  type="button"
                  onClick={() => navigate(targetLink)}
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700 transition hover:bg-teal-100"
                >
                  <LinkIcon size={16} />
                  查看相关内容
                </button>
              </div>
            )}

            {/* 附件 */}
            {attachments.length > 0 && (
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <LinkIcon size={16} className="text-teal-500" />
                  附件下载 ({attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((file: any, index: number) => (
                    <div key={index} onClick={() => handleDownload(file)} className="flex items-center p-3 bg-white rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-sm transition-all group cursor-pointer">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3 shrink-0 bg-emerald-100 text-emerald-600">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{typeof file === "string" ? file : file.name || "附件"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{typeof file === "string" ? "" : file.size || ""}</p>
                      </div>
                      <Download size={16} className="text-slate-400 group-hover:text-teal-600 transition-colors shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 底部返回 */}
            <div className="pt-6 border-t border-slate-100 flex justify-center">
              <button onClick={() => navigate("/notifications", { replace: true })} className="flex items-center gap-2 text-[14px] font-bold text-slate-600 hover:text-teal-600 bg-slate-50 hover:bg-teal-50 px-6 py-2.5 rounded-xl border border-slate-200 hover:border-teal-200 transition-all">
                <ArrowLeft size={16} />
                返回通知中心
              </button>
            </div>
          </div>
        </motion.div>

        {/* 右侧边栏 */}
        <div className="w-full lg:w-72 shrink-0 space-y-6">
          {/* 通知统计 */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
            <h3 className="font-bold text-[15px] text-slate-800 mb-4 flex items-center gap-2">
              <Users size={18} className="text-teal-600" />
              通知概览
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-500">发送对象</span>
                <span className="font-bold text-slate-700">{notification.targetType === "all" ? "全部用户" : formatRoleList(notification.targetRoles)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-500">发送人数</span>
                <span className="font-bold text-slate-700">{totalCount} 人</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-500">已读人数</span>
                <span className="font-bold text-teal-600">{readCount} 人</span>
              </div>
              {totalCount > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>阅读率</span>
                    <span className="font-bold">{Math.round((readCount / totalCount) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all" style={{ width: `${Math.round((readCount / totalCount) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* 附件快捷入口 */}
          {attachments.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
              <h3 className="font-bold text-[15px] text-slate-800 mb-4 flex items-center gap-2">
                <FileText size={18} className="text-teal-600" />
                附件列表
              </h3>
              <div className="space-y-2">
                {attachments.map((file: any, index: number) => (
                  <div key={index} onClick={() => handleDownload(file)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-teal-50 cursor-pointer transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="text-[13px] font-medium text-slate-700 group-hover:text-teal-600 truncate">{typeof file === "string" ? file : file.name || "附件"}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
