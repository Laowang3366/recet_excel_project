import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../lib/api";
import { handleLoginRequiredError } from "../lib/auth-required";
import { formatDateTime } from "../lib/format";
import { startCampaignLevel } from "../lib/practice-campaign";
import { getCampaignQuestionListPath } from "../lib/practice-campaign-ui";
import { practiceKeys } from "../lib/query-keys";

type WrongQuestionRecord = {
  id: number;
  title?: string | null;
  wrongCount?: number;
  difficulty?: number | string | null;
  lastWrongTime?: string | null;
  recommendedLevelId?: number | null;
};

type CampaignWrongsResponse = {
  records?: WrongQuestionRecord[];
};

type CampaignLevelDetailResponse = {
  level?: {
    id?: number;
    questionId?: number | null;
  } | null;
  chapter?: {
    id?: number | string | null;
  } | null;
  question?: {
    id?: number | null;
  } | null;
};

export function PracticeCampaignWrongs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wrongsQuery = useQuery({
    queryKey: practiceKeys.campaignWrongs(),
    queryFn: () => api.get<CampaignWrongsResponse>("/api/practice/campaign/wrongs", { silent: true }),
  });
  const resolveMutation = useMutation({
    mutationFn: (id: number) => api.put(`/api/practice/campaign/wrongs/${id}/resolve`, {}, { silent: true }),
    onSuccess: async () => {
      toast.success("已标记为已掌握");
      await queryClient.invalidateQueries({ queryKey: practiceKeys.campaignWrongs() });
    },
    onError: (error) => {
      if (!handleLoginRequiredError(error, "请先登录后再管理错题")) {
        toast.error(error instanceof Error ? error.message : "错题状态更新失败");
      }
    },
  });

  const records = wrongsQuery.data?.records || [];

  const handleRetry = async (levelId?: number | null) => {
    if (!levelId) {
      return;
    }
    try {
      const levelDetail = await api.get<CampaignLevelDetailResponse>(`/api/practice/campaign/levels/${levelId}`, { silent: true });
      const level = levelDetail?.level;
      const chapter = levelDetail?.chapter;
      const result = await startCampaignLevel(levelId, level?.questionId || levelDetail?.question?.id);
      navigate(`/practice/question/${result.questionId}`, {
        state: {
          backTo: getCampaignQuestionListPath(chapter?.id),
          campaignLevel: level,
          campaignChapter: chapter,
          campaignAttemptId: result.attemptId,
        },
      });
    } catch (error: unknown) {
      if (!handleLoginRequiredError(error, "请先登录后再开始答题")) {
        toast.error(error instanceof Error ? error.message : "开始答题失败");
      }
    }
  };

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-6">
      <button type="button" onClick={() => navigate("/practice")} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft size={16} />
        返回闯关大厅
      </button>

      <div className="rounded-[34px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="text-[13px] font-black uppercase tracking-[0.18em] text-slate-400">WRONG BOOK</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">错题重练</h1>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {records.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-5 text-left transition hover:border-rose-200 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-black text-slate-900">{item.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-bold text-slate-400">
                    <span className="rounded-full bg-white px-3 py-1">错误次数 {item.wrongCount}</span>
                    <span className="rounded-full bg-white px-3 py-1">难度 {item.difficulty ?? 1}</span>
                    <span className="rounded-full bg-white px-3 py-1">{item.lastWrongTime ? formatDateTime(item.lastWrongTime) : "-"}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRetry(item.recommendedLevelId)}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-600"
                  >
                    <RotateCcw size={15} />
                    开始答题
                    <ChevronRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveMutation.mutate(item.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600"
                  >
                    <CheckCircle2 size={15} />
                    标记已掌握
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {records.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
              <div className="text-sm font-bold text-slate-600">当前没有待重练错题</div>
              <div className="mt-2 text-xs text-slate-400">闯关失败后，错题会自动进入这里。</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
