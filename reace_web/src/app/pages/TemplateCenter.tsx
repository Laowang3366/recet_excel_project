import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Download, FileImage, FolderKanban, Layers3, Sparkles, Tag } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ModuleSearch } from "../components/layout/ModuleSearch";
import { LitePageFrame, LitePanel } from "../components/LiteSurface";
import { api, downloadFile } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { normalizeResourceUrl } from "../lib/mappers";
import { pointsKeys, templateKeys } from "../lib/query-keys";
import { filterTemplatesBySearch, formatTemplateCost, formatTemplateDifficulty } from "../lib/template-center";
import { useSession } from "../lib/session";

function formatTemplateTime(value?: string | null) {
  if (!value) return "暂无更新记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

type TemplateCategory = {
  key: string;
  label: string;
  count?: number;
};

type TemplateRecord = {
  id: number;
  title?: string | null;
  industryCategory?: string | null;
  useScenario?: string | null;
  previewImageUrl?: string | null;
  templateDescription?: string | null;
  functionsUsed?: string[];
  difficultyLevel?: string | null;
  downloadCostPoints?: number;
  hasTemplateFile?: boolean;
  downloaded?: boolean;
  updateTime?: string | null;
};

type TemplatesResponse = {
  categories?: TemplateCategory[];
  records?: TemplateRecord[];
};

type PointsOverviewResponse = {
  user?: {
    points?: number;
  };
};

export function TemplateCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") || "";
  const searchTerm = searchParams.get("search") || "";

  const templatesQuery = useQuery({
    queryKey: templateKeys.list(selectedCategory),
    queryFn: () =>
      api.get<TemplatesResponse>(`/api/templates${selectedCategory ? `?industryCategory=${encodeURIComponent(selectedCategory)}` : ""}`, {
        silent: true,
      }),
  });

  const pointsOverviewQuery = useQuery({
    queryKey: pointsKeys.overview(),
    enabled: isAuthenticated,
    queryFn: () => api.get<PointsOverviewResponse>("/api/points/overview", { silent: true }),
  });

  const currentPoints = Number(pointsOverviewQuery.data?.user?.points || 0);
  const categories = templatesQuery.data?.categories || [];
  const rawRecords = templatesQuery.data?.records || [];
  const records = useMemo(() => filterTemplatesBySearch(rawRecords, searchTerm), [rawRecords, searchTerm]);
  const selectedCategoryLabel = selectedCategory || "全部行业";
  const downloadedCount = records.filter((item) => item.downloaded).length;

  const downloadMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const result = await api.post<{ url: string; deductedPoints: number }>(`/api/templates/${templateId}/download`, {});
      if (result?.url) {
        await downloadFile(result.url, `excelcc-template-${templateId}.xlsx`);
      }
      return result;
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: templateKeys.all }),
        queryClient.invalidateQueries({ queryKey: pointsKeys.overview() }),
      ]);
      toast.success(result?.deductedPoints ? `模板下载成功，已扣除 ${result.deductedPoints} 积分` : "模板下载成功");
    },
  });

  const summary = useMemo(() => {
    const total = records.length;
    const free = records.filter((item) => Number(item.downloadCostPoints || 0) <= 0).length;
    const withFile = records.filter((item) => item.hasTemplateFile).length;
    return { total, free, withFile };
  }, [records]);

  const handleCategoryChange = (category: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!category) {
      nextParams.delete("category");
      setSearchParams(nextParams);
      return;
    }
    nextParams.set("category", category);
    setSearchParams(nextParams);
  };

  const handleDownload = (item: TemplateRecord) => {
    if (!item?.hasTemplateFile) {
      toast.info("当前模板还未上传下载文件");
      return;
    }
    if (!isAuthenticated) {
      navigate(buildCurrentAuthRedirectPath());
      return;
    }
    void downloadMutation.mutateAsync(item.id);
  };

  return (
    <LitePageFrame className="max-w-[1480px]">
      <div className="flex flex-col gap-5 border-b border-white/10 pb-2 text-white lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-black text-[#9cffc3]">模板中心</div>
          <h1 className="mt-2 text-[34px] font-black tracking-tight text-white sm:text-[46px]">Excel 模板中心</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
            按行业筛选可复用模板，支持预览、积分下载和购买记录。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <TemplateMetric label="当前行业" value={selectedCategoryLabel} />
          <TemplateMetric label={searchTerm ? "匹配" : "模板"} value={summary.total} />
          <TemplateMetric label="免费" value={summary.free} />
          <TemplateMetric label="积分" value={isAuthenticated ? currentPoints : "-"} />
          <TemplateMetric label="已下载" value={downloadedCount} />
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                navigate(buildCurrentAuthRedirectPath());
                return;
              }
              navigate("/templates/records");
            }}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/14 bg-white/10 px-4 text-xs font-black text-white/82 transition hover:bg-white/16 hover:text-white"
          >
            购买记录
          </button>
        </div>
      </div>

      <LitePanel className="border-white/10 bg-[#00140d] p-5 text-white shadow-[0_24px_70px_rgba(0,20,13,0.26)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleCategoryChange("")}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                !selectedCategory ? "bg-white text-[#00140d]" : "bg-white/8 text-white/58 hover:bg-white/14 hover:text-white"
              }`}
            >
              全部行业
            </button>
            {categories.map((category) => {
              const active = category.key === selectedCategory;
              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => handleCategoryChange(category.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
                    active
                      ? "bg-[#00b050] text-white shadow-[0_12px_28px_rgba(0,176,80,0.28)]"
                      : "bg-white/8 text-white/62 hover:bg-white/14 hover:text-white"
                  }`}
                >
                  <span>{category.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-white/16 text-white" : "bg-white/10 text-white/48"}`}>
                    {category.count}
                  </span>
                </button>
              );
            })}
          </div>
          <ModuleSearch
            moduleKey="templates"
            search={searchParams.toString()}
            onNavigate={navigate}
            className="h-12 w-full xl:w-[420px]"
          />
        </div>
      </LitePanel>

      {records.length === 0 ? (
        <LitePanel className="border-emerald-200/80 bg-[linear-gradient(135deg,#f4fff8_0%,#dcfce7_100%)] py-16 text-center shadow-[0_24px_60px_rgba(0,92,48,0.10)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[30px] border border-emerald-100 bg-white text-emerald-700 shadow-sm">
            <FolderKanban size={34} />
          </div>
          <div className="mt-6 text-2xl font-black text-emerald-950">{searchTerm ? "没有匹配的模板" : "当前分类下还没有模板"}</div>
          <div className="mt-2 text-sm font-semibold text-emerald-900/58">
            {searchTerm ? "换个关键词或清空搜索后再试。" : "后台新增并启用模板后，这里会自动展示。"}
          </div>
        </LitePanel>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {records.map((item) => {
            const previewUrl = normalizeResourceUrl(item.previewImageUrl);
            const costLabel = formatTemplateCost(item.downloadCostPoints);
            const canDownload = item.hasTemplateFile;
            const pending = downloadMutation.isPending && downloadMutation.variables === item.id;
            return (
              <LitePanel key={item.id} className="overflow-hidden p-0">
                <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="relative min-h-[220px] border-b border-slate-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_52%,#ecfeff_100%)] md:min-h-full md:border-b-0 md:border-r">
                    {previewUrl ? (
                      <img src={previewUrl} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-4 text-slate-400">
                        <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/70 bg-white shadow-sm">
                          <FileImage size={34} />
                        </div>
                        <div className="text-sm font-bold">暂无预览图</div>
                      </div>
                    )}
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-950/78 px-3 py-1 text-xs font-black text-white backdrop-blur-sm">
                        {item.industryCategory}
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
                          模板条目
                        </div>
                        <h2 className="mt-3 text-[30px] font-black tracking-tight text-slate-900">{item.title}</h2>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{costLabel}</span>
                        {item.downloaded ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">已下载</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                          <Layers3 size={14} />
                          使用场景
                        </div>
                        <div className="mt-2 text-sm font-semibold leading-6 text-slate-700">{item.useScenario || "未填写"}</div>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                          <Bookmark size={14} />
                          更新时间
                        </div>
                        <div className="mt-2 text-sm font-semibold leading-6 text-slate-700">{formatTemplateTime(item.updateTime)}</div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">模板说明</div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {item.templateDescription || "暂无模板说明"}
                      </p>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        <Tag size={14} />
                        使用到的函数
                      </div>
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
                        {canDownload ? "已配置模板文件，可直接下载使用" : "当前只展示模板信息，尚未上传模板文件"}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        disabled={!canDownload || pending}
                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition ${
                          canDownload
                            ? "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300"
                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Download size={16} />
                        {pending ? "下载中..." : item.downloaded ? "再次下载" : "下载模板"}
                      </button>
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

function TemplateMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 text-xs font-black text-white/74">
      <span className="text-white/42">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
