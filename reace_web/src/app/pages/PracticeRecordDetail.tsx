import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trophy,
  Clock,
  Play,
  Share2,
  Lightbulb,
  FileCode2,
  ChevronDown,
  ChevronUp,
  ListTodo,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { parseSheetAndRange } from "../lib/excel";
import { formatDateTime, formatDuration } from "../lib/format";
import { practiceKeys } from "../lib/query-keys";

type ExcelExpectedSnapshot = {
  rangeValues?: Record<string, unknown[][]>;
  rangeFormulas?: Record<string, string[][]>;
};

type PracticeGradingRuleResult = {
  passed?: boolean;
  label?: string | null;
  target?: string | null;
  expected?: unknown;
  actual?: unknown;
};

type PracticeRecordAnswer = {
  id?: number | string | null;
  questionId?: number | string | null;
  questionType?: string | null;
  questionTitle?: string | null;
  questionExplanation?: string | null;
  isCorrect?: boolean;
  options?: Array<string | number | boolean | null>;
  userAnswer?: unknown;
  correctAnswer?: ExcelExpectedSnapshot | unknown;
  gradingDetail?: {
    ruleResults?: PracticeGradingRuleResult[];
  } | null;
  rewardGranted?: boolean;
  rewardPoints?: number;
};

type PracticeRecordResponse = {
  score?: number;
  accuracy?: number;
  questionTitle?: string | null;
  questionCategoryName?: string | null;
  categoryName?: string | null;
  correctCount?: number;
  questionCount?: number;
  durationSeconds?: number;
  submitTime?: string | null;
  rewardPoints?: number;
  answers?: PracticeRecordAnswer[];
};

type PracticeSidebarQuestion = {
  id: number | string;
  title?: string | null;
  difficulty?: number | string | null;
  score?: number;
  completed?: boolean;
};

type PracticeQuestionListResponse = {
  questions?: PracticeSidebarQuestion[];
};

function formatAnswerValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hasAnyFormula(formulas: string[][] | undefined) {
  return Boolean(
    formulas?.some((row) => row.some((cell) => typeof cell === "string" && cell.trim().length > 0)),
  );
}

