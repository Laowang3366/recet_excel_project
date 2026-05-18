import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FolderClock, ReceiptText, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LiteHero, LitePageFrame, LitePanel } from "../components/LiteSurface";
import { api, downloadFile } from "../lib/api";
import { normalizeResourceUrl } from "../lib/mappers";
import { templateKeys } from "../lib/query-keys";
import { formatTemplateCost, formatTemplateDifficulty } from "../lib/template-center";

function formatRecordTime(value?: string | null) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type TemplatePurchaseRecord = {
  id: number;
  title?: string | null;
  downloadUrl?: string | null;
  templateFileUrl?: string | null;
  previewImageUrl?: string | null;
  industryCategory?: string | null;
  difficultyLevel?: string | null;
  createTime?: string | null;
  pointsCost?: number;
  useScenario?: string | null;
  templateDescription?: string | null;
  functionsUsed?: string[];
  hasTemplateFile?: boolean;
};

type TemplatePurchaseRecordsResponse = {
  records?: TemplatePurchaseRecord[];
  totalDownloads?: number;
  totalSpentPoints?: number;
};

export function TemplatePurchaseRecords() {
  const navigate = useNavigate();
  const recordsQuery = useQuery({
    queryKey: templateKeys.records(),
    queryFn: () => api.get<TemplatePurchaseRecordsResponse>("/api/templates/records", { silent: true }),
  });
  const downloadMutation = useMutation({
    mutationFn: ({ url, fileName }: { id: number; url: string; fileName: string }) => downloadFile(url, fileName),
  });

  const records = recordsQuery.data?.records || [];
  const totalDownloads = Number(recordsQuery.data?.totalDownloads || 0);
  const totalSpentPoints = Number(recordsQuery.data?.totalSpentPoints || 0);

  const handleDownload = (item: TemplatePurchaseRecord) => {
    const url = item.downloadUrl || item.templateFileUrl;
    if (!url) {
      toast.info("当前模板文件不可用");
      return;
    }
    void downloadMutation.mutateAsync({
      id: item.id,
      url,
      fileName: `${item.title || "excelcc-template"}.xlsx`,
    });
  };

  return (
    <LitePageFrame className="max-w-[1420px]">
      <LiteHero
        eyebrow="购买记录"
        title="模板购买记录"
        description="这里统一查看你已经购买过的模板、扣减积分和重新下载入口。"
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/templates")}
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/18 bg-white/10 px-5 text-sm font-black text-white transition hover:bg-white/16"
            >
              返回模板中心
            </button>
          </div>
        }
        aside={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] border border-white/12 bg-white/10 p-5 backdrop-blur-md">
              <div className="text-[12px] font-black tracking-[0.18em] text-white/68">购买总数</div>
              <div className="mt-3 text-4xl font-black text-white">{totalDownloads}</div>
            </div>
            <div className="rounded-[28px] border border-white/12 bg-white/10 p-5 backdrop-blur-md">
              <div className="text-[12px] font-black tracking-[0.18em] text-white/68">累计消耗积分</div>
              <div className="mt-3 text-4xl font-black text-white">{totalSpentPoints}</div>
            </div>
          </div>
        }
      />

      {records.length === 0 ? (
        <LitePanel className="py-16 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[30px] bg-teal-50 text-teal-600">
            <FolderClock size={34} />
          </div>
          <div className="mt-6 text-2xl font-black text-slate-900">还没有模板购买记录</div>
          <div className="mt-2 text-sm text-slate-500">去模板中心挑选后，这里会自动沉淀你的购买记录。</div>
        </LitePanel>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {records.map((item) => {
            const previewUrl = normalizeResourceUrl(item.previewImageUrl);
            const pending = downloadMutation.isPending && downloadMutation.variables?.id === item.id;
            return (
              <LitePanel key={item.id} className="overflow-hidden p-0">
                <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="relative min-h-[200px] border-b border-slate-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_55%,#ecfeff_100%)] md:border-b-0 md:border-r">
                    {previewUrl ? (
                      <img src={previewUrl} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full min-h-[200px] items-center justify-center text-slate-400">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-18 w-18 items-center justify-center rounded-[26px] border border-white/70 bg-white shadow-sm">
                            <ReceiptText size={30} />
                          </div>
                          <div className="text-sm font-bold">无预览图</div>
                        </div>
                      </div>
                    )}
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-950/78 px-3 py-1 text-xs font-black text-white backdrop-blur-sm">
                        {item.industryCategory || "未分类"}
                      </span>
                      <span className="rounded-full bg-white/84 px-3 py-1 text-xs font-black text-slate-700 backdrop-blur-sm">
                        {formatTemplateDifficulty(item.difficultyLevel)}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                          <Sparkles size={12} />
                          已购模板
                        </div>
                        <h2 className="mt-3 text-[28px] font-black tracking-tight text-slate-900">{item.title}</h2>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        已购买
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                        <div className="text-xs font-black text-slate-400">下载时间</div>
                        <div className="mt-2 text-sm font-bold leading-6 text-slate-700">{formatRecordTime(item.createTime)}</div>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                        <div className="text-xs font-black text-slate-400">消耗积分</div>
                        <div className="mt-2 text-sm font-bold leading-6 text-amber-600">{formatTemplateCost(item.pointsCost)}</div>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                        <div className="text-xs font-black text-slate-400">使用场景</div>
                        <div className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-slate-700">{item.useScenario || "未填写"}</div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">模板说明</div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {item.templateDescription || "暂无模板说明"}
                      </p>
                    </div>

                    <div className="mt-5">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">使用到的函数</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(item.functionsUsed || []).length ? (
                          item.functionsUsed.map((func: string) => (
                            <span
                              key={`${item.id}-${func}`}
                              className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700"
                            >
                              {func}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-400">
                            暂未配置函数
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                      <div className="text-xs text-slate-400">
                        {item.hasTemplateFile ? "模板文件仍可直接重复下载" : "模板文件当前不可用"}
                      </div>
                      {item.hasTemplateFile ? (
                        <button
                          type="button"
                          onClick={() => handleDownload(item)}
                          disabled={pending}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:bg-slate-300"
                        >
                          <Download size={16} />
                          {pending ? "下载中..." : "重新下载"}
                        </button>
                      ) : (
                        <span className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-100 px-5 text-sm font-black text-slate-400">
                          文件不可用
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </LitePanel>
            );
          })}
        </section>
      )}
    </LitePageFrame>
  );
}
