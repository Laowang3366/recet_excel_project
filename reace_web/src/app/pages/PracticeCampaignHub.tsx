import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  History,
  Loader2,
  Lock,
  Map as MapIcon,
  Play,
  Target,
  Trophy,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ModuleSearch } from "../components/layout/ModuleSearch";
import { LitePageFrame } from "../components/LiteSurface";
import { api } from "../lib/api";
import { handleLoginRequiredError } from "../lib/auth-required";
import {
  canExpandChapterQuestions,
  campaignChapterMatchesSearch,
  filterCampaignLevelsBySearch,
  getCampaignProgressSessionKey,
  getCampaignQuestionListPath,
  getCampaignLevelStatusLabel,
  getCampaignLevelStatsSummary,
  getChapterQuestionToggleLabel,
} from "../lib/practice-campaign-ui";
import { startCampaignLevel } from "../lib/practice-campaign";
import { practiceKeys } from "../lib/query-keys";
import { useSession } from "../lib/session";

type CampaignChapter = {
  id: number | string;
  name?: string | null;
  description?: string | null;
  completed?: boolean;
  unlocked?: boolean;
  progress?: number;
  totalLevels?: number;
  totalStars?: number;
};

type CampaignLevel = {
  id: number | string;
  title?: string | null;
  summary?: string | null;
  status?: string | null;
  questionId?: number | null;
  rewardExp?: number;
  rewardPoints?: number;
  participantCount?: number | string | null;
  passedCount?: number | string | null;
  passRate?: number | string | null;
};

type CampaignChaptersResponse = {
  chapters?: CampaignChapter[];
};

type CampaignChapterDetailResponse = {
  levels?: CampaignLevel[];
};

