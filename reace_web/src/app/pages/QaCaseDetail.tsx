import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, MessageSquareText, PencilLine, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { openGlobalConfirm, openGlobalPrompt } from "../components/GlobalConfirmPromptDialog";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { formatQaAnswerStatus, formatQaFeedbackReason, formatQaStatus, formatQaValue, type QaCaseAnswer, type QaCaseHelp } from "../lib/qa";
import { qaKeys } from "../lib/query-keys";
import { useSession } from "../lib/session";

const FEEDBACK_OPTIONS = [
  { value: "unclear_requirement", label: "需求描述不清" },
  { value: "missing_expected_answer", label: "模板没有预设答案" },
  { value: "bad_source_data", label: "源数据有问题" },
  { value: "too_hard", label: "太难了，无法解答" },
  { value: "other", label: "其它" },
];

export function QaCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [feedbackReason, setFeedbackReason] = useState("unclear_requirement");
  const [feedbackDetail, setFeedbackDetail] = useState("");

  const caseQuery = useQuery({
    queryKey: qaKeys.caseDetail(id || "unknown"),
    enabled: Boolean(id),
    queryFn: () => api.get<QaCaseHelp>(`/api/qa/cases/${id}`, { silent: true }),
  });
  const item = caseQuery.data;

  const refreshCase = async () => {
    if (id) {
      await queryClient.invalidateQueries({ queryKey: qaKeys.caseDetail(id) });
    }
    await queryClient.invalidateQueries({ queryKey: qaKeys.all });
  };

  const acceptMutation = useMutation({
    mutationFn: ({ answer, rewardPoints }: { answer: QaCaseAnswer; rewardPoints: number }) =>
      api.post(`/api/qa/cases/${id}/answers/${answer.id}/accept`, { rewardPoints }, { silent: true }),
    onSuccess: async () => {
      await refreshCase();
      toast.success("答疑已采纳");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "采纳失败"),
  });

  const voteMutation = useMutation({
    mutationFn: ({ answer, voteType }: { answer: QaCaseAnswer; voteType: "up" | "down" }) =>
      api.post(`/api/qa/cases/${id}/answers/${answer.id}/vote`, { voteType }, { silent: true }),
    onSuccess: async () => {
      await refreshCase();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "评价失败"),
  });

  const updateAnswerMutation = useMutation({
    mutationFn: async ({ answer, file }: { answer: QaCaseAnswer; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scene", "reply_attachment");
      const upload = await api.post<{ url: string }>("/api/upload", formData, { silent: true });
      return api.put(`/api/qa/cases/${id}/answers/${answer.id}`, { answerFileUrl: upload.url }, { silent: true });
    },
    onSuccess: async () => {
      await refreshCase();
      toast.success("答疑模板已更新");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "更新答疑失败"),
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: (answer: QaCaseAnswer) => api.delete(`/api/qa/cases/${id}/answers/${answer.id}`, undefined, { silent: true }),
    onSuccess: async () => {
      await refreshCase();
      toast.success("答疑已删除");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "删除答疑失败"),
  });

  const feedbackMutation = useMutation({
    mutationFn: () => api.post(`/api/qa/cases/${id}/feedback`, {
      reason: feedbackReason,
      detail: feedbackReason === "other" ? feedbackDetail.trim() : "",
    }, { silent: true }),
    onSuccess: () => {
      setFeedbackReason("unclear_requirement");
      setFeedbackDetail("");
      toast.success("反馈已提交");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "反馈失败"),
  });

  const handleDownloadTemplate = async () => {
    if (!id) return;
    try {
      await api.download(`/api/qa/cases/${id}/file`, `case-${id}.xlsx`, { silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载失败");
    }
  };

  const handleDownloadAnswer = async (answerFileUrl?: string | null) => {
    if (!answerFileUrl) {
      toast.error("答疑文件不存在");
      return;
    }
    try {
      await api.download(answerFileUrl, "答疑模板.xlsx", { auth: false, silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载失败");
    }
  };

  const confirmAcceptAnswer = async (answer: QaCaseAnswer) => {
    const input = await openGlobalPrompt({
      title: "采纳答疑",
      message: "确认采纳这个答疑结果。可输入悬赏积分，留空或 0 表示不悬赏。",
      label: "悬赏积分",
      defaultValue: "0",
      confirmLabel: "采纳",
    });
    if (input === null) return;
    const rewardPoints = Number(input.trim() || "0");
    if (!Number.isInteger(rewardPoints) || rewardPoints < 0) {
      toast.error("悬赏积分必须是非负整数");
      return;
    }
    acceptMutation.mutate({ answer, rewardPoints });
  };

  const confirmDeleteAnswer = async (answer: QaCaseAnswer) => {
    const confirmed = await openGlobalConfirm({
      title: "删除答疑",
      message: "删除后将从答疑记录中移除。",
      confirmLabel: "删除",
      destructive: true,
    });
    if (confirmed) deleteAnswerMutation.mutate(answer);
  };

  if (!item) {
    return <div className="p-10 text-center text-slate-400">正在加载求助详情...</div>;
  }

  const isCaseOwner = user?.id !== undefined && Number(user.id) === Number(item.userId);
  const canSubmitAnswer = item.status !== "accepted" && item.status !== "closed" && item.status !== "deleted";
  const hasAcceptedAnswer = item.status === "accepted" || Boolean(item.acceptedAnswerId);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/qa")}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        返回求助答疑
      </button>

      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              <FileSpreadsheet size={14} />
              {formatQaStatus(item.status)}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">{item.title}</h1>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{item.description}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
              <span>{item.author?.username || "用户"}</span>
              <span>浏览 {item.viewCount || 0}</span>
              <span>答疑 {item.answerCount || 0}</span>
              <span>{formatDateTime(item.createTime)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadTemplate()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <Download size={16} />
              下载模板
            </button>
            {canSubmitAnswer ? (
              <Link
                to={`/qa/cases/${item.id}/answer`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
              >
                <PencilLine size={16} />
                我要答疑
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-[24px] border border-emerald-100 bg-emerald-50/50 p-5">
            <h2 className="text-base font-black text-emerald-900">理想答案</h2>
            <div className="mt-3 rounded-2xl border border-emerald-100 bg-white p-4">
              <div className="mb-2 text-xs font-black text-emerald-700">
                {item.answerSheet || "工作表"} / {item.answerRange || "未选择区域"}
              </div>
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
                {formatQaValue(item.idealAnswerSnapshot)}
              </pre>
            </div>
            {!isCaseOwner && canSubmitAnswer ? (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <div className="text-sm font-black text-amber-900">答疑者反馈</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <select
                    value={feedbackReason}
                    onChange={(event) => setFeedbackReason(event.target.value)}
                    className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
                  >
                    {FEEDBACK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => feedbackMutation.mutate()}
                    disabled={feedbackMutation.isPending}
                    className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                  >
                    提交反馈
                  </button>
                </div>
                {feedbackReason === "other" ? (
                  <input
                    value={feedbackDetail}
                    onChange={(event) => setFeedbackDetail(event.target.value.slice(0, 30))}
                    placeholder="补充说明，30字以内"
                    className="mt-2 h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none"
                  />
                ) : (
                  <div className="mt-2 text-xs font-bold text-amber-700">{formatQaFeedbackReason(feedbackReason)}</div>
                )}
              </div>
            ) : null}
          </section>

          <section id="answers" className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
              <MessageSquareText size={18} className="text-sky-600" />
              答疑记录
            </h2>
            <div className="mt-4 space-y-3">
              {(item.answers || []).map((answer) => {
                const isOwnAnswer = user?.id !== undefined && Number(user.id) === Number(answer.userId);
                const isAccepted = answer.status === "accepted" || Number(item.acceptedAnswerId) === Number(answer.id);
                return (
                  <div key={answer.id} className={`rounded-2xl border bg-white px-4 py-3 ${isAccepted ? "border-emerald-200 ring-2 ring-emerald-100" : "border-slate-200"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-black text-slate-900">
                          <span>{answer.author?.username || "答疑者"}</span>
                          {isAccepted ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-700">
                              <CheckCircle2 size={12} />
                              已采纳
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-500">
                              {formatQaAnswerStatus(answer.status)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-400">
                          <span>{formatDateTime(answer.createTime)}</span>
                          {answer.rewardPoints ? <span>悬赏 {answer.rewardPoints} 积分</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDownloadAnswer(answer.answerFileUrl)}
                          className={answerButtonClassName()}
                        >
                          <Download size={14} />
                          下载答疑模板
                        </button>
                        {!hasAcceptedAnswer && isCaseOwner && !isOwnAnswer ? (
                          <button
                            type="button"
                            onClick={() => void confirmAcceptAnswer(answer)}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700"
                          >
                            <CheckCircle2 size={14} />
                            采纳
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => voteMutation.mutate({ answer, voteType: "up" })}
                        className={answerButtonClassName()}
                      >
                        <ThumbsUp size={14} />
                        {answer.upVoteCount || 0}
                      </button>
                      <button
                        type="button"
                        onClick={() => voteMutation.mutate({ answer, voteType: "down" })}
                        className={answerButtonClassName()}
                      >
                        <ThumbsDown size={14} />
                        {answer.downVoteCount || 0}
                      </button>
                      {isOwnAnswer && !isAccepted ? (
                        <>
                          <label className={answerButtonClassName("cursor-pointer")}>
                            <PencilLine size={14} />
                            重新上传
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.currentTarget.value = "";
                                if (file) updateAnswerMutation.mutate({ answer, file });
                              }}
                            />
                          </label>
                          <button type="button" onClick={() => void confirmDeleteAnswer(answer)} className={answerDangerButtonClassName()}>
                            <Trash2 size={14} />
                            删除
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!item.answers?.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                  暂无答疑模板
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function answerButtonClassName(extra = "") {
  return `inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${extra}`;
}

function answerDangerButtonClassName() {
  return "inline-flex items-center gap-2 rounded-xl border border-rose-100 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50";
}
