import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileSpreadsheet, Save, UploadCloud } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { api } from "../lib/api";
import type { ExcelWorkbookSnapshot } from "../lib/excel";
import type { QaCaseHelp } from "../lib/qa";
import { qaKeys } from "../lib/query-keys";
import { FastWorkbookFallbackEditor } from "../components/FastWorkbookFallbackEditor";

export function QaCaseAnswer() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [workbook, setWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [loadingWorkbook, setLoadingWorkbook] = useState(false);
  const answerId = searchParams.get("answerId");

  const caseQuery = useQuery({
    queryKey: qaKeys.caseDetail(id || "unknown"),
    enabled: Boolean(id),
    queryFn: () => api.get<QaCaseHelp>(`/api/qa/cases/${id}`, { silent: true }),
  });
  const qaCase = caseQuery.data;
  const editingAnswer = qaCase?.answers?.find((answer) => String(answer.id) === String(answerId));
  const editingMode = Boolean(answerId);

  const loadWorkbook = async () => {
    if (!id || (editingMode ? !answerId || !editingAnswer : !qaCase)) return;
    try {
      setLoadingWorkbook(true);
      const snapshotUrl =
        editingMode && answerId
          ? `/api/qa/cases/${id}/answers/${answerId}/template-snapshot`
          : `/api/qa/cases/${id}/template-snapshot`;
      const snapshot = await api.get<ExcelWorkbookSnapshot>(
        snapshotUrl,
        { silent: true },
      );
      setWorkbook(snapshot || { sheets: [] });
      setSelectedSheetName(snapshot?.sheets?.[0]?.name || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "模板加载失败");
    } finally {
      setLoadingWorkbook(false);
    }
  };

  const uploadAnswerMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scene", "reply_attachment");
      const upload = await api.post<{ url: string }>("/api/upload", formData, { silent: true });
      if (editingMode && answerId) {
        return api.put(`/api/qa/cases/${id}/answers/${answerId}`, { answerFileUrl: upload.url }, { silent: true });
      }
      return api.post(`/api/qa/cases/${id}/answers`, { answerFileUrl: upload.url }, { silent: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qaKeys.all });
      toast.success(editingMode ? "答疑模板已更新" : "答疑模板已上传");
      navigate(`/qa/cases/${id}#answers`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "上传失败");
    },
  });

  const submitWorkbookMutation = useMutation({
    mutationFn: () => {
      if (editingMode && answerId) {
        return api.put(`/api/qa/cases/${id}/answers/${answerId}/from-snapshot`, { workbook }, { silent: true });
      }
      return api.post(`/api/qa/cases/${id}/answers/from-snapshot`, { workbook }, { silent: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qaKeys.all });
      toast.success(editingMode ? "在线答疑已覆盖" : "在线答疑已提交");
      navigate(`/qa/cases/${id}#answers`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "提交失败");
    },
  });

  const handleDownloadTemplate = async () => {
    if (!id) return;
    try {
      await api.download(`/api/qa/cases/${id}/file`, `case-${id}.xlsx`, { silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载失败");
    }
  };

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate(`/qa/cases/${id}`)}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        返回求助详情
      </button>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              <FileSpreadsheet size={14} />
              {editingMode ? "编辑答疑" : "案例答疑"}
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-900">{qaCase?.title || "案例求助"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              可在线快速编辑后提交，也可以下载模板到 WPS/Excel 作答后上传。最终提交内容统一保存为 Excel 文件。
            </p>
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
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 transition hover:bg-sky-100">
              <UploadCloud size={16} />
              {editingMode ? "上传覆盖模板" : "上传答疑模板"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadAnswerMutation.mutate(file);
                }}
              />
            </label>
          </div>
        </div>

        {editingMode && !editingAnswer ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-rose-200 bg-rose-50 px-6 py-14 text-center text-sm font-bold text-rose-500">
            未找到可编辑的答疑记录
          </div>
        ) : workbook.sheets.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
            <div className="text-sm font-bold text-slate-500">
              {loadingWorkbook ? "正在加载模板..." : editingMode ? "点击下方按钮加载你的答疑模板" : "点击下方按钮加载求助模板"}
            </div>
            <button
              type="button"
              onClick={() => void loadWorkbook()}
              disabled={loadingWorkbook || (editingMode ? !answerId || !editingAnswer : !qaCase)}
              className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              加载模板
            </button>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
            <FastWorkbookFallbackEditor
              workbook={workbook}
              onWorkbookChange={setWorkbook}
              selectedSheetName={selectedSheetName}
              onSelectedSheetNameChange={setSelectedSheetName}
              readOnly={false}
              viewportClassName="h-[630px]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
              <div className="text-xs font-bold text-slate-500">当前工作表：{selectedSheetName || "-"}</div>
              <button
                type="button"
                onClick={() => submitWorkbookMutation.mutate()}
                disabled={submitWorkbookMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save size={16} />
                {editingMode ? "保存覆盖" : "提交在线答疑"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
