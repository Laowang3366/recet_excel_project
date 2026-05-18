import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, CheckCircle2, Clock3, Gift, Play, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../lib/api";
import { handleLoginRequiredError, showLoginRequiredToast } from "../lib/auth-required";
import { startCampaignLevel } from "../lib/practice-campaign";
import { getCampaignQuestionListPath } from "../lib/practice-campaign-ui";
import { practiceKeys } from "../lib/query-keys";
import { useSession } from "../lib/session";

type DailyChallenge = {
  levelId?: number | null;
  title?: string | null;
  rewardExp?: number;
  rewardPoints?: number;
  completed?: boolean;
  rewardGranted?: boolean;
  configured?: boolean;
};

type DailyChallengeResponse = {
  challenge?: DailyChallenge;
};

type CampaignLevelDetailResponse = {
  level?: {
    questionId?: number | null;
  } | null;
  chapter?: {
    id?: number | string | null;
  } | null;
  question?: {
    id?: number | null;
  } | null;
};

export function PracticeCampaignDaily() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSession();
  const dailyQuery = useQuery({
    queryKey: practiceKeys.campaignDaily(),
    queryFn: () => api.get<DailyChallengeResponse>("/api/practice/campaign/daily-challenge", { silent: true }),
  });

  const challenge = dailyQuery.data?.challenge;

  const handleStartDaily = async () => {
    if (!isAuthenticated) {
      showLoginRequiredToast("请先登录后再开始每日挑战");
      return;
    }
    if (!challenge?.levelId) {
      return;
    }
    try {
      const levelDetail = await api.get<CampaignLevelDetailResponse>(`/api/practice/campaign/levels/${challenge.levelId}`, { silent: true });
      const level = levelDetail?.level;
      const chapter = levelDetail?.chapter;
      const result = await startCampaignLevel(challenge.levelId, level?.questionId || levelDetail?.question?.id);
      navigate(`/practice/question/${result.questionId}`, {
        state: {
          backTo: getCampaignQuestionListPath(chapter?.id),
          campaignLevel: level,
          campaignChapter: chapter,
          campaignAttemptId: result.attemptId,
        },
      });
    } catch (error: unknown) {
      if (!handleLoginRequiredError(error, "请先登录后再开始每日挑战")) {
        toast.error(error instanceof Error ? error.message : "开始答题失败");
      }
    }
  };

  return (
    <div className="mx-auto max-w-[960px] px-4 py-5 sm:px-6 sm:py-6">
      <button type="button" onClick={() => navigate("/practice")} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft size={16} />
        返回闯关大厅
      </button>

      <div className="rounded-[36px] border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffedd5_100%)] p-6 shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-[12px] font-black tracking-[0.18em] text-amber-700">
          <Sparkles size={14} />
          DAILY CHALLENGE
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">每日挑战</h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">每天一关，奖励更高，适合作为闯关节奏之外的额外冲刺目标。</p>

        {challenge?.levelId ? (
          <div className="mt-6 rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-sm">
            <div className="text-xl font-black text-slate-900">{challenge.title}</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-amber-50 px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-amber-700"><Award size={14} /> 奖励经验</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{challenge.rewardExp ?? 0}</div>
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-amber-700"><Gift size={14} /> 奖励积分</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{challenge.rewardPoints ?? 0}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {challenge.completed ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600">
                  <CheckCircle2 size={14} />
                  今日已完成
                </span>
              ) : null}
              {challenge.rewardGranted ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-bold text-sky-600">
                  <Gift size={14} />
                  奖励已发放
                </span>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleStartDaily()}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-black text-white"
              >
                <Play size={16} />
                {challenge.completed ? "再次开始答题" : "开始答题"}
              </button>
              {challenge.configured === false ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500">
                  <Clock3 size={14} />
                  当前为系统自动推荐挑战
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-white/70 px-6 py-14 text-center">
            <div className="text-sm font-bold text-slate-600">今日挑战暂未开放</div>
            <div className="mt-2 text-xs text-slate-400">请先在后台配置每日挑战，或等待系统推荐可用关卡。</div>
          </div>
        )}
      </div>
    </div>
  );
}
