import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Clock3, Download, ExternalLink, Eye, FileSpreadsheet, Sparkles, Target, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { api, downloadFile } from "../lib/api";
import { handleLoginRequiredError } from "../lib/auth-required";
import { ExcelWorkbookSnapshot, normalizeSelection, parseRangeRef } from "../lib/excel";
import { formatDuration } from "../lib/format";
import { normalizeResourceUrl } from "../lib/mappers";
import { buildExcelDesktopUri, resolveAbsoluteDownloadUrl, sanitizeWorkbookFileName } from "../lib/practice-external-workbook";
import { getPracticeDetailEditorKey, getPracticeQuestionRequirement } from "../lib/practice-campaign-ui";
import { practiceKeys } from "../lib/query-keys";
import { FastWorkbookFallbackEditor, preloadExcelWorkbookEditor } from "../components/FastWorkbookFallbackEditor";

const ExcelWorkbookEditor = lazy(() =>
  preloadExcelWorkbookEditor().then((module) => ({ default: module.ExcelWorkbookEditor }))
);

const practiceDetailHeaderClassName = "mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start";
const practiceDetailActionBarClassName = "flex flex-wrap items-center gap-2 xl:w-[720px] xl:justify-end";

type PracticeCampaignLevelState = {
  id?: number | string | null;
  title?: string | null;
  levelType?: string | null;
  difficulty?: string | number | null;
  targetTimeSeconds?: number | null;
  rewardPoints?: number | null;
};

type PracticeCampaignChapterState = {
  id?: number | string | null;
  name?: string | null;
};

type PracticeDetailLocationState = {
  campaignLevel?: PracticeCampaignLevelState;
  campaignChapter?: PracticeCampaignChapterState;
  campaignAttemptId?: number | string | null;
  backTo?: string;
};

type PracticeQuestionDetail = {
  id: number;
  title?: string | null;
  questionCategoryId?: number | null;
  categoryId?: number | null;
  requirement?: string | null;
  questionRequirement?: string | null;
  description?: string | null;
  prompt?: string | null;
  explanation?: string | null;
  answerSheet?: string | null;
  answerRange?: string | null;
  idealAnswerImageUrl?: string | null;
  templateWorkbook?: ExcelWorkbookSnapshot | null;
  difficulty?: number | string | null;
  score?: number | null;
  checkFormula?: boolean;
};

type PracticeRandomQuestionsResponse = {
  questions?: PracticeQuestionDetail[];
};

type PracticeSubmitResponse = {
  recordId?: number | string;
  firstPass?: boolean;
  rewardPoints?: number;
  score?: number;
  passed?: boolean;
  stars?: number;
  nextLevelId?: number | null;
  firstPassBonusAwarded?: number;
  totalRewardPoints?: number;
  totalExpGained?: number;
  expGained?: number;
  dailyChallenge?: unknown;
};

type PracticeWorkbookOpenLinkResponse = {
  url?: string;
};

type ExcelUploadResponse = {
  url: string;
  workbook?: ExcelWorkbookSnapshot | null;
};

