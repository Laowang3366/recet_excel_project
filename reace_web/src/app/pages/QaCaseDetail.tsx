import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileSpreadsheet, MessageSquareText, PencilLine } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { formatQaStatus, formatQaValue, type QaCaseHelp } from "../lib/qa";
import { qaKeys } from "../lib/query-keys";

export function QaCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const caseQuery = useQuery({
    queryKey: qaKeys.caseDetail(id || "unknown"),
    enabled: Boolean(id),
    queryFn: () => api.get<QaCaseHelp>(`/api/qa/cases/${id}`, { silent: true }),
  });
  const item = caseQuery.data;

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

  if (!item) {
    return <div className="p-10 text-center text-slate-400">正在加载求助详情...</div>;
  }

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
            <Link
              to={`/qa/cases/${item.id}/answer`}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
            >
              <PencilLine size={16} />
              我要答疑
            </Link>
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
          </section>

          <section id="answers" className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
              <MessageSquareText size={18} className="text-sky-600" />
              答疑记录
            </h2>
            <div className="mt-4 space-y-3">
              {(item.answers || []).map((answer) => (
                <div key={answer.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-900">{answer.author?.username || "答疑者"}</div>
                      <div className="mt-1 text-xs font-bold text-slate-400">{formatDateTime(answer.createTime)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDownloadAnswer(answer.answerFileUrl)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                    >
                      <Download size={14} />
                      下载答疑模板
                    </button>
                  </div>
                </div>
              ))}
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
