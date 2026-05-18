import { Suspense, lazy, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CheckCircle2, Clock, FileSpreadsheet, LoaderCircle, Play, Target, UploadCloud, ClipboardList, History, MousePointer2 } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { api } from "../lib/api";
import { handleLoginRequiredError, showLoginRequiredToast } from "../lib/auth-required";
import {
  buildWorkbookWithAnswerSnapshot,
  columnIndexToLabel,
  ExcelRangeSelection,
  ExcelWorkbookSnapshot,
  extractRangeAnswerSnapshot,
  normalizeSelection,
  parseRangeRef,
  selectionToRangeRef,
} from "../lib/excel";
import { formatNumber } from "../lib/format";
import { normalizeAvatarUrl, normalizeImageUrl } from "../lib/mappers";
import { practiceKeys } from "../lib/query-keys";
import { useSession } from "../lib/session";

const ExcelWorkbookEditor = lazy(() =>
  import("../components/ExcelWorkbookEditor").then((module) => ({ default: module.ExcelWorkbookEditor }))
);

type PracticeCategorySummary = {
  id?: number | string;
  name?: string | null;
};

type PracticeQuestionSummary = {
  id: number | string;
  title?: string;
  categoryName?: string | null;
  questionCategoryName?: string | null;
  difficulty?: number | string;
  points?: number | string;
  templateFileUrl?: string | null;
  userStatus?: string | null;
  bestScore?: number | string | null;
  total?: number | string | null;
  count?: number | string | null;
  completed?: boolean | null;
  score?: number | string | null;
};

type PracticeCategoriesResponse = {
  categories?: PracticeCategorySummary[];
};

type PracticeQuestionListResponse = {
  questions?: PracticeQuestionSummary[];
};

type PracticeLeaderboardRecord = {
  userId?: number | string;
  username?: string | null;
  avatar?: string | null;
  totalScore?: number;
  completedQuestionCount?: number;
};

type PracticeLeaderboardResponse = {
  records?: PracticeLeaderboardRecord[];
};

type PracticeSubmissionRecord = {
  id: number | string;
  title?: string | null;
  status?: string | null;
  questionCategoryName?: string | null;
  difficulty?: number | string | null;
  points?: number | string | null;
  answerSheet?: string | null;
  answerRange?: string | null;
  createTime?: string | null;
  reviewedTime?: string | null;
  reviewNote?: string | null;
  templateFileUrl?: string | null;
};

type PracticeSubmissionsResponse = {
  records?: PracticeSubmissionRecord[];
  total?: number;
  pages?: number;
};

function defaultSubmissionForm() {
  return {
    title: "",
    questionCategoryId: "",
    difficulty: "1",
    points: "0",
    description: "",
    templateFileUrl: "",
    answerSheet: "",
    answerRange: "",
    answerSnapshotJson: "",
    checkFormula: false,
  };
}

