import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
  FolderUp,
  LoaderCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LiteHero, LitePageFrame, LitePanel, LiteSectionTitle } from "../components/LiteSurface";
import { api } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { normalizeResourceUrl } from "../lib/mappers";
import { pointsKeys, toolsKeys } from "../lib/query-keys";
import { useSession } from "../lib/session";

type TargetType = "word" | "excel" | "pdf";

const targetCards: Array<{
  id: TargetType;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}> = [
  {
    id: "word",
    title: "转为 Word",
    description: "输出为 `.docx`，适合继续编辑文档正文、批注和结构性说明。",
    icon: FileText,
    accent: "from-sky-500 to-blue-600",
  },
  {
    id: "excel",
    title: "转为 Excel",
    description: "输出为 `.xlsx`，适合表格化整理、数据归档和后续计算。",
    icon: FileSpreadsheet,
    accent: "from-emerald-500 to-teal-600",
  },
  {
    id: "pdf",
    title: "转为 PDF",
    description: "输出为 `.pdf`，适合归档、打印、分享和固定版本留存。",
    icon: FileType2,
    accent: "from-rose-500 to-orange-500",
  },
];

export function Tools() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useSession();
  const [selectedTarget, setSelectedTarget] = useState<TargetType>("pdf");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<{ fileName: string; url: string } | null>(null);
  const overviewQuery = useQuery({
    queryKey: toolsKeys.overview(),
    queryFn: () => api.get<{ conversionCostPoints?: number; user?: { points?: number } }>("/api/tools/overview", { silent: true }),
  });
  const conversionCostPoints = Number(overviewQuery.data?.conversionCostPoints || 5);
  const currentPoints = Number(overviewQuery.data?.user?.points || 0);
  const insufficientPoints = isAuthenticated && currentPoints < conversionCostPoints;

  const conversionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("请先选择文件");
      }
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("targetType", selectedTarget);
      return api.post<{ fileName: string; url: string; message: string }>("/api/tools/convert", formData);
    },
    onSuccess: (result) => {
      setLastResult({ fileName: result.fileName, url: result.url });
      toast.success("文件转换完成");
      void queryClient.invalidateQueries({ queryKey: toolsKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: pointsKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: toolsKeys.history() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "文件转换失败");
    },
  });

  const selectedTargetMeta = useMemo(
    () => targetCards.find((item) => item.id === selectedTarget) || targetCards[0],
    [selectedTarget]
  );

  const handleConvert = () => {
    if (!isAuthenticated) {
      navigate(buildCurrentAuthRedirectPath());
      return;
    }
    if (!selectedFile) {
      toast.info("请先选择文件");
      return;
    }
    if (currentPoints < conversionCostPoints) {
      toast.info(`积分不足，每次转换需要 ${conversionCostPoints} 积分`);
      return;
    }
    void conversionMutation.mutateAsync();
  };

  return (
    <LitePageFrame>
      <LiteHero
        eyebrow="实用功能"
        title="文件转换"
        description="支持 Word、Excel、PDF 文件互转，上传、选择格式、下载结果和历史记录都在同一个工具面板里完成。"
        actions={
          <>
            <button
              type="button"
              onClick={handleConvert}
              disabled={conversionMutation.isPending || !selectedFile}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-900 disabled:cursor-not-allowed disabled:bg-white/60"
            >
              {conversionMutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
              {conversionMutation.isPending ? "正在转换..." : `转换为 ${selectedTargetMeta.title.replace("转为 ", "")}`}
            </button>
            <button
              type="button"
              onClick={() => navigate("/tools/history")}
              className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-6 py-3 text-sm font-bold text-white"
            >
              <Clock3 size={16} />
              转换记录
            </button>
          </>
        }
        aside={
          <div className="rounded-[30px] border border-white/12 bg-white/10 p-5 backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[12px] font-black tracking-[0.18em] text-white/70">支持格式</div>
                <div className="mt-2 text-2xl font-black text-white">三种目标格式</div>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Sparkles size={22} />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                "支持 Word、Excel、PDF 三类文件互转",
                `每次转换消耗 ${conversionCostPoints} 积分`,
                isAuthenticated ? `当前可用积分 ${currentPoints}` : "登录后可使用转换功能",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white/82">
                  {item}
                </div>
              ))}
            </div>
          </div>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <LitePanel>
          <LiteSectionTitle
            eyebrow="上传文件"
            title="上传待转换文件"
            description="支持 doc、docx、xls、xlsx、pdf。"
            />
            <label className="mt-6 block cursor-pointer rounded-[30px] border-2 border-dashed border-slate-200 bg-[linear-gradient(180deg,#f8fafb_0%,#f3f9f8_100%)] px-6 py-12 text-center transition hover:border-teal-300 hover:bg-teal-50/40">
              <input
                type="file"
                accept=".doc,.docx,.xls,.xlsx,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setSelectedFile(file);
                  setLastResult(null);
                }}
              />
              <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[28px] bg-white text-teal-600 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                <FolderUp size={30} />
              </div>
              <div className="mt-5 text-xl font-black text-slate-900">
                {selectedFile ? selectedFile.name : "点击选择文件"}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {selectedFile
                  ? `已选择 ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                  : "文件进入后，右侧立即选择目标格式并开始转换"}
              </div>
            </label>

            {lastResult ? (
              <div className="mt-5 rounded-[26px] border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf3_0%,#f5fffa_100%)] px-5 py-5">
                <div className="text-sm font-black text-emerald-700">最近一次转换已完成</div>
                <div className="mt-2 break-all text-sm font-semibold text-emerald-950">{lastResult.fileName}</div>
                <a
                  href={normalizeResourceUrl(lastResult.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700"
                >
                  <Download size={16} />
                  下载结果文件
                </a>
              </div>
            ) : null}
          </LitePanel>

          {lastResult ? (
            <LitePanel>
              <LiteSectionTitle
                eyebrow="最近结果"
                title="最近一次转换"
                description="最新结果文件可直接下载，完整历史请到独立记录页查看。"
              />
              <div className="mt-5 rounded-[26px] border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf3_0%,#f5fffa_100%)] px-5 py-5">
                <div className="text-sm font-black text-emerald-700">转换已完成</div>
                <div className="mt-2 break-all text-sm font-semibold text-emerald-950">{lastResult.fileName}</div>
                <a
                  href={normalizeResourceUrl(lastResult.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700"
                >
                  <Download size={16} />
                  下载结果文件
                </a>
              </div>
            </LitePanel>
          ) : null}
        </div>

        <div className="space-y-5">
          <LitePanel>
          <LiteSectionTitle
            eyebrow="目标格式"
            title="选择目标格式"
            description="选择输出格式后开始转换。"
            />
            <div className="mt-5 space-y-3">
              {targetCards.map((item) => {
                const Icon = item.icon;
                const active = item.id === selectedTarget;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedTarget(item.id)}
                    whileTap={{ scale: 0.985 }}
                    className={`w-full rounded-[26px] border px-5 py-5 text-left transition ${
                      active
                        ? "border-transparent bg-slate-900 text-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-sm`}>
                        <Icon size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-black">{item.title}</div>
                        <div className={`mt-2 text-sm leading-6 ${active ? "text-slate-200" : "text-slate-500"}`}>
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleConvert}
              disabled={conversionMutation.isPending || !selectedFile || insufficientPoints}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 px-5 text-sm font-black text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {conversionMutation.isPending ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRightLeft size={18} />}
              {conversionMutation.isPending
                ? "正在转换..."
                : insufficientPoints
                  ? `积分不足，需要 ${conversionCostPoints} 积分`
                  : `转换为 ${selectedTargetMeta.title.replace("转为 ", "")}`}
            </button>
          </LitePanel>

          <LitePanel>
          <LiteSectionTitle
            eyebrow="转换说明"
            title="转换说明"
            description="部分复杂排版转换后可能需要手动调整。"
            />
            <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
              <p>1. Word 与 Excel 直接互转时，优先保留内容与表格结构，复杂版式会有一定排版偏差。</p>
              <p>2. PDF 转 Excel 会尽量还原表格，但扫描件、图片型 PDF 仍可能需要人工整理。</p>
              <p>3. 转换依赖服务器侧 Office 相关组件或兼容链路，组件不完整时接口会直接返回失败提示。</p>
            </div>
          </LitePanel>
        </div>
      </section>
    </LitePageFrame>
  );
}
