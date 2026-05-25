import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";
import { LitePageFrame, LitePanel, LiteSectionTitle } from "../components/LiteSurface";
import { api, ApiError } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { toolsKeys } from "../lib/query-keys";
import { getVisibleFormulaModel } from "../lib/formula-explainer";

const PAGE_SIZE = 10;

type FormulaHistoryRecord = {
  id: number | string;
  formula?: string | null;
  summary?: string | null;
  model?: string | null;
  cacheHit?: boolean | null;
  pointsCost?: number | null;
  createTime?: string | null;
};

type FormulaHistoryPage = {
  records?: FormulaHistoryRecord[];
  total?: number;
  hasMore?: boolean;
};

export function FormulaHistory() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [displayedRecords, setDisplayedRecords] = useState<FormulaHistoryRecord[]>([]);

  const historyQuery = useQuery({
    queryKey: toolsKeys.formulaHistory({ page, size: PAGE_SIZE }),
    queryFn: () => api.get<FormulaHistoryPage>(`/api/tools/formula/history?page=${page}&size=${PAGE_SIZE}`, { silent: true }),
  });

  useEffect(() => {
    if (historyQuery.data?.records) {
      setDisplayedRecords((current) => page === 1 ? historyQuery.data.records || [] : [...current, ...(historyQuery.data.records || [])]);
    }
  }, [historyQuery.data, page]);

  useEffect(() => {
    if (historyQuery.error instanceof ApiError && historyQuery.error.status === 401) {
      navigate(buildCurrentAuthRedirectPath());
    }
  }, [historyQuery.error, navigate]);

  const latestRecords = historyQuery.data?.records || [];
  const records = displayedRecords;
  const hasMore = Boolean(historyQuery.data?.hasMore ?? (historyQuery.data?.total ? page * PAGE_SIZE < historyQuery.data.total : latestRecords.length >= PAGE_SIZE));

  const selectRecord = (id: number | string) => {
    navigate(`/tools/formula-history/${id}`);
  };

  const goBack = () => {
    const historyState = window.history.state as { idx?: number } | null;
    if (typeof historyState?.idx === "number" && historyState.idx > 0) {
      navigate(-1);
      return;
    }
    navigate("/tools");
  };

  return (
    <LitePageFrame>
      <LitePanel>
        <LiteSectionTitle
          eyebrow="FORMULA HISTORY"
          title="公式解释历史"
          description="查看最近的公式解释记录，点击记录可打开完整解释。"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
              >
                <ArrowLeft size={16} />
                返回
              </button>
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setDisplayedRecords([]);
                  void historyQuery.refetch();
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
              >
                <RefreshCw size={16} />
                刷新
              </button>
            </div>
          }
        />

        <div className="mt-6 space-y-3">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-sm text-slate-400">
              <LoaderCircle size={16} className="animate-spin" />
              正在加载历史记录
            </div>
          ) : null}

          {!historyQuery.isLoading && records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
              暂无公式解释记录。
            </div>
          ) : null}

          {records.map((item) => {
            const visibleModel = getVisibleFormulaModel(item.model);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectRecord(item.id)}
                className="w-full rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4 text-left transition hover:border-teal-300 hover:bg-teal-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm font-black text-slate-900">{item.formula || "-"}</div>
                    <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.summary || "点击查看详情"}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                      {visibleModel ? <span className="rounded-full bg-white px-2.5 py-1">{visibleModel}</span> : null}
                      {typeof item.pointsCost === "number" ? <span className="rounded-full bg-white px-2.5 py-1">消耗 {item.pointsCost}</span> : null}
                      {item.cacheHit ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">缓存命中</span> : null}
                      {item.createTime ? <span className="rounded-full bg-white px-2.5 py-1">{item.createTime.replace("T", " ")}</span> : null}
                    </div>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>

        {hasMore ? (
          <button
            type="button"
            onClick={() => setPage((value) => value + 1)}
            disabled={historyQuery.isFetching}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {historyQuery.isFetching ? <LoaderCircle size={16} className="animate-spin" /> : null}
            加载更多
          </button>
        ) : null}
      </LitePanel>
    </LitePageFrame>
  );
}
