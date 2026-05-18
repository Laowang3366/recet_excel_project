import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Flame } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import { homeKeys, mallKeys, pointsKeys, profileKeys } from "../../lib/query-keys";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { getDialogErrorMessage } from "./dialog-errors";

export type CheckinStatus = {
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

type CheckinActionResponse = {
  gainedPoints?: number;
  gainedExp?: number;
};

type CheckinDialogProps = {
  open: boolean;
  status?: CheckinStatus;
  onOpenChange: (open: boolean) => void;
};

export function useCheckinStatusQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: homeKeys.checkinStatus(),
    enabled: isAuthenticated,
    queryFn: () => api.get<CheckinStatus>("/api/checkin/status", { silent: true }),
  });
}

export function CheckinDialog({ open, status: checkinStatus, onOpenChange }: CheckinDialogProps) {
  const queryClient = useQueryClient();
  const invalidateCheckinCaches = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: homeKeys.checkinStatus() }),
      queryClient.invalidateQueries({ queryKey: pointsKeys.overview() }),
      queryClient.invalidateQueries({ queryKey: pointsKeys.records() }),
      queryClient.invalidateQueries({ queryKey: pointsKeys.tasks() }),
      queryClient.invalidateQueries({ queryKey: mallKeys.overview() }),
      queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
    ]);

  const checkinMutation = useMutation({
    mutationFn: () => api.post<CheckinActionResponse>("/api/checkin", {}),
    onSuccess: async (result) => {
      toast.success(`签到成功，+${result?.gainedPoints ?? 0} 积分，+${result?.gainedExp ?? 0} 经验`);
      await invalidateCheckinCaches();
    },
    onError: (error: unknown) => {
      toast.error(getDialogErrorMessage(error, "签到失败"));
    },
  });

  const makeupCheckinMutation = useMutation({
    mutationFn: () => api.post<CheckinActionResponse>("/api/checkin/makeup", {}),
    onSuccess: async (result) => {
      toast.success(`补签成功，+${result?.gainedPoints ?? 0} 积分，+${result?.gainedExp ?? 0} 经验`);
      await invalidateCheckinCaches();
    },
    onError: (error: unknown) => {
      toast.error(getDialogErrorMessage(error, "补签失败"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  );
}
