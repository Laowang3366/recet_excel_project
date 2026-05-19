import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileCode2, Lightbulb } from "lucide-react";
import { useNavigate, useParams } from "react-router";

import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { formatQaValue, type QaSolutionShare } from "../lib/qa";
import { qaKeys } from "../lib/query-keys";

export function QaSolutionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const shareQuery = useQuery({
    queryKey: qaKeys.solutionShareDetail(id || "unknown"),
    enabled: Boolean(id),
    queryFn: () => api.get<QaSolutionShare>(`/api/qa/solution-shares/${id}`, { silent: true }),
  });
  const share = shareQuery.data;
  const answer = share?.answer;

  if (!share) {
    return <div className="p-10 text-center text-slate-400">正在加载解题分享...</div>;
  }

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/qa")}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        返回求助答疑
      </button>

      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
          <Lightbulb size={14} />
          解题分享
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">{share.title}</h1>
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
          <span>{share.author?.username || "用户"}</span>
          <span>浏览 {share.viewCount || 0}</span>
          <span>{formatDateTime(share.createTime)}</span>
        </div>

        <section className="mt-6 rounded-[24px] border border-amber-100 bg-amber-50/70 p-5">
          <h2 className="flex items-center gap-2 text-base font-black text-amber-900">
            <Lightbulb size={18} />
            解题思路
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-amber-950/80">
            {share.thoughtText || "分享者暂未填写解题思路。"}
          </p>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <AnswerBlock
            title="用户答案"
            value={answer?.userAnswer}
            tone="slate"
          />
          <AnswerBlock
            title="标准答案"
            value={answer?.correctAnswer}
            tone="emerald"
          />
        </section>

        <section className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <FileCode2 size={18} className="text-slate-500" />
            判题明细
          </h2>
          <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-white p-4 text-xs leading-6 text-slate-700">
            {formatQaValue(answer?.gradingDetail)}
          </pre>
        </section>

        <section className="mt-5 rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-5">
          <h2 className="flex items-center gap-2 text-base font-black text-emerald-900">
            <CheckCircle2 size={18} />
            答案解析
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-950/80">
            {answer?.questionExplanation || "暂无解析"}
          </p>
        </section>
      </article>
    </div>
  );
}

function AnswerBlock({ title, value, tone }: { title: string; value: unknown; tone: "slate" | "emerald" }) {
  const toneClassName = tone === "emerald"
    ? "border-emerald-100 bg-emerald-50/70 text-emerald-950"
    : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-[24px] border p-5 ${toneClassName}`}>
      <h2 className="text-base font-black">{title}</h2>
      <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-white/80 p-4 text-xs leading-6">
        {formatQaValue(value)}
      </pre>
    </div>
  );
}
