import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Package, Ticket, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import { homeKeys, profileKeys } from "../../lib/query-keys";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { getDialogErrorMessage } from "./dialog-errors";

type UserPropRecord = {
  id: number;
  key?: string | null;
  type?: string | null;
  name?: string | null;
  actionLabel?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  current?: boolean;
  canUse?: boolean;
  canUnequip?: boolean;
};

type PropActionResponse = {
  message?: string;
};

type UserPropsDialogProps = {
  open: boolean;
  isAuthenticated: boolean;
  onOpenChange: (open: boolean) => void;
};

function resolvePropIcon(item: UserPropRecord): LucideIcon {
  if (item.key === "checkin_makeup_card") return Ticket;
  if (item.type === "badge") return Award;
  if (item.type === "privilege") return Wrench;
  return Package;
}

function resolvePropTypeLabel(type?: string | null) {
  const map: Record<string, string> = {
    badge: "头衔",
    prop: "道具",
    privilege: "权益",
    coupon: "优惠券",
    virtual: "虚拟物品",
  };
  return type ? map[type] || type : "道具";
}

export function UserPropsDialog({ open, isAuthenticated, onOpenChange }: UserPropsDialogProps) {
  const queryClient = useQueryClient();
  const propsQuery = useQuery({
    queryKey: profileKeys.props(),
    enabled: isAuthenticated && open,
    queryFn: () => api.get<{ records: UserPropRecord[] }>("/api/users/me/props", { silent: true }),
  });
  const propsRecords = propsQuery.data?.records || [];

  const usePropMutation = useMutation({
    mutationFn: (entitlementId: number) => api.post<PropActionResponse>(`/api/users/me/props/${entitlementId}/use`, {}),
    onSuccess: async (result) => {
      toast.success(result?.message || "道具已使用");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKeys.props() }),
        queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: homeKeys.checkinStatus() }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(getDialogErrorMessage(error, "道具使用失败"));
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
      toast.error(getDialogErrorMessage(error, "取消佩戴失败"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                      }`}
                      >
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
  );
}
