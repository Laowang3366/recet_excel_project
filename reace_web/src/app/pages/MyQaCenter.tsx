import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileSpreadsheet, Lightbulb, MessageSquareText } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { formatQaStatus, type QaMyResponse } from "../lib/qa";
import { qaKeys } from "../lib/query-keys";

export function MyQaCenter() {
  const navigate = useNavigate();
  const myQaQuery = useQuery({
    queryKey: qaKeys.my(),
    queryFn: () => api.get<QaMyResponse>("/api/qa/my?page=1&size=20", { silent: true }),
  });
  const data = myQaQuery.data;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/qa")}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        返回求助答疑
      </button>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <MessageSquareText size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">查看答疑</h1>
            <p className="mt-1 text-sm text-slate-500">我的求助、我的答疑和我的解题分享。</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            我发起的求助
          </h2>
          <div className="mt-4 space-y-3">
            {(data?.cases.records || []).map((item) => (
              <Link key={item.id} to={`/qa/cases/${item.id}`} className="block rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:bg-emerald-50">
                <div className="font-bold text-slate-900">{item.title}</div>
                <div className="mt-2 flex gap-2 text-xs font-bold text-slate-400">
                  <span>{formatQaStatus(item.status)}</span>
                  <span>答疑 {item.answerCount || 0}</span>
                </div>
              </Link>
            ))}
            {!data?.cases.records?.length ? <EmptyState /> : null}
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <MessageSquareText size={18} className="text-sky-600" />
            我提交的答疑
          </h2>
          <div className="mt-4 space-y-3">
            {(data?.answers.records || []).map((item) => (
              <Link key={item.id} to={`/qa/cases/${item.caseId}#answers`} className="block rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:bg-sky-50">
                <div className="font-bold text-slate-900">答疑模板 #{item.id}</div>
                <div className="mt-2 text-xs font-bold text-slate-400">{formatDateTime(item.createTime)}</div>
              </Link>
            ))}
            {!data?.answers.records?.length ? <EmptyState /> : null}
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <Lightbulb size={18} className="text-amber-600" />
            我的解题分享
          </h2>
          <div className="mt-4 space-y-3">
            {(data?.shares.records || []).map((item) => (
              <Link key={item.id} to={`/qa/solutions/${item.id}`} className="block rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:bg-amber-50">
                <div className="font-bold text-slate-900">{item.title}</div>
                <div className="mt-2 text-xs font-bold text-slate-400">浏览 {item.viewCount || 0}</div>
              </Link>
            ))}
            {!data?.shares.records?.length ? <EmptyState /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
      暂无记录
    </div>
  );
}