export function PracticeCampaignHub() {
  const navigate = useNavigate();
  const { user, token } = useSession();
  const [searchParams] = useSearchParams();
  const routeChapterId = searchParams.get("chapter") || null;
  const searchTerm = searchParams.get("search") || "";
  const [expandedChapterId, setExpandedChapterId] = useState<number | string | null>(routeChapterId);
  const [startingLevelId, setStartingLevelId] = useState<number | string | null>(null);
  const campaignSessionKey = getCampaignProgressSessionKey(user, token);
  const chaptersQuery = useQuery({
    queryKey: [...practiceKeys.campaignChapters(), campaignSessionKey],
    queryFn: () => api.get<CampaignChaptersResponse>("/api/practice/campaign/chapters", { silent: true }),
    refetchOnMount: "always",
  });

  const chapters = chaptersQuery.data?.chapters || [];
  const searchActive = Boolean(searchTerm.trim());
  const detailChapterIds = useMemo(() => {
    if (searchActive) return chapters.map((chapter) => chapter.id);
    return expandedChapterId ? [expandedChapterId] : [];
  }, [chapters, expandedChapterId, searchActive]);
  const chapterDetailQueries = useQueries({
    queries: detailChapterIds.map((chapterId) => ({
      queryKey: [...practiceKeys.campaignChapter(chapterId), campaignSessionKey],
      queryFn: () => api.get<CampaignChapterDetailResponse>(`/api/practice/campaign/chapters/${chapterId}`, { silent: true }),
      refetchOnMount: "always" as const,
      staleTime: 0,
    })),
  });
  const chapterDetailStateById = new globalThis.Map(
    detailChapterIds.map((chapterId, index) => [String(chapterId), chapterDetailQueries[index]])
  );
  const getChapterLevels = (chapterId: number | string) =>
    chapterDetailStateById.get(String(chapterId))?.data?.levels || [];
  const visibleChapters = searchActive
    ? chapters.filter((chapter) => {
        const levels = getChapterLevels(chapter.id);
        return campaignChapterMatchesSearch(chapter, searchTerm)
          || filterCampaignLevelsBySearch(levels, searchTerm).length > 0
          || chapterDetailStateById.get(String(chapter.id))?.isLoading;
      })
    : chapters;

  useEffect(() => {
    if (routeChapterId) {
      setExpandedChapterId(routeChapterId);
    }
  }, [routeChapterId]);

  const handleToggleQuestions = (chapter: CampaignChapter) => {
    if (!canExpandChapterQuestions(chapter)) {
      return;
    }
    setExpandedChapterId((current) => (String(current) === String(chapter.id) ? null : chapter.id));
  };

  const handleStartLevel = async (level: CampaignLevel, chapter: CampaignChapter) => {
    if (!level || level.status === "locked") {
      return;
    }
    setStartingLevelId(level.id);
    try {
      const result = await startCampaignLevel(level.id, level.questionId);
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
    } finally {
      setStartingLevelId(null);
    }
  };

  return (
    <LitePageFrame className="max-w-[1600px]">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[#00140d] text-white shadow-[0_28px_72px_rgba(0,20,13,0.22)]">
        <div className="border-b border-white/10 px-5 py-6 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-[#ccfff1] shadow-sm">
                <MapIcon size={20} />
              </div>
              <div>
                <h1 className="text-[30px] font-black tracking-tight text-white">章节地图</h1>
                <p className="mt-1 text-sm text-white/52">按章节顺序练习，完成后继续解锁后续内容。</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <PracticeActionButton onClick={() => navigate("/practice")}>
                查看所有章节列表
              </PracticeActionButton>
              <PracticeActionButton onClick={() => navigate("/practice/ranking")} icon={<Trophy size={15} />}>
                闯关排行
              </PracticeActionButton>
              <PracticeActionButton onClick={() => navigate("/practice/daily")} icon={<Target size={15} />}>
                每日挑战
              </PracticeActionButton>
              <PracticeActionButton onClick={() => navigate("/practice/wrongs")} icon={<ClipboardList size={15} />}>
                错题重练
              </PracticeActionButton>
              <PracticeActionButton onClick={() => navigate("/practice/history")} icon={<History size={15} />}>
                练习记录
              </PracticeActionButton>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-8 sm:py-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="flex justify-end border-b border-white/10 px-5 py-4">
              <ModuleSearch
                moduleKey="practice"
                search={searchParams.toString()}
                onNavigate={navigate}
                className="h-12 w-full lg:max-w-[560px]"
              />
            </div>
            {visibleChapters.length ? (
              <>
              <div className="grid grid-cols-[70px_minmax(170px,1fr)_96px_140px_74px_74px_190px] gap-3 border-b border-white/10 px-5 py-3 text-xs font-black text-white/42 max-lg:hidden">
                <span>序号</span>
                <span>章节</span>
                <span>状态</span>
                <span>进度</span>
                <span>题目</span>
                <span>星数</span>
                <span className="text-right">操作</span>
              </div>

              <div className="divide-y divide-white/10">
                {visibleChapters.map((chapter, index) => {
                  const isCompleted = Boolean(chapter.completed);
                  const isUnlocked = Boolean(chapter.unlocked);
                  const isExpanded = String(expandedChapterId) === String(chapter.id);
                  const detailState = chapterDetailStateById.get(String(chapter.id));
                  const chapterLevels = getChapterLevels(chapter.id);
                  const chapterMatchesSearch = campaignChapterMatchesSearch(chapter, searchTerm);
                  const visibleLevels = searchActive && !chapterMatchesSearch
                    ? filterCampaignLevelsBySearch(chapterLevels, searchTerm)
                    : chapterLevels;
                  const status = isCompleted ? "已通关" : isUnlocked ? "可进入" : "未解锁";
                  const progress = Math.max(0, Math.min(100, Number(chapter.progress || 0)));

                  return (
                    <div key={chapter.id} className={isExpanded ? "bg-white/[0.05]" : ""}>
                      <div className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-white/[0.04] max-lg:grid-cols-1 lg:grid-cols-[70px_minmax(170px,1fr)_96px_140px_74px_74px_190px] lg:items-center">
                        <div className="text-sm font-black text-white/46">
                          章节 {(index + 1).toString().padStart(2, "0")}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="truncate text-xl font-black text-white">{chapter.name}</h2>
                            {!isUnlocked ? <Lock size={14} className="shrink-0 text-white/32" /> : null}
                          </div>
                          {chapter.description ? (
                            <p className="mt-1 line-clamp-1 text-sm text-white/42">{chapter.description}</p>
                          ) : null}
                        </div>
                        <div>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                              isCompleted
                                ? "bg-emerald-400/14 text-emerald-200"
                                : isUnlocked
                                  ? "bg-sky-400/14 text-sky-200"
                                  : "bg-white/8 text-white/40"
                            }`}
                          >
                            {isCompleted ? <CheckCircle2 size={13} /> : isUnlocked ? <Target size={13} /> : <Lock size={13} />}
                            {status}
                          </span>
                        </div>
                        <div>
                          <div className="h-2 rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full ${
                                isCompleted ? "bg-[#00b050]" : isUnlocked ? "bg-[#7cffb2]" : "bg-white/18"
                              }`}
                              style={{ width: `${Math.max(4, progress)}%` }}
                            />
                          </div>
                          <div className="mt-2 text-xs font-bold text-white/46">{progress}%</div>
                        </div>
                        <MetricValue label="题目" value={chapter.totalLevels ?? 0} />
                        <div className="flex items-center gap-1.5 text-sm font-black text-white">
                          <Award size={15} className="text-amber-300" />
                          {chapter.totalStars ?? 0}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 max-lg:justify-start">
                          <button
                            type="button"
                            onClick={() => handleToggleQuestions(chapter)}
                            disabled={!isUnlocked}
                            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black transition ${
                              isUnlocked
                                ? "border border-white/12 bg-white/8 text-white/78 hover:bg-white/14 hover:text-white"
                                : "cursor-not-allowed bg-white/5 text-white/28"
                            }`}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {getChapterQuestionToggleLabel({ isExpanded, isUnlocked })}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(getCampaignQuestionListPath(chapter.id))}
                            disabled={!isUnlocked}
                            className={`inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-black transition ${
                              isUnlocked
                                ? "bg-[#9cffc3] text-[#002d1c] hover:bg-white"
                                : "cursor-not-allowed bg-white/5 text-white/28"
                            }`}
                          >
                            进入章节
                          </button>
                        </div>
                      </div>

                      {isExpanded || searchActive ? (
                        <ChapterQuestionList
                          chapter={chapter}
                          levels={visibleLevels}
                          isLoading={Boolean(detailState?.isLoading || detailState?.isFetching)}
                          isError={Boolean(detailState?.isError)}
                          emptyText={searchActive ? "当前章节没有匹配的题目。" : undefined}
                          startingLevelId={startingLevelId}
                          onStartLevel={handleStartLevel}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              </>
            ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center border-t border-dashed border-white/12 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00b050] text-white shadow-[0_18px_38px_rgba(0,176,80,0.3)]">
                <MapIcon size={24} />
              </div>
              <div className="mt-5 text-2xl font-black text-white">{searchActive ? "没有匹配的章节或题目" : "章节等待配置"}</div>
              <div className="mt-2 max-w-md text-sm leading-6 text-white/54">
                {searchActive ? "换个关键词或清空搜索后再试。" : "后台启用章节后，这里会自动展示章节列表、进度和星级。"}
              </div>
            </div>
            )}
          </div>
        </div>
      </section>
    </LitePageFrame>
  );
}

function ChapterQuestionList({
  chapter,
  levels,
  isLoading,
  isError,
  emptyText = "当前章节暂无题目。",
  startingLevelId,
  onStartLevel,
}: {
  chapter: CampaignChapter;
  levels: CampaignLevel[];
  isLoading: boolean;
  isError: boolean;
  emptyText?: string;
  startingLevelId: number | string | null;
  onStartLevel: (level: CampaignLevel, chapter: CampaignChapter) => Promise<void>;
}) {
  if (isLoading) {
    return (
      <div className="mx-5 mb-5 rounded-2xl border border-white/10 bg-[#001f15] px-5 py-5 text-sm font-bold text-white/58 sm:mx-8">
        <span className="inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          题目加载中...
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-5 mb-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-5 py-5 text-sm font-bold text-red-100 sm:mx-8">
        题目列表加载失败，请稍后重试。
      </div>
    );
  }

  if (!levels.length) {
    return (
      <div className="mx-5 mb-5 rounded-2xl border border-dashed border-white/12 bg-[#001f15] px-5 py-5 text-sm font-bold text-white/50 sm:mx-8">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="mx-5 mb-5 overflow-hidden rounded-2xl border border-[#00b050]/20 bg-[#001f15] sm:mx-8">
      <div className="grid grid-cols-[56px_minmax(160px,1fr)_90px_96px_160px_112px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-black text-white/38 max-md:hidden">
        <span>序号</span>
        <span>题目</span>
        <span>状态</span>
        <span>奖励</span>
        <span>统计</span>
        <span className="text-right">操作</span>
      </div>
      <div className="divide-y divide-white/10">
        {levels.map((level, index) => {
          const isLocked = level.status === "locked";
          const isPending = String(startingLevelId) === String(level.id);
          const statusLabel = getCampaignLevelStatusLabel(level.status);
          const stats = getCampaignLevelStatsSummary(level);
          return (
            <div
              key={level.id}
              className="grid gap-3 px-4 py-3 md:grid-cols-[56px_minmax(160px,1fr)_90px_96px_160px_112px] md:items-center"
            >
              <div className="text-xs font-black text-white/38">题目 {(index + 1).toString().padStart(2, "0")}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white">{level.title || `第 ${index + 1} 题`}</div>
                {level.summary ? <p className="mt-1 line-clamp-1 text-xs text-white/42">{level.summary}</p> : null}
              </div>
              <div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                    isLocked
                      ? "bg-white/7 text-white/34"
                      : level.status === "perfect"
                        ? "bg-amber-300/14 text-amber-100"
                        : level.status === "cleared"
                          ? "bg-emerald-300/14 text-emerald-100"
                          : "bg-[#00b050]/18 text-[#9cffc3]"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="text-xs font-black text-white/52">
                {Number(level.rewardExp || 0)} 经验 / {Number(level.rewardPoints || 0)} 积分
              </div>
              <QuestionStatsSummary stats={stats} />
              <div className="flex justify-end max-md:justify-start">
                <button
                  type="button"
                  onClick={() => void onStartLevel(level, chapter)}
                  disabled={isLocked || isPending}
                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black transition ${
                    isLocked
                      ? "cursor-not-allowed bg-white/5 text-white/26"
                      : "bg-[#00b050] text-white hover:bg-[#0ad56b] disabled:bg-white/12 disabled:text-white/40"
                  }`}
                >
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : isLocked ? <Lock size={14} /> : <Play size={14} />}
                  {isPending ? "进入中" : isLocked ? "未解锁" : "开始答题"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionStatsSummary({
  stats,
}: {
  stats: ReturnType<typeof getCampaignLevelStatsSummary>;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 text-[11px] font-black text-white/62 md:text-xs">
      <QuestionStatsItem label="参与" value={stats.participants} />
      <QuestionStatsItem label="通过" value={stats.passed} />
      <QuestionStatsItem label="通过率" value={stats.passRate} />
    </div>
  );
}

function QuestionStatsItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1">
      <span className="mr-1 text-white/34">{label}</span>
      <span className="text-white/82">{value}</span>
    </span>
  );
}

function PracticeActionButton({
  children,
  icon,
  onClick,
}: {
  children: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-sm font-black text-white/78 transition hover:bg-white/14 hover:text-white"
    >
      {icon}
      {children}
    </button>
  );
}

function MetricValue({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-sm">
      <span className="mr-2 text-white/34 lg:hidden">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}
