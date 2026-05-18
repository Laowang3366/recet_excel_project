import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, CheckCircle2, ChevronRight, Clock3, FileCode2, Lightbulb, RotateCcw, Sparkles, Target, XCircle } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../lib/api";
import { handleLoginRequiredError } from "../lib/auth-required";
import { getCampaignQuestionListPath } from "../lib/practice-campaign-ui";
import { formatDuration } from "../lib/format";
import { startCampaignLevel } from "../lib/practice-campaign";
import { getCampaignResultAnswerReviews } from "../lib/practice-campaign-result-ui";
import { practiceKeys } from "../lib/query-keys";

export function PracticeCampaignResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const campaignLevel = (location.state as any)?.campaignLevel;
  const campaignChapter = (location.state as any)?.campaignChapter;
  const nextLevelId = (location.state as any)?.nextLevelId;
  const passedFromState = Boolean((location.state as any)?.passed);
  const starsFromState = Number((location.state as any)?.stars || 0);
  const firstPassBonusAwarded = Number((location.state as any)?.firstPassBonusAwarded || 0);
  const totalRewardPoints = Number((location.state as any)?.totalRewardPoints || 0);
  const totalExpGained = Number((location.state as any)?.totalExpGained || 0);
  const dailyChallenge = (location.state as any)?.dailyChallenge || {};

  const recordQuery = useQuery({
    queryKey: practiceKeys.recordDetail(id || "unknown"),
    enabled: Boolean(id),
    queryFn: () => api.get<any>(`/api/practice/history/${id}`, { silent: true }),
  });

  const record = recordQuery.data;
  const passed = record ? (record.correctCount || 0) > 0 : passedFromState;
  const stars = record ? Math.max(((record.correctCount || 0) > 0 ? 1 : 0), starsFromState) : starsFromState;
  const answerReviews = getCampaignResultAnswerReviews(record);
  const questionListPath = getCampaignQuestionListPath(campaignChapter?.id);

  const handleStartLevel = async (levelId?: number | null) => {
    if (!levelId) {
      return;
    }
    try {
      const levelDetail = await api.get<any>(`/api/practice/campaign/levels/${levelId}`, { silent: true });
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
    } catch (error: any) {
      if (!handleLoginRequiredError(error, "请先登录后再开始答题")) {
        toast.error(error?.message || "开始答题失败");
      }
    }
  };

  return (
    <div className="mx-auto max-w-[960px] px-4 py-5 sm:px-6 sm:py-6">
      <button
        type="button"
        onClick={() => navigate(questionListPath)}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        返回题目列表
      </button>

      <div className={`overflow-hidden rounded-[36px] border shadow-sm ${passed ? "border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_28%)]" : "border-rose-200 bg-[linear-gradient(180deg,#fff1f2_0%,#ffffff_28%)]"}`}>
        <div className="px-6 py-8 text-center sm:px-10 sm:py-10">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${passed ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
            {passed ? <CheckCircle2 size={38} /> : <XCircle size={38} />}
          </div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-black tracking-[0.18em] text-slate-500 shadow-sm">
            <Sparkles size={14} />
            CAMPAIGN RESULT
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            {passed ? "通关成功" : "挑战失败"}
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-slate-500">
            {campaignLevel?.title || record?.questionTitle || "当前关卡"} 已完成结算。你可以继续前往下一关，或返回题目列表查看最新进度。
          </p>

          <div className="mt-7 flex items-center justify-center gap-2 text-amber-500">
            {[0, 1, 2].map((index) => (
              <Award key={index} size={24} className={index < stars ? "fill-current" : "text-slate-200"} />
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400"><Target size={14} /> 得分</div>
              <div className="mt-3 text-2xl font-black text-slate-900">{record?.score || 0}</div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400"><Clock3 size={14} /> 用时</div>
              <div className="mt-3 text-2xl font-black text-slate-900">{formatDuration(record?.durationSeconds || 0)}</div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400"><Award size={14} /> 奖励积分</div>
              <div className="mt-3 text-2xl font-black text-slate-900">{totalRewardPoints || record?.rewardPoints || 0}</div>
            </div>
          </div>

          {(firstPassBonusAwarded > 0 || Number(dailyChallenge?.rewardPoints || 0) > 0 || totalExpGained > 0) ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left">
                <div className="text-[11px] font-bold text-amber-700">首通额外奖励</div>
                <div className="mt-2 text-xl font-black text-slate-900">{firstPassBonusAwarded > 0 ? `+${firstPassBonusAwarded} 积分` : "无"}</div>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-left">
                <div className="text-[11px] font-bold text-sky-700">每日挑战奖励</div>
                <div className="mt-2 text-xl font-black text-slate-900">
                  {dailyChallenge?.rewardGranted ? `+${dailyChallenge.rewardPoints || 0} 积分 / +${dailyChallenge.rewardExp || 0} 经验` : "无"}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left">
                <div className="text-[11px] font-bold text-emerald-700">总经验</div>
                <div className="mt-2 text-xl font-black text-slate-900">{totalExpGained > 0 ? `+${totalExpGained}` : "0"}</div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-left shadow-sm">
            <div className="text-lg font-black text-slate-900">{campaignChapter?.name || record?.questionCategoryName || "当前章节"}</div>
            <div className="mt-2 text-sm leading-7 text-slate-500">
              {passed ? "本次挑战已完成结算，可以继续前往下一关或重新练习。" : "本次挑战未通过，可以返回章节后重新尝试。"}
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-left shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <Lightbulb size={17} />
              </div>
              <div>
                <div className="text-lg font-black text-slate-900">答案解析</div>
                <div className="text-xs font-bold text-slate-400">查看标准答案、判题明细和题目解析</div>
              </div>
            </div>

            {recordQuery.isLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                正在加载答案解析...
              </div>
            ) : answerReviews.length > 0 ? (
              <div className="space-y-4">
                {answerReviews.map((answer, index) => (
                  <div key={answer.id} className={`rounded-2xl border p-4 ${answer.isCorrect ? "border-emerald-100 bg-emerald-50/40" : "border-rose-100 bg-rose-50/40"}`}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-black ${answer.isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                            {index + 1}
                          </span>
                          <div className="text-sm font-black text-slate-900">{answer.title}</div>
                        </div>
                        <div className="mt-2 text-xs font-bold text-slate-400">{answer.questionType || "excel_template"}</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${answer.isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {answer.isCorrect ? "正确" : "错误"}
                      </span>
                    </div>

                    {answer.correctAnswer !== undefined && answer.correctAnswer !== null ? (
                      <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">
                          <CheckCircle2 size={13} />
                          正确答案
                        </div>
                        {renderCorrectAnswerSummary(answer.correctAnswer)}
                      </div>
                    ) : null}

                    {answer.hasGradingRules ? (
                      <div className="mt-3 rounded-xl border border-white/80 bg-white/80 p-3">
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                          <FileCode2 size={13} />
                          判题明细
                        </div>
                        <div className="space-y-2">
                          {answer.gradingDetail.ruleResults.map((rule: any, ruleIndex: number) => (
                            <div key={`${answer.id}-rule-${ruleIndex}`} className={`rounded-lg border px-3 py-2 text-sm ${rule.passed ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>
                              <div className="font-bold">{rule.label || rule.target || `规则 ${ruleIndex + 1}`}</div>
                              <div className="mt-1 text-xs opacity-80">{rule.message || (rule.passed ? "校验通过" : "未通过")}</div>
                              {(rule.expected !== undefined || rule.actual !== undefined) && (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-lg border border-white/60 bg-white/80 p-3">
                                    <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] opacity-70">预期</div>
                                    {renderRuleValue(rule.expected, rule.passed ? "emerald" : "rose")}
                                  </div>
                                  <div className="rounded-lg border border-white/60 bg-white/80 p-3">
                                    <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] opacity-70">实际</div>
                                    {renderRuleValue(rule.actual, rule.passed ? "emerald" : "rose")}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/70 p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-black text-teal-800">
                        <Lightbulb size={14} />
                        解析
                      </div>
                      <div className="text-sm leading-7 text-teal-900/80">{answer.explanation || "暂无解析"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                暂无答案解析，请稍后刷新结果页。
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {nextLevelId ? (
              <button
                type="button"
                onClick={() => void handleStartLevel(nextLevelId)}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-black text-white"
              >
                下一关答题
                <ChevronRight size={15} />
              </button>
            ) : null}
            {campaignLevel?.questionId ? (
              <button
                type="button"
                onClick={() => void handleStartLevel(campaignLevel?.id)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700"
              >
                <RotateCcw size={15} />
                再次答题
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate(questionListPath)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700"
            >
              返回题目列表
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatReviewValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function renderReviewMatrix(matrix: unknown[][] | undefined, tone: "emerald" | "slate" | "rose" = "slate") {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return <div className="text-xs text-slate-400">暂无数据</div>;
  }

  const toneClassName = {
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    rose: "border-rose-200 bg-rose-50/70 text-rose-900",
  }[tone];

  return (
    <div className="space-y-2">
      {matrix.map((row, rowIndex) => (
        <div key={`review-row-${rowIndex}`} className="flex flex-wrap gap-2">
          {row.map((cell, cellIndex) => (
            <div
              key={`review-cell-${rowIndex}-${cellIndex}`}
              className={`min-w-[72px] rounded-lg border px-2.5 py-2 text-xs font-mono shadow-sm ${toneClassName}`}
            >
              {formatReviewValue(cell) || <span className="text-slate-300">空</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function renderRuleValue(value: unknown, tone: "emerald" | "slate" | "rose" = "slate") {
  if (Array.isArray(value)) {
    return renderReviewMatrix(value as unknown[][], tone);
  }
  return <div className="break-all text-xs font-mono">{formatReviewValue(value) || "空"}</div>;
}

function hasAnyFormula(formulas: string[][] | undefined) {
  return Boolean(
    formulas?.some((row) => row.some((cell) => typeof cell === "string" && cell.trim().length > 0)),
  );
}

function renderCorrectAnswerSummary(correctAnswer: any) {
  const rangeValues = Object.entries(correctAnswer?.rangeValues || {});
  const rangeFormulas = correctAnswer?.rangeFormulas || {};

  if (!rangeValues.length) {
    return <div className="text-sm text-emerald-700">按后台答案区域规则校验</div>;
  }

  return (
    <div className="space-y-3">
      {rangeValues.map(([target, values]) => {
        const formulas = rangeFormulas[target] as string[][] | undefined;
        return (
          <div key={target} className="rounded-xl border border-emerald-100 bg-white/80 p-3">
            <div className="mb-3 w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
              {target}
            </div>
            <div className="space-y-3">
              {renderReviewMatrix(values as unknown[][], "emerald")}
              {hasAnyFormula(formulas) ? (
                <div>
                  <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    标准公式
                  </div>
                  {renderReviewMatrix((formulas || []).map((row) => row.map((cell) => cell ? `=${cell}` : "")), "slate")}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