export function PracticeDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isRandomMode = location.pathname.endsWith("/practice/random");
  const routeState = (location.state || {}) as PracticeDetailLocationState;
  const campaignLevel = routeState.campaignLevel;
  const campaignChapter = routeState.campaignChapter;
  const campaignAttemptId = routeState.campaignAttemptId;
  const backTo = routeState.backTo || "/practice";
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [workbook, setWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [submitting, setSubmitting] = useState(false);
  const [downloadingQuestion, setDownloadingQuestion] = useState(false);
  const [openingExternally, setOpeningExternally] = useState(false);
  const [importingWorkbook, setImportingWorkbook] = useState(false);
  const [idealAnswerImageOpen, setIdealAnswerImageOpen] = useState(false);
  const editorSnapshotGetterRef = useRef<(() => ExcelWorkbookSnapshot | null) | null>(null);
  const answerImportInputRef = useRef<HTMLInputElement | null>(null);

  const detailQuery = useQuery({
    queryKey: practiceKeys.detail(isRandomMode ? "random" : id || "unknown"),
    retry: false,
    queryFn: async () => {
      if (isRandomMode) {
        const result = await api.get<PracticeRandomQuestionsResponse>("/api/practice/questions?count=1", { silent: true });
        return result?.questions?.[0] || null;
      }
      return api.get<PracticeQuestionDetail>(`/api/practice/questions/${id}`, { silent: true });
    },
  });

  const question = detailQuery.data;
  const range = parseRangeRef(question?.answerRange || "");
  const editableRange = question?.answerSheet && range
    ? normalizeSelection(question.answerSheet, range.startRow, range.startCol, range.endRow, range.endCol)
    : null;
  const currentWorkbook = workbook.sheets.length > 0 ? workbook : (question?.templateWorkbook || { sheets: [] });
  const currentSheetName = selectedSheetName || question?.answerSheet || question?.templateWorkbook?.sheets?.[0]?.name || "";
  const editorKey = getPracticeDetailEditorKey(question?.id);
  const questionRequirement = getPracticeQuestionRequirement(question);
  const workbookFileName = sanitizeWorkbookFileName(campaignLevel?.title || question?.title);
  const idealAnswerImageUrl = normalizeResourceUrl(question?.idealAnswerImageUrl);

  useEffect(() => {
    if (!question?.templateWorkbook?.sheets?.length) return;
    setWorkbook(question.templateWorkbook);
    setSelectedSheetName(question.answerSheet || question.templateWorkbook.sheets?.[0]?.name || "");
    setElapsedSeconds(0);
  }, [question]);

  useEffect(() => {
    if (!question?.templateWorkbook?.sheets?.length) return;
    const requestIdleCallback = window.requestIdleCallback;
    const cancelIdleCallback = window.cancelIdleCallback;
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    if (requestIdleCallback && cancelIdleCallback) {
      idleId = requestIdleCallback(() => void preloadExcelWorkbookEditor(), { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(() => void preloadExcelWorkbookEditor(), 300);
    }
    return () => {
      if (idleId !== null && cancelIdleCallback) cancelIdleCallback(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [question?.id, question?.templateWorkbook?.sheets?.length]);

  useEffect(() => {
    if (!question) return;
    const timerId = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timerId);
  }, [question]);

  useEffect(() => {
    if (detailQuery.isError) {
      navigate("/practice");
    }
  }, [detailQuery.isError, navigate]);

  const handleSubmit = async () => {
    if (!question?.id) return;
    setSubmitting(true);
    try {
      const latestWorkbook = editorSnapshotGetterRef.current?.() || currentWorkbook;
      if (latestWorkbook !== workbook) {
        setWorkbook(latestWorkbook);
      }
      const result = campaignLevel?.id
        ? await api.post<PracticeSubmitResponse>(`/api/practice/campaign/levels/${campaignLevel.id}/submit`, {
            attemptId: campaignAttemptId,
            usedSeconds: elapsedSeconds,
            userAnswer: latestWorkbook,
          }, { silent: true })
        : await api.post<PracticeSubmitResponse>("/api/practice/submit", {
            questionCategoryId: question.questionCategoryId || question.categoryId || null,
            categoryId: question.questionCategoryId || question.categoryId || null,
            mode: isRandomMode ? "random_single" : "single_question",
            durationSeconds: elapsedSeconds,
            answers: [
              {
                questionId: question.id,
                userAnswer: latestWorkbook,
              },
            ],
          }, { silent: true });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: practiceKeys.history() }),
        queryClient.invalidateQueries({ queryKey: practiceKeys.leaderboard() }),
        queryClient.invalidateQueries({ queryKey: practiceKeys.questionList() }),
        campaignLevel?.id
          ? queryClient.invalidateQueries({ queryKey: practiceKeys.campaign(), refetchType: "all" })
          : Promise.resolve(),
      ]);
      if (campaignLevel?.id) {
        toast.success(buildCampaignSubmitMessage(result));
      } else {
        toast.success(result.firstPass
          ? `提交成功，获得 ${result.rewardPoints || 0} 积分`
          : `提交成功，得分 ${result.score || 0}`);
      }
      if (campaignLevel?.id) {
        navigate(`/practice/result/${result.recordId}`, {
          state: {
            campaignLevel,
            campaignChapter,
            nextLevelId: result.nextLevelId,
            passed: result.passed,
            stars: result.stars,
            firstPassBonusAwarded: result.firstPassBonusAwarded,
            totalRewardPoints: result.totalRewardPoints,
            totalExpGained: result.totalExpGained,
            dailyChallenge: result.dailyChallenge,
          },
        });
        return;
      }
      navigate(`/practice/history/${result.recordId}`);
    } catch (error) {
      if (!handleLoginRequiredError(error, "请先登录后再提交答卷")) {
        toast.error(error instanceof Error ? error.message : "提交答卷失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadQuestion = async () => {
    if (!question?.id) return;
    setDownloadingQuestion(true);
    try {
      await downloadFile(`/api/practice/questions/${question.id}/file`, workbookFileName, { silent: true });
      toast.success("题目文件已开始下载");
    } catch (error) {
      if (!handleLoginRequiredError(error, "请先登录后再下载题目")) {
        toast.error(error instanceof Error ? error.message : "题目下载失败");
      }
    } finally {
      setDownloadingQuestion(false);
    }
  };

  const handleOpenExcelDesktop = async () => {
    if (!question?.id) return;
    setOpeningExternally(true);
    try {
      const result = await api.post<PracticeWorkbookOpenLinkResponse>(
        `/api/practice/questions/${question.id}/external-open-url`,
        {},
        { silent: true }
      );
      if (!result?.url) {
        throw new Error("无法生成题目打开链接");
      }
      window.location.href = buildExcelDesktopUri(resolveAbsoluteDownloadUrl(result.url));
      toast.info("浏览器会询问是否打开 Excel 365；WPS 用户可先下载题目后打开，保存后导入答卷。");
    } catch (error) {
      if (!handleLoginRequiredError(error, "请先登录后再打开题目")) {
        toast.error(error instanceof Error ? error.message : "打开本机表格失败");
      }
    } finally {
      setOpeningExternally(false);
    }
  };

  const handleImportWorkbook = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setImportingWorkbook(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scene", "reply_attachment");
      const uploadResult = await api.post<ExcelUploadResponse>("/api/upload", formData, { silent: true });
      const snapshot = uploadResult.workbook;
      if (!snapshot?.sheets?.length) {
        throw new Error("无法识别答卷工作簿");
      }
      setWorkbook(snapshot);
      setSelectedSheetName(question?.answerSheet || snapshot.sheets[0]?.name || "");
      toast.success("答卷已导入，请确认后提交");
    } catch (error) {
      if (!handleLoginRequiredError(error, "请先登录后再导入答卷")) {
        toast.error(error instanceof Error ? error.message : "答卷导入失败");
      }
    } finally {
      setImportingWorkbook(false);
      if (answerImportInputRef.current) {
        answerImportInputRef.current.value = "";
      }
    }
  };

  if (!question) {
    return <div className="p-10 text-center text-slate-400">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef6ff_0%,#f8fafc_22%,#ffffff_100%)] pb-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className={practiceDetailHeaderClassName}>
          <div className="flex min-w-0 items-center gap-4">
            <button onClick={() => navigate(backTo, { replace: true })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:text-slate-900">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-600">
                <FileSpreadsheet size={14} />
                {campaignChapter?.name ? `${campaignChapter.name}` : "Excel 模板题"}
              </div>
              <h1 className="break-words text-2xl font-black tracking-tight text-slate-900">{campaignLevel?.title || question.title}</h1>
              {campaignLevel ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black tracking-[0.14em] text-slate-400">
                  <span className="rounded-full bg-slate-100 px-3 py-1">{campaignLevel.levelType}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{campaignLevel.difficulty}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">目标 {campaignLevel.targetTimeSeconds}s</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className={practiceDetailActionBarClassName}>
            {idealAnswerImageUrl ? (
              <button
                type="button"
                onClick={() => setIdealAnswerImageOpen(true)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700 shadow-sm transition hover:bg-amber-100"
              >
                <Eye size={16} />
                查看参考答案
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleDownloadQuestion()}
              disabled={downloadingQuestion}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={16} />
              {downloadingQuestion ? "下载中..." : "WPS/下载题目"}
            </button>
            <button
              type="button"
              onClick={() => void handleOpenExcelDesktop()}
              disabled={openingExternally}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ExternalLink size={16} />
              {openingExternally ? "打开中..." : "Excel 365 打开"}
            </button>
            <label className={`inline-flex h-12 items-center justify-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 text-sm font-black text-cyan-700 shadow-sm transition hover:bg-cyan-100 ${importingWorkbook ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              <UploadCloud size={16} />
              {importingWorkbook ? "导入中..." : "导入答卷"}
              <input
                ref={answerImportInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={importingWorkbook}
                onChange={(event) => void handleImportWorkbook(event.target.files)}
              />
            </label>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 size={16} />
              {submitting ? "提交中..." : "提交答卷"}
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
              <Sparkles size={14} />
              作答规则
            </div>
            <div className="space-y-4 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">答题工作表</div>
                <div className="mt-2 text-base font-bold text-slate-900">{question.answerSheet}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">答题区域</div>
                <div className="mt-2 text-base font-bold text-slate-900">{question.answerRange}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">难度</div>
                  <div className="mt-2 text-base font-bold text-slate-900">{question.difficulty || 1}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">奖励积分</div>
                  <div className="mt-2 text-base font-bold text-slate-900">{campaignLevel?.rewardPoints || question.score || 0}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  <Clock3 size={14} />
                  已用时
                </div>
                <div className="text-2xl font-black text-slate-900">{formatDuration(elapsedSeconds)}</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-900">
                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em]">
                  <Target size={14} />
                  判题方式
                </div>
                <div className="font-bold">{question.checkFormula ? "校验值与公式" : "仅校验最终结果"}</div>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-amber-900">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                  作答提示
                </div>
                <div className="font-bold leading-6">
                  使用函数公式进行答题时，请确保输入法切换为英文状态，避免公式输入异常。
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-cyan-200 bg-[linear-gradient(135deg,#ecfeff_0%,#f0fdf4_100%)] p-5 shadow-[0_24px_60px_-36px_rgba(6,95,70,0.45)]">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                <Target size={14} />
                题目要求
              </div>
              <div className="whitespace-pre-wrap text-lg font-black leading-8 text-slate-950">
                {questionRequirement}
              </div>
              <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-white/80 bg-white/70 px-4 py-2 text-sm font-bold text-emerald-800">
                作答区域
                <span className="text-slate-950">{question.answerSheet} / {question.answerRange}</span>
              </div>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]">
              <div className="mb-3 text-sm font-bold text-slate-600">
                请在 <span className="text-emerald-600">{question.answerSheet} / {question.answerRange}</span> 内作答，系统仅按该区域进行判题。
              </div>
              {currentWorkbook.sheets.length > 0 ? (
                <Suspense fallback={(
                  <FastWorkbookFallbackEditor
                    workbook={currentWorkbook}
                    onWorkbookChange={setWorkbook}
                    selectedSheetName={currentSheetName}
                    onSelectedSheetNameChange={setSelectedSheetName}
                    editableRange={editableRange}
                  />
                )}>
                  <ExcelWorkbookEditor
                    key={editorKey}
                    workbook={currentWorkbook}
                    onWorkbookChange={setWorkbook}
                    selectedSheetName={currentSheetName}
                    onSelectedSheetNameChange={setSelectedSheetName}
                    editableRange={editableRange}
                    onSnapshotCaptureReady={(capture) => {
                      editorSnapshotGetterRef.current = capture;
                    }}
                    preserveDynamicArraySpillChildren
                  />
                </Suspense>
              ) : (
                <div className="flex h-[640px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                  正在加载题目模板...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {idealAnswerImageOpen && idealAnswerImageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8">
          <div className="w-[min(980px,calc(100vw-2rem))] rounded-[28px] bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-900">参考答案</div>
                <div className="mt-1 text-xs font-medium text-slate-500">按图中目标效果在答题区域内用公式实现。</div>
              </div>
              <button
                type="button"
                onClick={() => setIdealAnswerImageOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
                aria-label="关闭参考答案"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <img
                src={idealAnswerImageUrl}
                alt="参考答案图片"
                className="mx-auto max-h-[68vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildCampaignSubmitMessage(result: PracticeSubmitResponse) {
  if (!result?.passed) {
    return `提交完成，得分 ${result?.score || 0}`;
  }
  const totalPoints = Number(result?.totalRewardPoints || result?.rewardPoints || 0);
  const totalExp = Number(result?.totalExpGained || result?.expGained || 0);
  const labels: string[] = [];
  if (totalPoints > 0) labels.push(`积分 +${totalPoints}`);
  if (totalExp > 0) labels.push(`经验 +${totalExp}`);
  return labels.length ? `通关成功，${labels.join("，")}` : "通关成功";
}
