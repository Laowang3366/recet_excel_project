import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { FormulaExplainResult } from "../components/tools/FormulaExplainResult";
import { LitePageFrame, LitePanel, LiteSectionTitle } from "../components/LiteSurface";
import { api, ApiError } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import type { FormulaExplainResponse } from "../lib/formula-explainer";
import { toolsKeys } from "../lib/query-keys";

export function FormulaHistoryDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const detailQuery = useQuery({
    queryKey: toolsKeys.formulaDetail(id || "none"),
    queryFn: () => api.get<FormulaExplainResponse>(`/api/tools/formula/history/${id}`, { silent: true }),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (detailQuery.error instanceof ApiError && detailQuery.error.status === 401) {
      navigate(buildCurrentAuthRedirectPath());
    }
  }, [detailQuery.error, navigate]);

  const goBack = () => {
    const historyState = window.history.state as { idx?: number } | null;
    if (typeof historyState?.idx === "number" && historyState.idx > 0) {
      navigate(-1);
      return;
    }
    navigate("/tools/formula-history");
  };

  return (
    <LitePageFrame>
      <LitePanel>
        <LiteSectionTitle
          eyebrow="FORMULA DETAIL"
          title="公式解释详情"
          description="查看本次公式解释的完整分析、结构拆解、注意事项和优化建议。"
          action={
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
            >
              <ArrowLeft size={16} />
              返回
            </button>
          }
        />
      </LitePanel>

      {detailQuery.isFetching ? (
        <LitePanel>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
            <LoaderCircle size={16} className="animate-spin" />
            正在加载解释详情
          </div>
        </LitePanel>
      ) : null}

      {detailQuery.error && !(detailQuery.error instanceof ApiError && detailQuery.error.status === 401) ? (
        <LitePanel>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            详情加载失败，请稍后重试。
          </div>
        </LitePanel>
      ) : null}

      {detailQuery.data ? <FormulaExplainResult result={detailQuery.data} /> : null}
    </LitePageFrame>
  );
}
