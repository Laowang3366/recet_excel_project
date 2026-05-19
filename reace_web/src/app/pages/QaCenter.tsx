import { lazy, Suspense, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Lightbulb, MessageSquareText, UploadCloud } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { api } from "../lib/api";
import type { ExcelRangeSelection, ExcelWorkbookSnapshot } from "../lib/excel";
import { extractRangeAnswerSnapshot, selectionToRangeRef } from "../lib/excel";
import { formatDateTime } from "../lib/format";
import { formatQaStatus, type QaCaseHelp, type QaPageResponse, type QaSolutionShare } from "../lib/qa";
import { qaKeys } from "../lib/query-keys";

const ExcelWorkbookEditor = lazy(() =>
  import("../components/ExcelWorkbookEditor").then((module) => ({ default: module.ExcelWorkbookEditor }))
);

type QaTab = "cases" | "solutions";

export function QaCenter() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<QaTab>("cases");
  const [caseTitle, setCaseTitle] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [templateFileUrl, setTemplateFileUrl] = useState("");
  const [workbook, setWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [selection, setSelection] = useState<ExcelRangeSelection | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const snapshotGetterRef = useRef<(() => ExcelWorkbookSnapshot | null) | null>(null);

  const casesQuery = useQuery({
    queryKey: qaKeys.cases({ page: 1, size: 20 }),
    queryFn: () => api.get<QaPageResponse<QaCaseHelp>>("/api/qa/cases?page=1&size=20", { silent: true }),
  });
  const sharesQuery = useQuery({
    queryKey: qaKeys.solutionShares({ page: 1, size: 20 }),
    queryFn: () => api.get<QaPageResponse<QaSolutionShare>>("/api/qa/solution-shares?page=1&size=20", { silent: true }),
  });

  const createCaseMutation = useMutation({
    mutationFn: () => {
      const latestWorkbook = snapshotGetterRef.current?.() || workbook;
      const answerRange = selectionToRangeRef(selection);
      const idealAnswerSnapshotJson = answerRange && selectedSheetName
        ? JSON.stringify(extractRangeAnswerSnapshot(latestWorkbook, selectedSheetName, answerRange))
        : "";
      return api.post("/api/qa/cases", {
        title: caseTitle.trim(),
        description: caseDescription.trim(),
        templateFileUrl,
        answerSheet: selectedSheetName,
        answerRange,
        idealAnswerSnapshotJson,
      }, { silent: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qaKeys.all });
      toast.success("求助已发布");
      setCaseTitle("");
      setCaseDescription("");
      setTemplateFileUrl("");
      setWorkbook({ sheets: [] });
      setSelectedSheetName("");
      setSelection(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "发布求助失败");
    },
  });

  const handleUploadTemplate = async (file: File | null) => {
    if (!file) return;
    try {
      setTemplateLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scene", "reply_attachment");
      const upload = await api.post<{ url: string }>("/api/upload", formData, { silent: true });
      const snapshot = await api.get<ExcelWorkbookSnapshot>(
        `/api/practice/template-snapshot?fileUrl=${encodeURIComponent(upload.url)}`,
        { silent: true },
      );
      setTemplateFileUrl(upload.url);
      setWorkbook(snapshot || { sheets: [] });
      setSelectedSheetName(snapshot?.sheets?.[0]?.name || "");
      setSelection(null);
      toast.success("模板上传完成，请在表格中保留理想答案并选择答案区域");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "模板上传失败");
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleCreateCase = () => {
    if (!caseTitle.trim()) {
      toast.error("求助标题不能为空");
      return;
    }
    if (!caseDescription.trim()) {
      toast.error("需求描述不能为空");
      return;
    }
    if (!templateFileUrl) {
      toast.error("请先上传 Excel 模板");
      return;
    }
    createCaseMutation.mutate();
  };

  const cases = casesQuery.data?.records || [];
  const shares = sharesQuery.data?.records || [];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-white/10 bg-[#031d14]/94 p-6 text-white shadow-[0_24px_70px_rgba(0,20,13,0.30)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-emerald-100">
              <MessageSquareText size={14} />
              求助答疑
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">案例求助与解题分享</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">
              上传真实 Excel 场景求助，或查看其他用户分享的答案和解题思路。这里保留做题平台的轻量结构，不扩展论坛功能。
            </p>
          </div>
          <Link
            to="/qa/my"
            className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/16"
          >
            查看我的答疑
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {([
            ["cases", "案例求助"],
            ["solutions", "解题分享"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2 text-sm font-black transition ${
                activeTab === tab ? "bg-white text-[#00140d]" : "bg-white/10 text-white/72 hover:bg-white/16 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "cases" ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-4">
            {cases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/qa/cases/${item.id}`)}
                className="w-full rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-slate-900">{item.title}</div>
                    <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.description}</div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    {formatQaStatus(item.status)}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
                  <span>答疑 {item.answerCount || 0}</span>
                  <span>浏览 {item.viewCount || 0}</span>
                  <span>{formatDateTime(item.createTime)}</span>
                </div>
              </button>
            ))}
            {!cases.length ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 px-6 py-12 text-center text-sm text-slate-400">
                暂无案例求助
              </div>
            ) : null}
          </section>

          <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-black text-slate-900">
              <UploadCloud size={20} className="text-emerald-600" />
              发起案例求助
            </div>
            <div className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              请先在 Excel 模板中输入理想答案，再上传模板。其他用户将能查看需求、理想答案并提交答疑模板。
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={caseTitle}
                onChange={(event) => setCaseTitle(event.target.value)}
                placeholder="求助标题"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
              <textarea
                value={caseDescription}
                onChange={(event) => setCaseDescription(event.target.value)}
                placeholder="填写需求描述，例如希望按月份、区域统计销售榜单..."
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-black text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50">
                <FileSpreadsheet size={18} />
                {templateFileUrl ? "重新上传 Excel 模板" : "上传 Excel 模板"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => void handleUploadTemplate(event.target.files?.[0] || null)}
                />
              </label>
            </div>

            {templateLoading ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
                正在加载模板...
              </div>
            ) : workbook.sheets.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <Suspense fallback={<div className="h-[360px] p-10 text-center text-sm text-slate-400">正在加载编辑器...</div>}>
                  <ExcelWorkbookEditor
                    workbook={workbook}
                    onWorkbookChange={setWorkbook}
                    selectedSheetName={selectedSheetName}
                    onSelectedSheetNameChange={setSelectedSheetName}
                    selection={selection}
                    onSelectionChange={setSelection}
                    selectionEnabled
                    showConfirmSelectionButton
                    confirmSelectionLabel="确认理想答案区域"
                    onConfirmSelection={() => toast.success("理想答案区域已记录")}
                    onSnapshotCaptureReady={(capture) => {
                      snapshotGetterRef.current = capture;
                    }}
                    className="h-[430px]"
                    viewportClassName="h-[360px]"
                  />
                </Suspense>
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                  当前区域：{selectedSheetName || "-"} / {selectionToRangeRef(selection) || "-"}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleCreateCase}
              disabled={createCaseMutation.isPending}
              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {createCaseMutation.isPending ? "提交中..." : "提交求助"}
            </button>
          </aside>
        </div>
      ) : (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {shares.map((item) => (
            <Link
              key={item.id}
              to={`/qa/solutions/${item.id}`}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <Lightbulb size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-black text-slate-900">{item.title}</div>
                  <div className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                    {item.thoughtText || "该用户分享了答案和判题明细，暂未填写解题思路。"}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
                    <span>{item.author?.username || "用户"}</span>
                    <span>浏览 {item.viewCount || 0}</span>
                    <span>{formatDateTime(item.createTime)}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {!shares.length ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 px-6 py-12 text-center text-sm text-slate-400 lg:col-span-2">
              暂无解题分享
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