function renderMatrix(matrix: unknown[][] | undefined, tone: "emerald" | "slate" | "rose" = "slate") {
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
        <div key={`row-${rowIndex}`} className="flex flex-wrap gap-2">
          {row.map((cell, cellIndex) => (
            <div
              key={`cell-${rowIndex}-${cellIndex}`}
              className={`min-w-[72px] rounded-lg border px-2.5 py-2 text-xs font-mono shadow-sm ${toneClassName}`}
            >
              {formatAnswerValue(cell) || <span className="text-slate-300">空</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ExcelExpectedAnswerCard({ answer }: { answer: PracticeRecordAnswer }) {
  const correctAnswer = (answer?.correctAnswer || {}) as ExcelExpectedSnapshot;
  const rangeValues = Object.entries(correctAnswer.rangeValues || {});
  const rangeFormulas = correctAnswer.rangeFormulas || {};

  if (!rangeValues.length) {
    return <div className="text-sm text-emerald-700">按后台答案区域规则校验</div>;
  }

  return (
    <div className="space-y-4">
      {rangeValues.map(([target, values]) => {
        const { sheetName, rangeRef } = parseSheetAndRange(target);
        const formulas = rangeFormulas[target];
        return (
          <div key={target} className="rounded-xl border border-emerald-100 bg-white/80 p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                {sheetName || "工作表"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                {rangeRef || target}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">
                  标准答案
                </div>
                {renderMatrix(values, "emerald")}
              </div>

              {hasAnyFormula(formulas) && (
                <div>
                  <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    标准公式
                  </div>
                  {renderMatrix((formulas || []).map((row) => row.map((cell) => cell ? `=${cell}` : "")), "slate")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PracticeRecordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const recordQuery = useQuery({
    queryKey: practiceKeys.recordDetail(id || "unknown"),
    enabled: Boolean(id),
    queryFn: () => api.get<PracticeRecordResponse>(`/api/practice/history/${id}`, { silent: true }),
    retry: false,
  });
  const record = recordQuery.data;

  const sidebarQuery = useQuery({
    queryKey: practiceKeys.recordDetailSidebar(),
    enabled: Boolean(record),
    queryFn: () =>
      api.get<PracticeQuestionListResponse>(
        "/api/practice/question-list",
        { silent: true },
      ),
  });

  useEffect(() => {
    if (recordQuery.data) {
      const result = recordQuery.data;
      setExpandedId(result.answers?.[0]?.id ? String(result.answers[0].id) : null);
    }
  }, [recordQuery.data]);

  useEffect(() => {
    if (recordQuery.isError) {
      navigate("/practice");
    }
  }, [navigate, recordQuery.isError]);

  if (!record) {
    return <div className="p-10 text-center text-slate-400">加载中...</div>;
  }

  const passed = (record.accuracy || 0) >= 60;
  const sidebarQuestions = sidebarQuery.data?.questions || [];
  const currentQuestionIds = new Set((record.answers || []).map((item) => Number(item.questionId)).filter(Boolean));

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/practice")}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-all shadow-sm border border-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[20px] font-extrabold text-slate-800 tracking-tight">练习结果详情</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => toast.success("已复制分享链接！")}
            className="px-4 py-2 bg-white text-slate-600 hover:text-teal-600 border border-gray-200 hover:border-teal-200 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <Share2 size={16} /> 分享成绩
          </button>
          <button
            onClick={() => navigate("/practice")}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-500/30 transition-all flex items-center gap-2"
          >
            <Play size={16} /> 返回题库
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside>
          <div className="sticky top-24 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <ListTodo size={18} />
              </div>
              <div>
                <div className="text-base font-black text-slate-800">题目列表</div>
                <div className="text-xs text-slate-400">全部题目</div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-10rem)] space-y-3 overflow-y-auto pr-1">
              {sidebarQuestions.length > 0 ? (
                sidebarQuestions.map((question) => {
                  const isCurrent = currentQuestionIds.has(Number(question.id));
                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => navigate(`/practice/question/${question.id}`)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isCurrent ? "border-teal-200 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-800">{question.title}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                            <span>难度 {question.difficulty || 1}</span>
                            <span>{question.score || 0} 积分</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {isCurrent && (
                            <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-black text-white">
                              本次作答
                            </span>
                          )}
                          {question.completed && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                              已完成
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  当前分类暂无题目列表
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative">
            <div className={`h-32 w-full relative overflow-hidden ${passed ? "bg-gradient-to-r from-emerald-500 to-teal-600" : "bg-gradient-to-r from-rose-500 to-orange-500"}`}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}></div>
              <Trophy className="absolute -bottom-10 -right-4 w-56 h-56 text-white opacity-10 rotate-12" />
            </div>

            <div className="px-6 md:px-12 pb-8 relative text-center">
              <div className="w-28 h-28 mx-auto -mt-14 bg-white rounded-full p-2 shadow-xl border-4 border-white flex items-center justify-center relative z-10">
                <div className={`w-full h-full rounded-full flex flex-col items-center justify-center ${passed ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                  <span className="text-3xl font-black">{record.score || 0}</span>
                  <span className="text-[11px] font-bold opacity-80 -mt-1">得分</span>
                </div>
              </div>

              <h2 className="text-2xl font-extrabold text-slate-800 mt-4 mb-2">{record.questionTitle || record.questionCategoryName || record.categoryName || "练习结果"}</h2>

              <div className="flex flex-wrap items-center justify-center gap-4 text-[13px] font-bold text-slate-500">
                <span className="px-3 py-1 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className={passed ? "text-emerald-500" : "text-slate-400"} />
                  答对 {record.correctCount || 0} / {record.questionCount || 0} 题
                </span>
                <span className="px-3 py-1 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-500" />
                  用时 {formatDuration(record.durationSeconds)}
                </span>
                <span className="px-3 py-1 bg-gray-50 rounded-lg border border-gray-100">
                  提交时间：{formatDateTime(record.submitTime)}
                </span>
                {(record.rewardPoints || 0) > 0 && (
                  <span className="px-3 py-1 bg-amber-50 rounded-lg border border-amber-100 text-amber-700">
                    奖励 +{record.rewardPoints || 0} 积分
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2 pl-2">
              <FileCode2 className="text-teal-600" />
              答题明细
            </h3>

            {(record.answers || []).map((answer, idx) => {
              const questionId = String(answer.id || answer.questionId);
              return (
                <div key={questionId} className={`bg-white rounded-2xl border ${answer.isCorrect ? "border-emerald-100 shadow-sm shadow-emerald-50/50" : "border-rose-100 shadow-sm shadow-rose-50/50"} overflow-hidden transition-all`}>
                  <div className={`p-5 flex items-start gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors ${expandedId === questionId ? "bg-gray-50/50" : ""}`} onClick={() => setExpandedId((prev) => prev === questionId ? null : questionId)}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-sm mt-0.5 ${answer.isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        {answer.isCorrect ? (
                          <span className="flex items-center gap-1 text-[12px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50">
                            <CheckCircle2 size={12} /> 正确
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[12px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100/50">
                            <XCircle size={12} /> 错误
                          </span>
                        )}
                        <span className="text-[12px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md">{answer.questionType}</span>
                      </div>
                      <div className="text-[15px] font-bold text-slate-800 leading-relaxed line-clamp-2">{answer.questionTitle}</div>
                    </div>
                    <button className="text-slate-400 p-1 hover:text-slate-600 transition-colors mt-2">
                      {expandedId === questionId ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {expandedId === questionId && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-100">
                        <div className="p-6 pt-4 space-y-6">
                          <div className="text-[15px] text-slate-700 leading-relaxed font-medium bg-gray-50/50 p-4 rounded-xl">{answer.questionTitle}</div>
                          {answer.options?.length > 0 && (
                            <div className="space-y-3">
                              {answer.options.map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-white transition-colors">
                                  <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-[12px] font-bold text-slate-500 shadow-sm">{"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[optionIndex]}</span>
                                    <span className="text-[14px]">{option}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-gray-100">
                              <div className="text-[12px] font-black text-slate-500 mb-2 flex items-center gap-1.5"><FileCode2 size={14} /> 你的答案</div>
                              <div className={`font-mono text-sm p-2 rounded bg-white border ${answer.isCorrect ? "border-emerald-200 text-emerald-700" : "border-rose-200 text-rose-700"} overflow-x-auto`}>
                                {answer.questionType === "excel_template" ? "已提交 Excel 工作簿快照" : JSON.stringify(answer.userAnswer)}
                              </div>
                            </div>
                            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                              <div className="text-[12px] font-black text-emerald-600 mb-2 flex items-center gap-1.5"><CheckCircle2 size={14} /> 正确答案</div>
                              <div className="text-sm p-2 rounded bg-white border border-emerald-200 text-emerald-700 overflow-x-auto">
                                {answer.questionType === "excel_template" ? <ExcelExpectedAnswerCard answer={answer} /> : <div className="font-mono">{JSON.stringify(answer.correctAnswer)}</div>}
                              </div>
                            </div>
                          </div>
                          {answer.questionType === "excel_template" && Array.isArray(answer.gradingDetail?.ruleResults) && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-slate-500">判题结果</div>
                              <div className="space-y-2">
                                {answer.gradingDetail.ruleResults.map((rule, ruleIndex) => (
                                  <div key={`${questionId}-rule-${ruleIndex}`} className={`rounded-xl border px-3 py-2 text-sm ${rule.passed ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>
                                    <div className="font-bold">{rule.label || rule.target || `规则 ${ruleIndex + 1}`}</div>
                                    <div className="mt-1 text-xs opacity-80">{rule.passed ? "校验通过" : "未通过"}</div>
                                    {(rule.expected !== undefined || rule.actual !== undefined) && (
                                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-lg border border-white/60 bg-white/80 p-3">
                                          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] opacity-70">预期</div>
                                          {Array.isArray(rule.expected)
                                            ? renderMatrix(rule.expected, rule.passed ? "emerald" : "rose")
                                            : <div className="text-xs font-mono break-all">{formatAnswerValue(rule.expected) || "空"}</div>}
                                        </div>
                                        <div className="rounded-lg border border-white/60 bg-white/80 p-3">
                                          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] opacity-70">实际</div>
                                          {Array.isArray(rule.actual)
                                            ? renderMatrix(rule.actual, rule.passed ? "emerald" : "rose")
                                            : <div className="text-xs font-mono break-all">{formatAnswerValue(rule.actual) || "空"}</div>}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {(answer.rewardGranted || (answer.rewardPoints || 0) > 0) && (
                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                              {answer.rewardGranted ? `首次通过，奖励 +${answer.rewardPoints || 0} 积分` : `本题积分奖励 ${answer.rewardPoints || 0}`}
                            </div>
                          )}
                          <div className="bg-teal-50/50 rounded-xl p-5 border border-teal-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><Lightbulb size={48} className="text-teal-500" /></div>
                            <h4 className="text-[14px] font-black text-teal-800 mb-2 flex items-center gap-2 relative z-10"><Lightbulb size={16} /> 答案解析</h4>
                            <p className="text-[14px] text-teal-900/80 leading-relaxed font-medium relative z-10">{answer.questionExplanation || "暂无解析"}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