export function Practice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useSession();
  const [activeTab, setActiveTab] = useState("全部");
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [submissionProgressOpen, setSubmissionProgressOpen] = useState(false);
  const [submissionProgressPage, setSubmissionProgressPage] = useState(1);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateWorkbook, setTemplateWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [editorWorkbook, setEditorWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [selection, setSelection] = useState<ExcelRangeSelection | null>(null);
  const [isSelectingAnswerRange, setIsSelectingAnswerRange] = useState(false);
  const [editorFullscreenVersion, setEditorFullscreenVersion] = useState(0);
  const [submissionForm, setSubmissionForm] = useState(defaultSubmissionForm());
  const editorSnapshotGetterRef = useRef<(() => ExcelWorkbookSnapshot | null) | null>(null);

  const categoriesQuery = useQuery({
    queryKey: practiceKeys.categories(),
    queryFn: () => api.get<PracticeCategoriesResponse>("/api/practice/categories", { auth: false, silent: true }),
  });
  const questionListQuery = useQuery({
    queryKey: practiceKeys.questionList(),
    queryFn: () => api.get<PracticeQuestionListResponse>("/api/practice/question-list", { silent: true }),
  });
  const leaderboardQuery = useQuery({
    queryKey: practiceKeys.leaderboard(),
    queryFn: () => api.get<PracticeLeaderboardResponse>("/api/practice/leaderboard", { auth: false, silent: true }),
  });
  const submissionProgressQuery = useQuery({
    queryKey: practiceKeys.submissions({ page: submissionProgressPage, size: 8 }),
    enabled: Boolean(isAuthenticated && submissionProgressOpen),
    queryFn: () => api.get<PracticeSubmissionsResponse>(`/api/practice/submissions/mine?page=${submissionProgressPage}&size=8`, { silent: true }),
  });

  const categories = categoriesQuery.data?.categories || [];
  const questionGroups = questionListQuery.data?.questions || [];
  const leaderboard = leaderboardQuery.data?.records || [];

  const tabs = useMemo(() => {
    const sourceNames = categories.length > 0
      ? categories.map((item) => item.name)
      : questionGroups.map((item) => item.categoryName || item.questionCategoryName || "未分类");
    return ["全部", ...Array.from(new Set(sourceNames.filter(Boolean)))];
  }, [categories, questionGroups]);

  const filteredQuestions = questionGroups.filter((item) => (
    activeTab === "全部"
      || item.categoryName === activeTab
      || item.questionCategoryName === activeTab
  ));

  const resetSubmissionState = () => {
    setSubmissionForm(defaultSubmissionForm());
    setTemplateWorkbook({ sheets: [] });
    setEditorWorkbook({ sheets: [] });
    setSelectedSheetName("");
    setSelection(null);
    setIsSelectingAnswerRange(false);
  };

  const loadTemplateWorkbook = async (
    fileUrl: string,
    answerSheet?: string | null,
    answerRange?: string | null,
    answerSnapshotJson?: string | null,
  ) => {
    setTemplateLoading(true);
    try {
      const snapshot = await api.get<ExcelWorkbookSnapshot>(`/api/practice/template-snapshot?fileUrl=${encodeURIComponent(fileUrl)}`, { silent: true });
      const sheetName = answerSheet || snapshot?.sheets?.[0]?.name || "";
      const workbookWithAnswer = buildWorkbookWithAnswerSnapshot(snapshot, answerSheet, answerRange, answerSnapshotJson);
      setTemplateWorkbook(snapshot || { sheets: [] });
      setEditorWorkbook(workbookWithAnswer);
      setSelectedSheetName(sheetName);
      const parsedRange = answerRange ? parseRangeRef(answerRange) : null;
      setSelection(parsedRange && sheetName
        ? normalizeSelection(sheetName, parsedRange.startRow, parsedRange.startCol, parsedRange.endRow, parsedRange.endCol)
        : null);
    } finally {
      setTemplateLoading(false);
    }
  };

  const submitQuestionMutation = useMutation({
    mutationFn: async () => {
      const resolvedSheetName = submissionForm.answerSheet || selection?.sheetName || selectedSheetName;
      const resolvedRange = selectionToRangeRef(selection) || submissionForm.answerRange;
      const latestWorkbook = editorSnapshotGetterRef.current?.() || editorWorkbook;
      const answerSnapshot = extractRangeAnswerSnapshot(latestWorkbook, resolvedSheetName, resolvedRange);
      return api.post("/api/practice/submissions", {
        title: submissionForm.title.trim(),
        questionCategoryId: submissionForm.questionCategoryId ? Number(submissionForm.questionCategoryId) : null,
        difficulty: Number(submissionForm.difficulty || 1),
        points: Number(submissionForm.points || 0),
        description: submissionForm.description.trim(),
        templateFileUrl: submissionForm.templateFileUrl,
        answerSheet: resolvedSheetName,
        answerRange: resolvedRange,
        answerSnapshotJson: JSON.stringify(answerSnapshot),
        checkFormula: Boolean(submissionForm.checkFormula),
        sheetCountLimit: 5,
        version: 1,
      }, { silent: true });
    },
    onSuccess: async () => {
      toast.success("试题投稿已提交，等待管理员审核");
      setSubmissionOpen(false);
      resetSubmissionState();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: practiceKeys.questionList() }),
        queryClient.invalidateQueries({ queryKey: practiceKeys.submissions({ page: submissionProgressPage, size: 8 }) }),
      ]);
    },
    onError: (error) => {
      if (!handleLoginRequiredError(error, "请先登录后再投稿试题")) {
        toast.error(error instanceof Error ? error.message : "试题投稿提交失败");
      }
    },
  });

  const handleOpenSubmission = () => {
    if (!isAuthenticated) {
      showLoginRequiredToast("请先登录后再上传试题");
      return;
    }
    resetSubmissionState();
    setSubmissionOpen(true);
  };

  const handleOpenSubmissionProgress = () => {
    if (!isAuthenticated) {
      showLoginRequiredToast("请先登录后查看投稿进度");
      return;
    }
    setSubmissionProgressPage(1);
    setSubmissionProgressOpen(true);
  };

  const handleUploadTemplate = async (file: File | null) => {
    if (!file) return;
    if (!isAuthenticated) {
      showLoginRequiredToast("请先登录后再上传模板");
      return;
    }
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("仅支持上传 .xlsx 或 .xls 模板");
      return;
    }
    setIsUploadingTemplate(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await api.post<{ url: string }>("/api/upload", formData, { silent: true });
      setSubmissionForm((prev) => ({
        ...prev,
        templateFileUrl: uploadResult.url,
        answerSheet: "",
        answerRange: "",
        answerSnapshotJson: "",
      }));
      await loadTemplateWorkbook(uploadResult.url);
      toast.success("模板上传完成");
    } catch (error) {
      if (!handleLoginRequiredError(error, "请先登录后再上传模板")) {
        toast.error(error instanceof Error ? error.message : "模板上传失败");
      }
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  const openAnswerRangeEditor = () => {
    const sheetName = submissionForm.answerSheet || selectedSheetName;
    if (!sheetName) {
      toast.error("请先选择答题工作表");
      return;
    }
    const parsedRange = submissionForm.answerRange ? parseRangeRef(submissionForm.answerRange) : null;
    const nextSelection = parsedRange
      ? normalizeSelection(sheetName, parsedRange.startRow, parsedRange.startCol, parsedRange.endRow, parsedRange.endCol)
      : normalizeSelection(sheetName, 1, 1, 1, 1);
    setSelectedSheetName(sheetName);
    setSelection(nextSelection);
    setIsSelectingAnswerRange(true);
    setEditorFullscreenVersion((current) => current + 1);
  };

  const confirmAnswerRange = () => {
    const nextRange = selectionToRangeRef(selection);
    if (!selection || !nextRange) {
      toast.error("请先在模板编辑器中选择答题区域");
      return;
    }
    setSubmissionForm((prev) => ({
      ...prev,
      answerSheet: selection.sheetName,
      answerRange: nextRange,
    }));
    setSelectedSheetName(selection.sheetName);
    setIsSelectingAnswerRange(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
  };

  const handleSubmitQuestion = () => {
    const resolvedSheetName = submissionForm.answerSheet || selection?.sheetName || selectedSheetName;
    const resolvedRange = selectionToRangeRef(selection) || submissionForm.answerRange;
    if (!submissionForm.title.trim()) {
      toast.error("题目标题不能为空");
      return;
    }
    if (!submissionForm.templateFileUrl) {
      toast.error("请先上传 Excel 模板");
      return;
    }
    if (!resolvedSheetName) {
      toast.error("请选择答题工作表");
      return;
    }
    if (!resolvedRange) {
      toast.error("请先在表格中框选答题区域");
      return;
    }
    const latestWorkbook = editorSnapshotGetterRef.current?.() || editorWorkbook;
    const answerSnapshot = extractRangeAnswerSnapshot(latestWorkbook, resolvedSheetName, resolvedRange);
    const hasEmptyAnswerCell = answerSnapshot.values.some((row) => (
      row.some((value) => String(value ?? "").trim().length === 0)
    ));
    if (hasEmptyAnswerCell) {
      toast.error("标准答案存在空白单元格，请补全答题区域内的值");
      return;
    }
    submitQuestionMutation.mutate();
  };

  const currentSelectionText = selectionToRangeRef(selection) || submissionForm.answerRange || "未选择";
  const sheetOptions = templateWorkbook.sheets || [];
  const currentPreviewWorkbook = editorSnapshotGetterRef.current?.() || editorWorkbook;
  const answerPreview = extractRangeAnswerSnapshot(
    currentPreviewWorkbook,
    submissionForm.answerSheet || selectedSheetName,
    selectionToRangeRef(selection) || submissionForm.answerRange,
  );
  const previewRangeRef = selectionToRangeRef(selection) || submissionForm.answerRange;
  const previewRange = previewRangeRef ? parseRangeRef(previewRangeRef) : null;
  const answerPreviewText = answerPreview.values.flatMap((valueRow, rowIndex) => (
    valueRow.map((value, colIndex) => {
      const formula = answerPreview.formulas?.[rowIndex]?.[colIndex];
      return formula ? `=${formula}` : String(value ?? "");
    })
  )).filter((item) => item.trim().length > 0).join(" | ");
  const answerPreviewHasEmptyCell = answerPreview.values.some((row) => (
    row.some((value) => String(value ?? "").trim().length === 0)
  ));
  const previewColumnLabels = previewRange
    ? Array.from({ length: previewRange.endCol - previewRange.startCol + 1 }, (_, index) => columnIndexToLabel(previewRange.startCol + index))
    : [];
  const previewRowLabels = previewRange
    ? Array.from({ length: previewRange.endRow - previewRange.startRow + 1 }, (_, index) => previewRange.startRow + index)
    : [];
  const persistedRange = submissionForm.answerRange ? parseRangeRef(submissionForm.answerRange) : null;
  const persistedFocusRange = submissionForm.answerSheet && persistedRange
    ? normalizeSelection(submissionForm.answerSheet, persistedRange.startRow, persistedRange.startCol, persistedRange.endRow, persistedRange.endCol)
    : null;
  const selectionToPersistedRange = (sheetName: string, rangeText: string) => {
    const parsed = rangeText ? parseRangeRef(rangeText) : null;
    if (!parsed || !sheetName) return null;
    return normalizeSelection(sheetName, parsed.startRow, parsed.startCol, parsed.endRow, parsed.endCol);
  };
  const submissionProgressRecords = submissionProgressQuery.data?.records || [];
  const submissionProgressTotal = submissionProgressQuery.data?.total || 0;
  const submissionProgressPages = Math.max(1, submissionProgressQuery.data?.pages || 1);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 font-sans">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="relative flex min-h-[280px] flex-col justify-center overflow-hidden rounded-[32px] bg-[#1e2330] p-10 md:p-12">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-full overflow-hidden">
            <div className="absolute -bottom-[40%] -right-[10%] h-[600px] w-[600px] rotate-12 rounded-[40%] bg-[#2a3040]" />
            <div className="absolute right-[20%] top-[10%] h-[300px] w-[300px] rounded-full bg-[#2a3040]/50 blur-2xl" />
          </div>

          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-emerald-400 backdrop-blur-sm">
              <Target size={16} />
              小试牛刀
            </div>
            <h1 className="mb-4 text-3xl font-bold tracking-wide text-white md:text-4xl">检验你的 Excel 技能</h1>
            <p className="mb-8 max-w-xl text-sm leading-relaxed text-slate-400 md:text-[15px]">
              通过每日答题挑战，提升你的公式、函数与数据分析能力。完成挑战可获得丰厚积分奖励，更有机会登上全站达人榜。
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate("/practice/random")}
                className="flex w-fit items-center gap-2 rounded-full bg-[#00c875] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#00c875]/20 transition-all hover:scale-105 hover:bg-[#00b065] active:scale-95"
              >
                <Play size={16} className="fill-current" />
                开始随机测试
              </button>
              <button
                onClick={handleOpenSubmission}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:border-white/25 hover:bg-white/14"
              >
                <UploadCloud size={16} />
                上传试题
              </button>
              <button
                onClick={handleOpenSubmissionProgress}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-[#111827]/60 px-5 py-3 text-sm font-bold text-slate-100 backdrop-blur-sm transition hover:border-white/25 hover:bg-[#0f172a]"
              >
                <ClipboardList size={16} />
                投稿进度
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="col-span-2 space-y-6">
            <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white/50 py-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-4 pl-2">
                <h2 className="text-[22px] font-bold tracking-tight text-slate-800">精选题库</h2>
                <button onClick={() => navigate("/practice/history")} className="flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-1.5 text-[13px] font-bold text-teal-600 transition-colors hover:bg-teal-100">
                  <Clock size={14} />
                  练习记录
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full px-5 py-2 text-[15px] font-medium transition-all ${activeTab === tab ? "bg-[#1e2330] text-white shadow-md" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              {filteredQuestions.map((question, idx) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => navigate(`/practice/question/${question.id}`)}
                  className="group flex cursor-pointer items-center gap-5 rounded-[24px] border border-gray-200 bg-white p-4 pr-6 shadow-sm transition-all hover:border-gray-300"
                >
                  <div className="ml-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-emerald-50 text-xl font-bold text-emerald-600">
                    {question.id}
                  </div>
                  <div className="min-w-0 flex-1 py-2">
                    <div className="mb-1 flex items-center gap-2 text-[13px] font-medium">
                      <span className="text-slate-500">{question.categoryName || question.questionCategoryName || "全部"}</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-emerald-500">难度 {question.difficulty || 1}</span>
                      <span className="ml-2 text-gray-300">{question.total || question.count || 1}题</span>
                      {question.completed ? (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                            <CheckCircle2 size={12} />
                            已完成
                          </span>
                        </>
                      ) : null}
                    </div>
                    <h3 className="truncate text-[18px] font-bold text-slate-800 transition-colors group-hover:text-[#00c875]">{question.title}</h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-6">
                    <div className="hidden text-center sm:block">
                      <div className="text-[16px] font-bold text-slate-700">{question.score || 0}</div>
                      <div className="text-[12px] font-medium text-slate-400">积分</div>
                    </div>
                    <button className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#f0fdf4] px-4 text-sm font-bold text-[#00c875] transition-all hover:bg-[#dcfce7]">
                      <Play size={18} className="ml-0.5" />
                      {question.completed ? "再试一下" : "开始练习"}
                    </button>
                  </div>
                </motion.div>
              ))}
              {filteredQuestions.length === 0 ? (
                <div className="rounded-3xl bg-white p-10 text-center text-slate-400">当前分类暂无题目</div>
              ) : null}
            </div>
          </div>

          <div className="col-span-1">
            <div className="relative h-full overflow-hidden rounded-[32px] border border-gray-100 bg-white p-8 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.05)]">
              <div className="pointer-events-none absolute top-4 -right-12 rotate-[-12deg] text-gray-50/60">
                <Award size={200} strokeWidth={1.5} />
              </div>
              <div className="relative z-10 mb-8 flex items-center gap-3">
                <Award className="text-[#ff9800]" size={28} />
                <h2 className="text-[22px] font-bold tracking-tight text-slate-800">本周答题榜</h2>
              </div>
              <div className="relative z-10 space-y-6">
                {leaderboard.map((item, idx) => (
                  <div key={item.userId || item.username} className="flex items-center gap-4">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${idx === 0 ? "bg-[#ffc107] text-white shadow-md shadow-[#ffc107]/30" : idx === 1 ? "bg-[#cfd8dc] text-white shadow-md shadow-slate-300/30" : idx === 2 ? "bg-[#ff9800] text-white shadow-md shadow-[#ff9800]/30" : "ml-2 w-6 bg-transparent text-slate-400"}`}>
                      {idx + 1}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <img src={normalizeAvatarUrl(item.avatar, item.username)} className="h-10 w-10 rounded-full object-cover" />
                      <div>
                        <div className="mb-1 truncate text-[16px] font-bold text-slate-800">{item.username}</div>
                        <div className="flex items-center gap-4 text-[13px] font-medium text-slate-500">
                          <span className="flex items-center gap-1.5"><Target size={14} className="text-[#00c875]" />{formatNumber(item.totalScore || 0)} 分</span>
                          <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" />{item.completedQuestionCount || 0} 题</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 ? <div className="text-sm text-slate-400">暂无排行榜数据</div> : null}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={submissionOpen} onOpenChange={(nextOpen) => {
          setSubmissionOpen(nextOpen);
          if (!nextOpen) {
            setIsSelectingAnswerRange(false);
          }
        }}>
          <DialogContent className="!w-[min(1660px,calc(100vw-1rem))] !max-w-[min(1660px,calc(100vw-1rem))] sm:!max-w-[min(1660px,calc(100vw-1rem))]">
            <DialogHeader>
              <DialogTitle>上传试题</DialogTitle>
              <DialogDescription>用户投稿题型与后台 Excel 模板题保持同一套核心参数，工作表、答题区域和标准答案均为必填。</DialogDescription>
            </DialogHeader>
            <div className="max-h-[calc(100vh-8rem)] space-y-5 overflow-y-auto pr-2">
              <div className="grid gap-4 xl:grid-cols-[minmax(420px,2.1fr)_220px_180px_180px]">
                <label className="block">
                  <div className="mb-2 text-sm font-bold text-slate-700">题目标题</div>
                  <input
                    value={submissionForm.title}
                    onChange={(e) => setSubmissionForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    placeholder="输入试题标题"
                  />
                </label>
                <label className="block">
                  <div className="mb-2 text-sm font-bold text-slate-700">题目分类</div>
                  <select
                    value={submissionForm.questionCategoryId}
                    onChange={(e) => setSubmissionForm((prev) => ({ ...prev, questionCategoryId: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="">请选择分类</option>
                    {categories.map((item) => (
                      <option key={item.id || item.name} value={item.id || ""}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="mb-2 text-sm font-bold text-slate-700">难度</div>
                  <select
                    value={submissionForm.difficulty}
                    onChange={(e) => setSubmissionForm((prev) => ({ ...prev, difficulty: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  >
                    {[1, 2, 3, 4, 5].map((item) => (
                      <option key={item} value={item}>难度 {item}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="mb-2 text-sm font-bold text-slate-700">奖励积分</div>
                  <input
                    type="number"
                    min="0"
                    value={submissionForm.points}
                    onChange={(e) => setSubmissionForm((prev) => ({ ...prev, points: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Excel 模板</div>
                    <div className="mt-1 text-xs text-slate-500">{submissionForm.templateFileUrl || "尚未上传模板文件"}</div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-600">
                    {isUploadingTemplate ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {isUploadingTemplate ? "上传中..." : "上传模板文件"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        void handleUploadTemplate(e.target.files?.[0] || null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {sheetOptions.length > 0 ? (
                  <div className="grid gap-4 xl:grid-cols-[220px_240px_minmax(320px,1fr)_auto]">
                    <label className="block">
                      <div className="mb-2 text-sm font-bold text-slate-700">答题工作表</div>
                      <select
                        value={submissionForm.answerSheet || selectedSheetName}
                        onChange={(e) => {
                          const nextSheetName = e.target.value;
                          setSelectedSheetName(nextSheetName);
                          setSubmissionForm((prev) => ({ ...prev, answerSheet: nextSheetName }));
                          setSelection(selectionToPersistedRange(nextSheetName, submissionForm.answerRange));
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      >
                        <option value="">请选择</option>
                        {sheetOptions.map((item) => (
                          <option key={item.name} value={item.name}>{item.name}</option>
                        ))}
                      </select>
                    </label>

                    <div className="block">
                      <div className="mb-2 text-sm font-bold text-slate-700">答题区域</div>
                      <div className="flex gap-2">
                        <input value={currentSelectionText} readOnly className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none" />
                        <button type="button" onClick={openAnswerRangeEditor} className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-teal-500 bg-teal-500 px-4 text-sm font-bold text-white shadow-sm transition hover:border-teal-600 hover:bg-teal-600">
                          <MousePointer2 size={15} />
                          选择区域
                        </button>
                      </div>
                    </div>

                    <div className="block">
                      <div className="mb-2 text-sm font-bold text-slate-700">标准答案</div>
                      <div className="space-y-2">
                        <input value={answerPreviewText || "未填写"} readOnly className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none" />
                        {answerPreviewHasEmptyCell ? (
                          <div className="text-xs font-medium text-amber-600">答题区域中存在空白单元格，提交前请补全标准答案。</div>
                        ) : null}
                      </div>
                    </div>

                    <label className="flex items-end">
                      <span className="inline-flex h-11 whitespace-nowrap items-center gap-2 rounded-xl border border-[#d9d9d9] bg-white px-4 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(submissionForm.checkFormula)}
                          onChange={(e) => setSubmissionForm((prev) => ({ ...prev, checkFormula: e.target.checked }))}
                        />
                        检测函数公式
                      </span>
                    </label>
                  </div>
                ) : null}

                <div className="mt-4 text-xs text-slate-500">
                  先选工作表，再在表格中拖拽框选答题区域；框选完成后，直接在模板编辑器里填写标准答案或公式。
                </div>

                {previewRange ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-900">标准答案预览</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {submissionForm.answerSheet || selectedSheetName || "-"} / {previewRangeRef || "-"}
                        </div>
                      </div>
                      {answerPreviewHasEmptyCell ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">存在空白单元格</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">答案已完整</span>
                      )}
                    </div>
                    <div className="overflow-auto rounded-2xl border border-slate-200">
                      <table className="min-w-full border-separate border-spacing-0 text-sm">
                        <thead>
                          <tr>
                            <th className="sticky left-0 top-0 z-20 min-w-14 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                              #
                            </th>
                            {previewColumnLabels.map((label) => (
                              <th key={`preview-col-${label}`} className="min-w-[120px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {answerPreview.values.map((row, rowIndex) => (
                            <tr key={`preview-row-${previewRowLabels[rowIndex] || rowIndex}`}>
                              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-black text-slate-500">
                                {previewRowLabels[rowIndex] || rowIndex + 1}
                              </th>
                              {row.map((value, colIndex) => {
                                const formula = answerPreview.formulas?.[rowIndex]?.[colIndex];
                                const displayValue = formula ? `=${formula}` : String(value ?? "");
                                return (
                                  <td key={`preview-cell-${rowIndex}-${colIndex}`} className={`border-b border-r border-slate-200 px-3 py-2 align-top ${!displayValue.trim() ? "bg-amber-50/70" : "bg-white"}`}>
                                    <div className="flex flex-col gap-1">
                                      {formula ? (
                                        <span className="inline-flex w-fit rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                                          fx
                                        </span>
                                      ) : null}
                                      <span className={`break-all font-medium ${formula ? "text-cyan-700" : "text-slate-700"} ${!displayValue.trim() ? "text-amber-700" : ""}`}>
                                        {displayValue || "空"}
                                      </span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
                  <FileSpreadsheet size={16} />
                  模板编辑器
                </div>
                <div className="overflow-x-auto overflow-y-auto rounded-[28px] border border-slate-100 bg-slate-50/70">
                  <div className="min-w-[1180px] p-1">
                    {templateLoading ? (
                      <div className="flex h-48 items-center justify-center text-sm text-slate-400">正在加载模板...</div>
                    ) : sheetOptions.length > 0 ? (
                      <Suspense fallback={<div className="flex h-[460px] items-center justify-center text-sm text-slate-400">正在加载编辑器...</div>}>
                        <ExcelWorkbookEditor
                          workbook={editorWorkbook}
                          onWorkbookChange={setEditorWorkbook}
                          selectedSheetName={selectedSheetName}
                          onSelectedSheetNameChange={(sheetName) => {
                            setSelectedSheetName(sheetName);
                            setSubmissionForm((prev) => ({ ...prev, answerSheet: sheetName }));
                          }}
                          selection={isSelectingAnswerRange ? selection : undefined}
                          onSelectionChange={isSelectingAnswerRange ? setSelection : undefined}
                          editableRange={isSelectingAnswerRange ? selection : undefined}
                          selectionEnabled={isSelectingAnswerRange}
                          focusRange={isSelectingAnswerRange ? selection : persistedFocusRange}
                          focusRequestVersion={editorFullscreenVersion}
                          requestFullscreenVersion={editorFullscreenVersion}
                          showConfirmSelectionButton={isSelectingAnswerRange}
                          confirmSelectionLabel="确认区域"
                          onConfirmSelection={confirmAnswerRange}
                          onSnapshotCaptureReady={(capture) => {
                            editorSnapshotGetterRef.current = capture;
                          }}
                          className="min-w-[1170px]"
                          viewportClassName="h-[460px] max-h-[50vh] w-full"
                        />
                      </Suspense>
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                        上传 Excel 模板后即可开始配置
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <label className="block">
                <div className="mb-2 text-sm font-bold text-slate-700">题目说明</div>
                <textarea
                  value={submissionForm.description}
                  onChange={(e) => setSubmissionForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  placeholder="说明这道题考察什么、标准答案重点是什么，以及希望管理员审核时关注的点。"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSubmissionOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmitQuestion}
                  disabled={submitQuestionMutation.isPending || !submissionForm.title.trim() || !submissionForm.templateFileUrl}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitQuestionMutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                  {submitQuestionMutation.isPending ? "提交中..." : "提交试题"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={submissionProgressOpen} onOpenChange={setSubmissionProgressOpen}>
          <DialogContent className="sm:!max-w-3xl">
            <DialogHeader>
              <DialogTitle>投稿进度</DialogTitle>
              <DialogDescription>查看你上传试题的审核状态、审核时间和处理备注。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {submissionProgressQuery.isLoading ? (
                <div className="flex h-40 items-center justify-center text-sm text-slate-400">正在加载投稿进度...</div>
              ) : submissionProgressRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  你还没有试题投稿记录
                </div>
              ) : (
                <div className="space-y-3">
                  {submissionProgressRecords.map((item) => {
                    const statusText = item.status === "approved" ? "已完成" : item.status === "rejected" ? "已驳回" : "待审核";
                    const statusClassName = item.status === "approved"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : item.status === "rejected"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-amber-50 text-amber-700 border-amber-200";
                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-base font-bold text-slate-800">{item.title}</div>
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusClassName}`}>
                                {statusText}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>{item.questionCategoryName || "未分类"}</span>
                              <span>难度 {item.difficulty || 1}</span>
                              <span>{item.points || 0} 积分</span>
                              <span>{item.answerSheet || "-"} / {item.answerRange || "-"}</span>
                            </div>
                            <div className="mt-3 text-xs text-slate-400">
                              提交于 {item.createTime ? new Date(item.createTime).toLocaleString("zh-CN") : "-"}
                              {item.reviewedTime ? ` · 审核于 ${new Date(item.reviewedTime).toLocaleString("zh-CN")}` : ""}
                            </div>
                            {item.reviewNote ? (
                              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                {item.reviewNote}
                              </div>
                            ) : null}
                          </div>
                          {item.templateFileUrl ? (
                            <a
                              href={normalizeImageUrl(item.templateFileUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              <History size={14} />
                              查看模板
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {submissionProgressTotal > 0 ? (
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="text-xs text-slate-400">共 {submissionProgressTotal} 条投稿记录</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSubmissionProgressPage((current) => Math.max(1, current - 1))}
                      disabled={submissionProgressPage <= 1}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      上一页
                    </button>
                    <span className="text-sm font-semibold text-slate-600">{submissionProgressPage} / {submissionProgressPages}</span>
                    <button
                      type="button"
                      onClick={() => setSubmissionProgressPage((current) => Math.min(submissionProgressPages, current + 1))}
                      disabled={submissionProgressPage >= submissionProgressPages}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
