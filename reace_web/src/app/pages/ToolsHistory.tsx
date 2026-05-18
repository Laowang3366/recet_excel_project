import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { LitePageFrame, LitePanel, LiteSectionTitle } from "../components/LiteSurface";
import { api } from "../lib/api";
import { normalizeResourceUrl } from "../lib/mappers";

function formatFileType(value: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "word") return "Word";
  if (normalized === "excel") return "Excel";
  if (normalized === "pdf") return "PDF";
  return value || "-";
}

type ToolHistoryRecord = {
  id: number | string;
  sourceFileName?: string | null;
  sourceType?: string;
  targetType?: string;
  createTime?: string | null;
  resultUrl?: string | null;
};

export function ToolsHistory() {
  const historyQuery = useQuery({
    queryKey: ["tools", "history"],
    queryFn: () => api.get<{ records?: ToolHistoryRecord[] }>("/api/tools/history", { silent: true }),
  });
  const historyRecords = historyQuery.data?.records || [];

  return (
    <LitePageFrame>
      <LitePanel>
        <LiteSectionTitle
          eyebrow="CONVERSION HISTORY"
          title="转换记录"
          description="查看最近转换结果并重复下载。"
        />
        <div className="mt-6 space-y-3">
          {historyRecords.length > 0 ? (
            historyRecords.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-900">{item.sourceFileName}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="rounded-full bg-white px-2.5 py-1">{formatFileType(item.sourceType)}</span>
                      <span>→</span>
                      <span className="rounded-full bg-white px-2.5 py-1">{formatFileType(item.targetType)}</span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">已完成</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-400">{String(item.createTime || "").replace("T", " ")}</div>
                    <a
                      href={normalizeResourceUrl(item.resultUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800"
                    >
                      <Download size={15} />
                      下载
                    </a>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
              暂无转换记录。
            </div>
          )}
        </div>
      </LitePanel>
    </LitePageFrame>
  );
}
