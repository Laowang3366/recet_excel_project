import { Suspense, lazy, type ClipboardEvent, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";
import { AlertTriangle, CheckCircle2, Edit3, FileSpreadsheet, Image as ImageIcon, LoaderCircle, MousePointer2, Plus, RefreshCw, RotateCcw, Search, SlidersHorizontal, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { FastWorkbookFallbackEditor, preloadExcelWorkbookEditor } from "../components/FastWorkbookFallbackEditor";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import { QUESTION_BANK_SERVICE_ENDPOINTS, QUESTION_BANK_TABS, QUESTION_EDITOR_STEPS, QUESTION_PUBLISH_CHECKS, buildQuestionBankStats, getQuestionRiskIcon, getQuestionStatusMeta, type QuestionBankTabKey } from "../admin/question-bank-view-model";
import { api } from "../lib/api";
import { buildWorkbookWithAnswerSnapshot, convertWorkbookSelectionToDateFormat, detectFormulaAnswerRegion, extractDateAwareRangeAnswerSnapshot, extractRangeAnswerSnapshot, extractStoredAnswerSnapshot, findMissingFormulaCellRefs, formatAnswerPreviewCellDisplay, ExcelRangeSelection, ExcelWorkbookSnapshot, DynamicArrayHydrationRule, normalizeSelection, parseRangeRef, selectionToRangeRef } from "../lib/excel";
import { normalizeResourceUrl } from "../lib/mappers";
import { adminKeys, practiceKeys } from "../lib/query-keys";
import { resolveInitialQuestionCategoryId } from "../admin/admin-question-url-state";
import { AddButton, AdminBulkActions, AdminBulkCheckbox, AdminEmptyState, AdminPageShell, AdminPagination, formatQuestionType, answerRangeButtonClassName, primaryButtonClassName, secondaryButtonClassName, inputClassName, textareaClassName } from "../admin/shared";
import { PagedAdminResponse, QuestionCategoryRecord, PracticeCampaignLevelRecord, LevelConfigForm, QuestionGradingMode, AdminQuestionForm, AdminQuestionRecord, AdminQuestionsResponse, adminRequest, ExcelEditorErrorBoundary, showAdminSuccess, showAdminError, runAdminDelete, runAdminBulkDelete, openAdminConfirm, formatAdminEntityMessage, useAdminRole, FormDialog, Field, AdminFormSwitch, AdminTableSwitch, toNullableNumber, defaultQuestionForm, defaultDynamicArrayRule, parseDynamicArrayRulesFromJson, buildDynamicArrayRuleJson, applyQuestionDifficulty, normalizeQuestionDifficulty, resolveQuestionPointsByDifficulty, QUESTION_DIFFICULTY_POINT_OPTIONS } from "./AdminConsoleShared";

const ExcelWorkbookEditor = lazy(() =>
  preloadExcelWorkbookEditor().then((module) => ({ default: module.ExcelWorkbookEditor }))
);

type QuestionTemplateAuditRecord = {
  questionId: number;
  title?: string | null;
  enabled?: boolean | null;
  templateFileUrl?: string | null;
  answerSheet?: string | null;
  answerRange?: string | null;
  status: "passed" | "warning" | "failed" | string;
  code?: string | null;
  messages?: string[];
  ruleSummary?: Record<string, unknown> | null;
};

type QuestionTemplateAuditResponse = {
  records: QuestionTemplateAuditRecord[];
  total: number;
  passed: number;
  warning: number;
  failed: number;
};

type QuestionExceptionRecord = {
  questionId: number;
  title?: string | null;
  answerSheet?: string | null;
  answerRange?: string | null;
  severity: "critical" | "warning" | string;
  code?: string | null;
  message?: string | null;
};

type QuestionExceptionResponse = {
  records: QuestionExceptionRecord[];
  total: number;
  critical: number;
  warning: number;
};

type QuestionPublishTestRecord = {
  questionId: number;
  title?: string | null;
  passed: boolean;
  score?: number;
  totalScore?: number;
  feedback?: string | null;
  durationMs?: number;
  ruleResults?: Array<Record<string, unknown>>;
};

type QuestionPublishTestsResponse = {
  records: QuestionPublishTestRecord[];
  total: number;
  passed: number;
  failed: number;
  durationMs?: number;
};

type QuestionBatchImportResponse = {
  total: number;
  created: number;
  failed: number;
  records: AdminQuestionRecord[];
  errors: Array<{ index: number; message: string }>;
};

const emptyTemplateAuditResponse: QuestionTemplateAuditResponse = {
  records: [],
  total: 0,
  passed: 0,
  warning: 0,
  failed: 0,
};

const emptyExceptionResponse: QuestionExceptionResponse = {
  records: [],
  total: 0,
  critical: 0,
  warning: 0,
};

function getAuditStatusMeta(status: string) {
  if (status === "passed") return { label: "通过", className: "bg-[#dcfce7] text-[#16a34a]" };
  if (status === "warning") return { label: "警告", className: "bg-[#ffedd5] text-[#f97316]" };
  return { label: "失败", className: "bg-[#fee2e2] text-[#ef4444]" };
}

function getExceptionSeverityMeta(severity: string) {
  if (severity === "critical") return { label: "严重", className: "bg-[#fee2e2] text-[#ef4444]" };
  return { label: "警告", className: "bg-[#ffedd5] text-[#f97316]" };
}

function formatRuleMode(summary?: Record<string, unknown> | null) {
  const mode = String(summary?.mode || "");
  if (mode === "simple_answer") return "结果快照";
  if (mode === "cell_range") return "公式+快照";
  if (mode === "dynamic_array") return "动态数组";
  return mode || "-";
}

export function AdminQuestions() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [questionCategoryId, setQuestionCategoryId] = useState(() => resolveInitialQuestionCategoryId(location.search));
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [enabledFilter, setEnabledFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<QuestionBankTabKey>("questions");
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [batchImportText, setBatchImportText] = useState("");
  const [batchImportSubmitting, setBatchImportSubmitting] = useState(false);
  const [publishTesting, setPublishTesting] = useState(false);
  const [lastPublishTest, setLastPublishTest] = useState<QuestionPublishTestsResponse | null>(null);
  const [levelConfigOpen, setLevelConfigOpen] = useState(false);
  const [levelConfigEditing, setLevelConfigEditing] = useState<PracticeCampaignLevelRecord | null>(null);
  const [levelConfigForm, setLevelConfigForm] = useState<LevelConfigForm>({
    levelType: "normal",
    difficulty: "easy",
    targetTimeSeconds: "300",
    rewardExp: "10",
    rewardPoints: "5",
    firstPassBonus: "0",
    enabled: true,
  });
  const [open, setOpen] = useState(false);
  const [editorStep, setEditorStep] = useState(0);
  const [editing, setEditing] = useState<AdminQuestionRecord | null>(null);
  const [form, setForm] = useState<AdminQuestionForm>(defaultQuestionForm());
  const [templateWorkbook, setTemplateWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [editorWorkbook, setEditorWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [selection, setSelection] = useState<ExcelRangeSelection | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState("");
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [uploadingIdealAnswerImage, setUploadingIdealAnswerImage] = useState(false);
  const [isTemplateEditMode, setIsTemplateEditMode] = useState(true);
  const [isSelectingAnswerRange, setIsSelectingAnswerRange] = useState(false);
  const [formulaDetectionNotice, setFormulaDetectionNotice] = useState("");
  const [editorFullscreenVersion, setEditorFullscreenVersion] = useState(0);
  const editorSnapshotGetterRef = useRef<(() => ExcelWorkbookSnapshot | null) | null>(null);
  const size = 20;

  useEffect(() => {
    const nextQuestionCategoryId = resolveInitialQuestionCategoryId(location.search);
    if (nextQuestionCategoryId !== questionCategoryId) {
      setQuestionCategoryId(nextQuestionCategoryId);
      setPage(1);
    }
  }, [location.search, questionCategoryId]);

  const query = new URLSearchParams({ page: String(page), size: String(size), type: "excel_template" });
  if (questionCategoryId) query.set("questionCategoryId", questionCategoryId);
  if (keyword.trim()) query.set("keyword", keyword.trim());
  if (enabledFilter) query.set("enabled", enabledFilter);
  if (difficultyFilter) query.set("difficulty", difficultyFilter);
  const queryString = query.toString();
  const questionListQueryKey = adminKeys.questions({
    page,
    size,
    type: "excel_template",
    questionCategoryId,
    keyword,
    enabledFilter,
    difficultyFilter,
  });

  const questionsQuery = useQuery({
    queryKey: questionListQueryKey,
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<AdminQuestionsResponse>(api.get(`/api/admin/questions?${queryString}`, { silent: true }), navigate, role);
      return result || { questions: [], total: 0 };
    },
  });

  const questionCategoriesQuery = useQuery({
    queryKey: adminKeys.questionCategories(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<QuestionCategoryRecord[]>(api.get("/api/admin/question-categories", { silent: true }), navigate, role);
      return result || [];
    },
  });

  const records = questionsQuery.data?.questions || [];
  const total = questionsQuery.data?.total || 0;
  const bulkSelection = useAdminBulkSelection(records, (item) => item.id);
  const questionCategories = questionCategoriesQuery.data || [];
  const campaignLevelsQuery = useQuery({
    queryKey: adminKeys.practiceCampaignLevels(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<PagedAdminResponse<PracticeCampaignLevelRecord>>(api.get("/api/admin/practice-campaign/levels", { silent: true }), navigate, role);
      return result || { records: [] };
    },
  });
  const campaignLevels = campaignLevelsQuery.data?.records || [];

  const snapshotChecksQuery = useQuery({
    queryKey: ["admin", "questions", "template-snapshot-checks"],
    enabled: Boolean(role) && activeTab === "snapshots",
    queryFn: async () => {
      const result = await adminRequest<QuestionTemplateAuditResponse>(
        api.get(QUESTION_BANK_SERVICE_ENDPOINTS.templateSnapshotChecks, { silent: true }),
        navigate,
        role,
      );
      return result || emptyTemplateAuditResponse;
    },
  });

  const exceptionsQuery = useQuery({
    queryKey: ["admin", "questions", "exceptions"],
    enabled: Boolean(role) && activeTab === "exceptions",
    queryFn: async () => {
      const result = await adminRequest<QuestionExceptionResponse>(
        api.get(QUESTION_BANK_SERVICE_ENDPOINTS.exceptions, { silent: true }),
        navigate,
        role,
      );
      return result || emptyExceptionResponse;
    },
  });

  const resetEditorState = () => {
    setTemplateWorkbook({ sheets: [] });
    setEditorWorkbook({ sheets: [] });
    setSelectedSheetName("");
    setSelection(null);
    setTemplateLoadError("");
    setIsTemplateEditMode(true);
    setIsSelectingAnswerRange(false);
    setFormulaDetectionNotice("");
  };

  const loadTemplateWorkbook = async (
    fileUrl: string,
    answerSheet?: string | null,
    answerRange?: string | null,
    answerSnapshotJson?: string | null,
    dynamicArrayRules?: DynamicArrayHydrationRule[] | null,
    options: { hydrateAnswerSnapshot?: boolean } = {},
  ) => {
    void preloadExcelWorkbookEditor();
    setTemplateLoading(true);
    setTemplateLoadError("");
    try {
      const snapshot = await adminRequest<ExcelWorkbookSnapshot>(
        api.get(`/api/admin/questions/template-snapshot?fileUrl=${encodeURIComponent(fileUrl)}`, { silent: true }),
        navigate,
        role,
      );
      if (!snapshot?.sheets?.length) {
        setTemplateWorkbook({ sheets: [] });
        setEditorWorkbook({ sheets: [] });
        setSelectedSheetName("");
        setSelection(null);
        setTemplateLoadError("模板加载失败，请稍后重试或重新上传模板。");
        return null;
      }
      const sheetName = answerSheet || snapshot.sheets?.[0]?.name || "";
      const workbookWithAnswer = options.hydrateAnswerSnapshot === false
        ? snapshot
        : buildWorkbookWithAnswerSnapshot(snapshot, answerSheet, answerRange, answerSnapshotJson, {
          dynamicArrayRules: Array.isArray(dynamicArrayRules) ? dynamicArrayRules : [],
          preserveDynamicArraySpillChildren: true,
        });
      setTemplateWorkbook(snapshot);
      setEditorWorkbook(workbookWithAnswer);
      setSelectedSheetName(sheetName);
      const parsedRange = answerRange ? parseRangeRef(answerRange) : null;
      setSelection(parsedRange && sheetName
        ? normalizeSelection(sheetName, parsedRange.startRow, parsedRange.startCol, parsedRange.endRow, parsedRange.endCol)
        : null);
      return snapshot as ExcelWorkbookSnapshot;
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "模板解析失败";
      setTemplateWorkbook({ sheets: [] });
      setEditorWorkbook({ sheets: [] });
      setSelectedSheetName("");
      setSelection(null);
      setTemplateLoadError(`模板加载失败：${message}`);
      showAdminError(`模板加载失败：${message}`);
      return null;
    } finally {
      setTemplateLoading(false);
    }
  };

  const openCreate = () => {
    void preloadExcelWorkbookEditor();
    setEditing(null);
    setEditorStep(0);
    setForm(defaultQuestionForm());
    resetEditorState();
    setIsTemplateEditMode(true);
    setOpen(true);
  };

  const openEdit = async (item: AdminQuestionRecord) => {
    void preloadExcelWorkbookEditor();
    const dynamicArrayRules = parseDynamicArrayRulesFromJson(item.gradingRuleJson, item.answerSheet || "");
    const gradingMode = dynamicArrayRules.some((rule) => rule.anchorCell && rule.spillRange) ? "dynamic_array" : "simple";
    setFormulaDetectionNotice("");
    setEditing(item);
    setEditorStep(0);
    setForm({
      title: item.title || "",
      questionCategoryId: item.questionCategoryId || "",
      difficulty: item.difficulty ?? 1,
      points: resolveQuestionPointsByDifficulty(item.difficulty ?? 1),
      explanation: item.explanation || "",
      enabled: item.enabled ?? true,
      templateFileUrl: item.templateFileUrl || "",
      idealAnswerImageUrl: item.idealAnswerImageUrl || "",
      answerSheet: item.answerSheet || "",
      answerRange: item.answerRange || "",
      answerSnapshotJson: item.answerSnapshotJson || "",
      checkFormula: item.checkFormula ?? false,
      gradingMode,
      dynamicArrayRules,
      gradingRuleJson: item.gradingRuleJson || "",
      sheetCountLimit: item.sheetCountLimit ?? 5,
      version: item.version ?? 1,
    });
    setIsTemplateEditMode(false);
    setIsSelectingAnswerRange(false);
    setOpen(true);
    if (item.templateFileUrl) {
      await loadTemplateWorkbook(item.templateFileUrl, item.answerSheet, item.answerRange, item.answerSnapshotJson, dynamicArrayRules);
    } else {
      resetEditorState();
    }
  };

  const submit = async () => {
    const primaryDynamicRule = Array.isArray(form.dynamicArrayRules) && form.dynamicArrayRules.length > 0
      ? form.dynamicArrayRules[0]
      : defaultDynamicArrayRule();
    const isDynamicArrayMode = form.gradingMode === "dynamic_array";
    const resolvedSheetName = isDynamicArrayMode
      ? (primaryDynamicRule.sheet || selectedSheetName || selection?.sheetName || "")
      : (form.answerSheet || selection?.sheetName || selectedSheetName);
    const resolvedRange = isDynamicArrayMode
      ? (primaryDynamicRule.spillRange || selectionToRangeRef(selection) || form.answerRange)
      : (isTemplateEditMode ? (selectionToRangeRef(selection) || form.answerRange) : form.answerRange);
    if (!form.templateFileUrl) {
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
    const normalizedDynamicRules = isDynamicArrayMode
      ? (form.dynamicArrayRules || []).map((item) => ({
        ...item,
        sheet: String(item?.sheet || "").trim(),
        anchorCell: String(item?.anchorCell || "").trim().toUpperCase(),
        spillRange: String(item?.spillRange || "").trim().toUpperCase(),
        score: Math.max(1, Number(item?.score || 1)),
      }))
      : [];
    if (isDynamicArrayMode) {
      if (normalizedDynamicRules.length === 0) {
        toast.error("请至少配置一条动态数组判题规则");
        return;
      }
      if (normalizedDynamicRules.some((item) => !item.sheet || !item.anchorCell || !item.spillRange)) {
        toast.error("动态数组规则必须填写工作表、锚点单元格和溢出区域");
        return;
      }
    }
    const shouldReuseStoredAnswerSnapshot = Boolean(editing && !isTemplateEditMode && form.answerSnapshotJson);
    let resolvedAnswerSnapshotJson = form.answerSnapshotJson;
    if (!shouldReuseStoredAnswerSnapshot) {
      const capturedWorkbook = editorSnapshotGetterRef.current?.() || editorWorkbook;
      const resolvedSelection = (() => {
        const parsedRange = parseRangeRef(resolvedRange);
        if (!parsedRange || !resolvedSheetName) return null;
        return normalizeSelection(
          resolvedSheetName,
          parsedRange.startRow,
          parsedRange.startCol,
          parsedRange.endRow,
          parsedRange.endCol,
        );
      })();
      const dateNormalized = convertWorkbookSelectionToDateFormat(capturedWorkbook, resolvedSelection);
      const latestWorkbook = dateNormalized.changed > 0 ? dateNormalized.workbook : capturedWorkbook;
      if (latestWorkbook !== editorWorkbook) {
        setEditorWorkbook(latestWorkbook);
      }
      const answerSnapshot = extractRangeAnswerSnapshot(latestWorkbook, resolvedSheetName, resolvedRange);
      const hasEmptyAnswerCell = answerSnapshot.values.some((row) =>
        row.some((value) => String(value ?? "").trim().length === 0),
      );
      if (hasEmptyAnswerCell) {
        toast.error("标准答案存在空白单元格，请补全答题区域内的值");
        return;
      }
      const missingFormulaCells = !isDynamicArrayMode && Boolean(form.checkFormula)
        ? findMissingFormulaCellRefs(answerSnapshot, resolvedRange)
        : [];
      if (missingFormulaCells.length > 0) {
        const visibleCells = missingFormulaCells.slice(0, 6).join("、");
        const suffix = missingFormulaCells.length > 6 ? ` 等 ${missingFormulaCells.length} 个单元格` : "";
        toast.error(`检测函数公式已开启，${visibleCells}${suffix} 必须填写公式`);
        return;
      }
      resolvedAnswerSnapshotJson = JSON.stringify(answerSnapshot);
    }
    const resolvedDifficulty = normalizeQuestionDifficulty(form.difficulty);
    const resolvedPoints = resolveQuestionPointsByDifficulty(resolvedDifficulty);
    const payload = {
      title: form.title,
      type: "excel_template",
      questionCategoryId: toNullableNumber(form.questionCategoryId),
      difficulty: resolvedDifficulty,
      points: resolvedPoints,
      explanation: form.explanation,
      enabled: form.enabled,
      templateFileUrl: form.templateFileUrl,
      idealAnswerImageUrl: form.idealAnswerImageUrl,
      answerSheet: resolvedSheetName,
      answerRange: resolvedRange,
      answerSnapshotJson: resolvedAnswerSnapshotJson,
      checkFormula: isDynamicArrayMode ? Boolean(primaryDynamicRule.requireAnchorFormula) : Boolean(form.checkFormula),
      gradingRuleJson: isDynamicArrayMode ? buildDynamicArrayRuleJson(normalizedDynamicRules) : "",
      sheetCountLimit: Number(form.sheetCountLimit || 5),
      version: Number(form.version || 1),
    };
    const request = editing
      ? api.put<AdminQuestionRecord>(`/api/admin/questions/${editing.id}`, payload)
      : api.post<AdminQuestionRecord>("/api/admin/questions", payload);
    const result = await adminRequest(request, navigate, role, editing ? "更新题目" : "创建题目");
    if (!result) return;
    setOpen(false);
    showAdminSuccess(formatAdminEntityMessage("题目", editing?.title || result?.title || form.title, editing ? "已更新" : "已创建"));
    await queryClient.invalidateQueries({ queryKey: questionListQueryKey });
  };

  const toggleEnabled = async (item: AdminQuestionRecord, nextEnabled: boolean) => {
    const result = await adminRequest(
      api.put(`/api/admin/questions/${item.id}`, {
        title: item.title,
        type: item.type || "excel_template",
        categoryId: item.categoryId,
        questionCategoryId: item.questionCategoryId,
        difficulty: item.difficulty,
        points: item.points,
        explanation: item.explanation,
        enabled: nextEnabled,
        templateFileUrl: item.templateFileUrl,
        idealAnswerImageUrl: item.idealAnswerImageUrl,
        answerSheet: item.answerSheet,
        answerRange: item.answerRange,
        answerSnapshotJson: item.answerSnapshotJson,
        checkFormula: item.checkFormula,
        gradingRuleJson: item.gradingRuleJson,
        expectedSnapshotJson: item.expectedSnapshotJson,
        sheetCountLimit: item.sheetCountLimit,
        version: item.version,
      }),
      navigate,
      role,
      nextEnabled ? "启用题目" : "停用题目",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("题目", item.title, nextEnabled ? "已启用" : "已停用"));
    await queryClient.invalidateQueries({ queryKey: questionListQueryKey });
  };

  const remove = async (item: AdminQuestionRecord) => {
    const confirmed = await openAdminConfirm({
      title: "移入回收站",
      message: `确认将题目《${item.title}》移入文件回收站？`,
      confirmLabel: "移入回收站",
      destructive: true,
    });
    if (!confirmed) return;
    await runAdminDelete({
      request: api.delete(`/api/admin/questions/${item.id}`),
      successMessage: formatAdminEntityMessage("题目", item.title, "已移入回收站"),
      staleMessage: `题目《${item.title}》不存在，列表已刷新`,
      errorLabel: "删除题目",
      onRefresh: () => queryClient.invalidateQueries({ queryKey: questionListQueryKey }).then(() => undefined),
    });
  };

  const removeSelected = async () => {
    const items = bulkSelection.selectedItems;
    if (items.length === 0 || bulkDeleting) return;
    const confirmed = await openAdminConfirm({
      title: "批量移入回收站",
      message: `确认将选中的 ${items.length} 道题目移入文件回收站？`,
      confirmLabel: "移入回收站",
      destructive: true,
    });
    if (!confirmed) return;
    setBulkDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/questions/${item.id}`),
      entityName: "题目",
      errorLabel: "批量移入回收站",
      successLabel: "已移入回收站",
      onRefresh: () => queryClient.invalidateQueries({ queryKey: questionListQueryKey }).then(() => undefined),
      onFinally: () => {
        bulkSelection.clear();
        setBulkDeleting(false);
      },
    });
  };

  const refreshQuestionBankQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: questionListQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["admin", "questions", "template-snapshot-checks"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "questions", "exceptions"] }),
    ]);
  };

  const openBatchImportDialog = () => {
    setBatchImportText(JSON.stringify({
      records: [
        {
          title: "SUMIF 条件求和",
          questionCategoryId: "",
          difficulty: 3,
          templateFileUrl: "/uploads/questions/demo.xlsx",
          answerSheet: "练习表",
          answerRange: "B2:F20",
          answerSnapshotJson: "{}",
          checkFormula: true,
          enabled: true,
        },
      ],
    }, null, 2));
    setBatchImportOpen(true);
  };

  const submitBatchImport = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(batchImportText);
    } catch {
      toast.error("导入内容必须是 JSON 格式");
      return;
    }
    const recordsToImport = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)
        ? (parsed as { records: unknown[] }).records
        : [];
    if (recordsToImport.length === 0) {
      toast.error("导入内容必须包含 records 数组");
      return;
    }

    setBatchImportSubmitting(true);
    try {
      const result = await adminRequest<QuestionBatchImportResponse>(
        api.post(QUESTION_BANK_SERVICE_ENDPOINTS.batchImport, { records: recordsToImport }),
        navigate,
        role,
        "导入模板题",
      );
      if (!result) return;
      await refreshQuestionBankQueries();
      if (result.failed > 0) {
        const firstError = result.errors?.[0]?.message ? `，首条失败原因：${result.errors[0].message}` : "";
        toast.warning(`导入完成：成功 ${result.created} 条，失败 ${result.failed} 条${firstError}`);
        return;
      }
      showAdminSuccess(`模板题已导入 ${result.created} 条`);
      setBatchImportOpen(false);
    } finally {
      setBatchImportSubmitting(false);
    }
  };

  const runSinglePublishTest = async (item: AdminQuestionRecord) => {
    const result = await adminRequest<QuestionPublishTestRecord>(
      api.post(QUESTION_BANK_SERVICE_ENDPOINTS.publishTest(item.id)),
      navigate,
      role,
      "发布前测试",
    );
    if (!result) return;
    const summary: QuestionPublishTestsResponse = {
      records: [result],
      total: 1,
      passed: result.passed ? 1 : 0,
      failed: result.passed ? 0 : 1,
      durationMs: result.durationMs,
    };
    setLastPublishTest(summary);
    if (result.passed) {
      showAdminSuccess(formatAdminEntityMessage("题目", item.title, "发布前测试通过"));
    } else {
      showAdminError(`${item.title} 发布前测试未通过：${result.feedback || "请检查判题规则"}`);
    }
    await queryClient.invalidateQueries({ queryKey: ["admin", "questions", "exceptions"] });
  };

  const runAllPublishTests = async () => {
    setPublishTesting(true);
    try {
      const result = await adminRequest<QuestionPublishTestsResponse>(
        api.post(QUESTION_BANK_SERVICE_ENDPOINTS.publishTests, {}),
        navigate,
        role,
        "发布前批量测试",
      );
      if (!result) return;
      setLastPublishTest(result);
      if (result.failed > 0) {
        toast.warning(`批量测试完成：通过 ${result.passed} 题，失败 ${result.failed} 题`);
      } else {
        showAdminSuccess(`批量测试通过 ${result.passed} 题`);
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "questions", "exceptions"] });
    } finally {
      setPublishTesting(false);
    }
  };

  const runEditorPublishTest = async () => {
    if (!editing) {
      toast.info("请先保存题目，再执行服务端一键测试");
      return;
    }
    await runSinglePublishTest(editing);
  };

  const openLevelConfig = (item: PracticeCampaignLevelRecord) => {
    setLevelConfigEditing(item);
    setLevelConfigForm({
      levelType: item.levelType || "normal",
      difficulty: item.difficulty || "easy",
      targetTimeSeconds: String(item.targetTimeSeconds ?? 300),
      rewardExp: String(item.rewardExp ?? 10),
      rewardPoints: String(item.rewardPoints ?? 5),
      firstPassBonus: String(item.firstPassBonus ?? 0),
      enabled: item.enabled ?? true,
    });
    setLevelConfigOpen(true);
  };

  const submitLevelConfig = async () => {
    if (!levelConfigEditing?.id) return;
    const payload = {
      levelType: levelConfigForm.levelType,
      difficulty: levelConfigForm.difficulty,
      targetTimeSeconds: Number(levelConfigForm.targetTimeSeconds || 300),
      rewardExp: Number(levelConfigForm.rewardExp || 0),
      rewardPoints: Number(levelConfigForm.rewardPoints || 0),
      firstPassBonus: Number(levelConfigForm.firstPassBonus || 0),
      enabled: Boolean(levelConfigForm.enabled),
    };
    const result = await adminRequest(
      api.put(`/api/admin/practice-campaign/levels/${levelConfigEditing.id}`, payload),
      navigate,
      role,
      "更新闯关关卡",
    );
    if (!result) return;
    setLevelConfigOpen(false);
    showAdminSuccess(`关卡《${levelConfigEditing.title}》已更新`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.practiceCampaignLevels() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignOverview() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignChapters() }),
    ]);
  };

  const handleTemplateUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("仅支持上传 .xlsx 或 .xls 模板");
      return;
    }
    setUploadingTemplate(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await api.post<{ url: string }>("/api/upload", formData);
      setIsTemplateEditMode(true);
      const snapshot = await loadTemplateWorkbook(uploadResult.url);
      const detectedRegion = detectFormulaAnswerRegion(snapshot, {
        mode: form.gradingMode === "dynamic_array" ? "dynamic_array" : "simple",
      });
      if (!detectedRegion) {
        setForm({
          ...form,
          templateFileUrl: uploadResult.url,
          answerSheet: "",
          answerRange: "",
          answerSnapshotJson: "",
          dynamicArrayRules: [defaultDynamicArrayRule()],
          gradingRuleJson: "",
        });
        setFormulaDetectionNotice("未识别到含函数公式的答题区域，请在模板编辑器中手动选择。");
        toast.success("模板上传完成");
        return;
      }

      const detectedRange = form.gradingMode === "dynamic_array"
        ? detectedRegion.dynamicSpillRange
        : detectedRegion.rangeRef;
      const detectedRangeBounds = parseRangeRef(detectedRange);
      const nextDynamicRule = {
        ...defaultDynamicArrayRule(detectedRegion.sheetName),
        sheet: detectedRegion.sheetName,
        anchorCell: detectedRegion.anchorCell,
        spillRange: detectedRegion.dynamicSpillRange,
      };
      setForm({
        ...form,
        templateFileUrl: uploadResult.url,
        answerSheet: detectedRegion.sheetName,
        answerRange: detectedRange,
        answerSnapshotJson: "",
        checkFormula: true,
        dynamicArrayRules: [nextDynamicRule],
        gradingRuleJson: "",
      });
      setSelectedSheetName(detectedRegion.sheetName);
      setSelection(detectedRangeBounds
        ? normalizeSelection(
          detectedRegion.sheetName,
          detectedRangeBounds.startRow,
          detectedRangeBounds.startCol,
          detectedRangeBounds.endRow,
          detectedRangeBounds.endCol,
        )
        : null);
      setFormulaDetectionNotice(
        form.gradingMode === "dynamic_array"
          ? `已自动识别动态数组：${detectedRegion.sheetName}!${detectedRegion.dynamicSpillRange}，锚点 ${detectedRegion.anchorCell}。可继续手动修正。`
          : `已自动识别公式区域：${detectedRegion.sheetName}!${detectedRegion.rangeRef}。动态数组锚点 ${detectedRegion.anchorCell}，溢出区域 ${detectedRegion.dynamicSpillRange} 已同步到动态规则。`,
      );
      toast.success("模板上传完成，已自动识别公式区域");
    } finally {
      setUploadingTemplate(false);
    }
  };

  const removeCurrentTemplate = () => {
    if (!form.templateFileUrl) return;
    resetEditorState();
    setForm((prev) => ({
      ...prev,
      templateFileUrl: "",
      answerSheet: "",
      answerRange: "",
      answerSnapshotJson: "",
      checkFormula: false,
      gradingRuleJson: "",
      dynamicArrayRules: [defaultDynamicArrayRule()],
    }));
    setIsTemplateEditMode(true);
    toast.success("当前模板已移除，可以重新上传");
  };

  const uploadIdealAnswerImageFile = async (files: FileList | File[] | null) => {
    const file = files?.[0];
    if (!file) return;
    const supportedImage = /^image\/(png|jpe?g|webp)$/i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!supportedImage) {
      toast.error("答案照片仅支持 PNG、JPG、JPEG、WEBP 格式");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("答案照片不能超过 8MB");
      return;
    }
    setUploadingIdealAnswerImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await api.post<{ url: string }>("/api/upload", formData);
      setForm((prev) => ({ ...prev, idealAnswerImageUrl: uploadResult.url }));
      toast.success("答案照片已上传");
    } finally {
      setUploadingIdealAnswerImage(false);
    }
  };

  const removeIdealAnswerImage = () => {
    if (!form.idealAnswerImageUrl) return;
    setForm((prev) => ({ ...prev, idealAnswerImageUrl: "" }));
    toast.success("答案照片已移除");
  };

  const handleIdealAnswerImagePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const imageFile = Array.from(event.clipboardData.files || []).find((item) => item.type.startsWith("image/"));
    if (!imageFile) return;
    event.preventDefault();
    void uploadIdealAnswerImageFile([imageFile]);
  };

  const isDynamicArrayMode = form.gradingMode === "dynamic_array";
  const primaryDynamicRule = Array.isArray(form.dynamicArrayRules) && form.dynamicArrayRules.length > 0
    ? form.dynamicArrayRules[0]
    : defaultDynamicArrayRule();
  const primarySheetName = isDynamicArrayMode
    ? (primaryDynamicRule.sheet || form.answerSheet || selectedSheetName)
    : (form.answerSheet || selectedSheetName);
  const primaryRangeRef = isDynamicArrayMode
    ? primaryDynamicRule.spillRange
    : form.answerRange;
  const currentSelectionText = isTemplateEditMode
    ? (selectionToRangeRef(selection) || primaryRangeRef || "未选择")
    : (primaryRangeRef || "未选择");
  const sheetOptions = templateWorkbook.sheets || [];
  const templateEditorResetKey = `${form.templateFileUrl || "empty"}:${selectedSheetName || "none"}:${sheetOptions.length}:${templateLoadError || "ok"}`;
  const previewRangeRef = isTemplateEditMode ? (selectionToRangeRef(selection) || primaryRangeRef) : primaryRangeRef;
  const currentPreviewWorkbook = editorSnapshotGetterRef.current?.() || editorWorkbook;
  const storedAnswerPreview = !isTemplateEditMode
    ? extractStoredAnswerSnapshot(form.answerSnapshotJson, primarySheetName, previewRangeRef)
    : { values: [], formulas: [] };
  const answerPreview = storedAnswerPreview.values.length > 0
    ? storedAnswerPreview
    : extractDateAwareRangeAnswerSnapshot(
      currentPreviewWorkbook,
      primarySheetName,
      previewRangeRef,
    );
  const persistedRange = primaryRangeRef ? parseRangeRef(primaryRangeRef) : null;
  const persistedFocusRange = primarySheetName && persistedRange
    ? normalizeSelection(primarySheetName, persistedRange.startRow, persistedRange.startCol, persistedRange.endRow, persistedRange.endCol)
    : null;
  const answerPreviewText = answerPreview.values.flatMap((valueRow, rowIndex) =>
    valueRow.map((value, colIndex) => {
      const formula = answerPreview.formulas?.[rowIndex]?.[colIndex];
      const display = answerPreview.displays?.[rowIndex]?.[colIndex];
      return formatAnswerPreviewCellDisplay(value, formula, display);
    }),
  ).filter((item) => item.trim().length > 0).join(" | ");
  const answerPreviewHasEmptyCell = answerPreview.values.some((row) =>
    row.some((value) => String(value ?? "").trim().length === 0),
  );
  const missingFormulaCellRefs = !isDynamicArrayMode && Boolean(form.checkFormula)
    ? findMissingFormulaCellRefs(answerPreview, previewRangeRef)
    : [];
  const openAnswerRangeEditor = () => {
    if (!isTemplateEditMode) return;
    const sheetName = primarySheetName;
    if (!sheetName) {
      toast.error("请先选择答题工作表");
      return;
    }
    const parsedRange = primaryRangeRef ? parseRangeRef(primaryRangeRef) : null;
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
    setForm((prev) => ({
      ...prev,
      answerSheet: selection.sheetName,
      answerRange: nextRange,
      dynamicArrayRules: prev.gradingMode === "dynamic_array"
        ? (prev.dynamicArrayRules || []).map((item, index) => (index === 0
          ? { ...item, sheet: selection.sheetName, spillRange: nextRange }
          : item))
        : prev.dynamicArrayRules,
    }));
    setSelectedSheetName(selection.sheetName);
    setFormulaDetectionNotice("");
    setIsSelectingAnswerRange(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
  };
  const applyQuestionKeyword = () => {
    setKeyword(keywordDraft.trim());
    setPage(1);
  };
  const resetQuestionFilters = () => {
    setQuestionCategoryId("");
    setKeywordDraft("");
    setKeyword("");
    setEnabledFilter("");
    setDifficultyFilter("");
    setPage(1);
  };
  const hasQuestionFilters = Boolean(questionCategoryId || keyword || enabledFilter || difficultyFilter);
  const visibleQuestionCount = records.length;
  const questionBankStats = buildQuestionBankStats({
    totalQuestions: total,
    records,
    campaignLevelCount: campaignLevels.length,
    categoryCount: questionCategories.length,
  });
  const snapshotChecks = snapshotChecksQuery.data || emptyTemplateAuditResponse;
  const exceptionReport = exceptionsQuery.data || emptyExceptionResponse;
  const lastPublishRecord = lastPublishTest?.records?.[0] || null;

  return (
    <AdminPageShell
      title="题库管理"
      description="统一管理题目、模板校验、闯关关卡与发布验证流程。"
      actions={(
        <>
          <button
            type="button"
            onClick={openBatchImportDialog}
            className={secondaryButtonClassName()}
          >
            <UploadCloud size={16} />
            导入模板题
          </button>
          <AddButton onClick={openCreate}>新建题目</AddButton>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-8 border-b border-[#dbe3ef]">
          {QUESTION_BANK_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative h-12 text-[16px] font-semibold transition ${
                activeTab === tab.key ? "text-[#1769ff]" : "text-[#101828] hover:text-[#1769ff]"
              }`}
            >
              {tab.label}
              {activeTab === tab.key ? <span className="absolute inset-x-0 bottom-[-1px] h-[3px] rounded-full bg-[#1769ff]" /> : null}
            </button>
          ))}
        </div>

        {activeTab === "questions" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_405px]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {questionBankStats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="rounded-[8px] border border-[#e5eaf3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${stat.tone}`}>
                          <Icon size={25} />
                        </div>
                        <div>
                          <div className="text-[14px] font-medium text-[#344054]">{stat.label}</div>
                          <div className="mt-1 text-[28px] font-semibold leading-none text-[#101828]">{stat.value}</div>
                          <div className="mt-2 text-sm text-[#667085]">{stat.hint}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <section title="题目列表" className="rounded-[8px] border border-[#e5eaf3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#101828]">题目列表</h2>
                    <p className="mt-1 text-sm text-[#667085]">共 {total} 条，当前页 {visibleQuestionCount} 条</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={secondaryButtonClassName()}>
                      <SlidersHorizontal size={15} />
                      批量操作
                    </button>
                    <button type="button" onClick={() => void questionsQuery.refetch()} className={secondaryButtonClassName()}>
                      <RefreshCw size={15} />
                      刷新
                    </button>
                  </div>
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-[minmax(180px,1.15fr)_minmax(150px,0.9fr)_minmax(150px,0.9fr)_minmax(150px,0.9fr)_auto_auto]">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-[#344054]">关键词 / 函数名</span>
                    <input
                      value={keywordDraft}
                      onChange={(e) => setKeywordDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyQuestionKeyword();
                      }}
                      placeholder="请输入关键词或函数名"
                      className={inputClassName()}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-[#344054]">分类</span>
                    <select value={questionCategoryId} onChange={(e) => { setQuestionCategoryId(e.target.value); setPage(1); }} className={inputClassName()}>
                      <option value="">全部分类</option>
                      {questionCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-[#344054]">难度</span>
                    <select value={difficultyFilter} onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }} className={inputClassName()}>
                      <option value="">全部难度</option>
                      {QUESTION_DIFFICULTY_POINT_OPTIONS.map((item) => (
                        <option key={item.difficulty} value={item.difficulty}>难度 {item.difficulty}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-[#344054]">状态</span>
                    <select value={enabledFilter} onChange={(e) => { setEnabledFilter(e.target.value); setPage(1); }} className={inputClassName()}>
                      <option value="">全部状态</option>
                      <option value="true">已启用</option>
                      <option value="false">已停用</option>
                    </select>
                  </label>
                  <div className="flex items-end">
                    <button type="button" onClick={applyQuestionKeyword} className={primaryButtonClassName()}>
                      <Search size={15} />
                      搜索
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={resetQuestionFilters} disabled={!hasQuestionFilters && !keywordDraft} className={secondaryButtonClassName()}>
                      <RotateCcw size={15} />
                      重置
                    </button>
                  </div>
                </div>

                <AdminBulkActions
                  selectedCount={bulkSelection.selectedCount}
                  totalCount={records.length}
                  allVisibleSelected={bulkSelection.allVisibleSelected}
                  deleting={bulkDeleting}
                  onToggleAll={bulkSelection.toggleAllVisible}
                  onClear={bulkSelection.clear}
                  onDeleteSelected={() => void removeSelected()}
                />

                <div className="overflow-hidden rounded-[8px] border border-[#e6edf7]">
                  <Table>
                    <TableHeader className="bg-[#f6f8fb]">
                      <TableRow>
                        <TableHead className="w-12">
                          <AdminBulkCheckbox
                            checked={bulkSelection.allVisibleSelected}
                            onChange={bulkSelection.toggleAllVisible}
                            label="选择本页题目"
                          />
                        </TableHead>
                        <TableHead>题目</TableHead>
                        <TableHead>工作表 / 区域</TableHead>
                        <TableHead>难度 / 奖励</TableHead>
                        <TableHead>校验方式</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((item) => (
                        <TableRow key={item.id} className="hover:bg-[#f8fbff]">
                          <TableCell>
                            <AdminBulkCheckbox
                              checked={bulkSelection.isSelected(item.id)}
                              onChange={() => bulkSelection.toggleOne(item.id)}
                              label={`选择题目 ${item.title}`}
                            />
                          </TableCell>
                          <TableCell className="max-w-[360px] py-3">
                            <div className="line-clamp-1 font-semibold text-[#101828]">{item.title}</div>
                            <div className="mt-1 text-xs text-[#667085]">{item.questionCategoryName || "未分类"} · {formatQuestionType(item.type || "excel_template")}</div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="font-medium text-[#344054]">{item.answerSheet || "-"}</div>
                            <div className="mt-1 text-xs text-[#667085]">{item.answerRange || "未配置区域"}</div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="text-sm text-[#101828]">难度 {item.difficulty || 1}</div>
                            <div className="mt-1 text-xs text-[#667085]">奖励 {resolveQuestionPointsByDifficulty(item.difficulty || 1)} 分</div>
                          </TableCell>
                          <TableCell className="py-3 text-sm text-[#344054]">
                            {String(item.gradingRuleJson || "").includes("dynamicArrayRules") || item.gradingMode === "dynamic_array" ? "公式+快照" : item.checkFormula ? "公式" : "结果快照"}
                          </TableCell>
                          <TableCell className="py-3">
                            <button
                              type="button"
                              onClick={() => void toggleEnabled(item, !item.enabled)}
                              className={`inline-flex rounded-[4px] px-2.5 py-1 text-xs font-semibold transition hover:opacity-80 ${getQuestionStatusMeta(item.enabled).className}`}
                            >
                              {getQuestionStatusMeta(item.enabled).label}
                            </button>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex justify-end gap-1.5 text-sm font-semibold text-[#1769ff]">
                              <button type="button" onClick={() => void openEdit(item)} className="hover:text-[#0958d9]">编辑</button>
                              <span className="text-[#cbd5e1]">/</span>
                              <button type="button" onClick={() => navigate(`/practice/question/${item.id}`)} className="hover:text-[#0958d9]">预览</button>
                              <span className="text-[#cbd5e1]">/</span>
                              <button type="button" onClick={() => void runSinglePublishTest(item)} className="hover:text-[#0958d9]">测试</button>
                              <span className="text-[#cbd5e1]">/</span>
                              <button type="button" onClick={() => void remove(item)} className="hover:text-[#0958d9]">删除</button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {records.length === 0 && <AdminEmptyState message="暂无题目数据。" />}
                </div>
                <div className="mt-4">
                  <AdminPagination current={page} size={size} total={total} onChange={setPage} />
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <h2 className="text-[20px] font-semibold text-[#101828]">题目编辑向导</h2>
                <div className="mt-4 space-y-3">
                  {QUESTION_EDITOR_STEPS.slice(0, 4).map((step, index) => {
                    const Icon = step.icon;
                    const active = index === 3;
                    return (
                      <div key={step.key} className={`flex items-center gap-4 rounded-[8px] px-3 py-3 ${active ? "bg-[#eef4ff]" : ""}`}>
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${active ? "bg-[#1769ff] text-white" : "bg-[#1769ff] text-white"}`}>{index + 1}</div>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dceafe] text-[#1769ff]">
                          <Icon size={22} />
                        </div>
                        <div className="min-w-0">
                          <div className={`font-semibold ${active ? "text-[#1769ff]" : "text-[#101828]"}`}>{step.label}</div>
                          <div className="mt-0.5 text-sm text-[#667085]">{step.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <h2 className="text-[18px] font-semibold text-[#101828]">发布前检查</h2>
                <div className="mt-4 space-y-2.5">
                  {QUESTION_PUBLISH_CHECKS.map((item, index) => {
                    const Icon = getQuestionRiskIcon(index);
                    const warning = index === QUESTION_PUBLISH_CHECKS.length - 1;
                    return (
                      <div key={item} className="flex items-center gap-2 text-sm font-medium text-[#344054]">
                        <Icon size={17} className={warning ? "text-[#ff981a]" : "text-[#16a34a]"} />
                        <span className={warning ? "text-[#f97316]" : ""}>{item}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 rounded-[8px] border border-[#f6d26b] bg-[#fff9e6] p-4">
                  <div className="flex items-center gap-2 text-[16px] font-semibold text-[#b7791f]">
                    <AlertTriangle size={18} />
                    风险提示
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#694d16]">
                    动态数组题必须提供一键测试提交，防止发布后判题异常。建议发布前至少完成一次完整作答验证。
                  </p>
                  <button type="button" onClick={() => void runAllPublishTests()} disabled={publishTesting} className={`${primaryButtonClassName()} mt-4 w-full justify-center`}>
                    {publishTesting ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    一键测试全部启用题
                  </button>
                  {lastPublishTest ? (
                    <div className="mt-3 rounded-[8px] bg-white/70 px-3 py-2 text-sm text-[#694d16]">
                      近次结果：通过 {lastPublishTest.passed} 题，失败 {lastPublishTest.failed} 题
                    </div>
                  ) : null}
                </div>
              </section>
            </aside>
          </div>
        ) : null}

        {activeTab === "campaign" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold text-[#101828]">闯关配置</h2>
                  <p className="mt-1 text-sm text-[#667085]">{campaignLevels.length} 个关卡配置，可编辑排序、奖励与启停状态。</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-[8px] border border-[#e6edf7]">
                <Table>
                  <TableHeader className="bg-[#f6f8fb]">
                    <TableRow>
                      <TableHead>关卡名称</TableHead>
                      <TableHead>所属章节</TableHead>
                      <TableHead>关联题目</TableHead>
                      <TableHead>奖励</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignLevels.map((item) => (
                      <TableRow key={`campaign-level-${item.id}`}>
                        <TableCell>
                          <div className="font-semibold text-[#101828]">{item.title}</div>
                          <div className="mt-1 text-xs text-[#667085]">{item.levelType || "normal"} · {item.difficulty || "easy"}</div>
                        </TableCell>
                        <TableCell>{item.chapterName || "-"}</TableCell>
                        <TableCell>{item.questionTitle || "-"}</TableCell>
                        <TableCell>
                          <div>经验 {item.rewardExp || 0}</div>
                          <div className="mt-1 text-xs text-[#667085]">积分 {item.rewardPoints || 0} · 首通 {item.firstPassBonus || 0}</div>
                        </TableCell>
                        <TableCell>
                          <AdminTableSwitch
                            checked={Boolean(item.enabled)}
                            onCheckedChange={(next) => {
                              openLevelConfig({ ...item, enabled: next });
                              setLevelConfigForm((prev) => ({ ...prev, enabled: next }));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <button type="button" onClick={() => openLevelConfig(item)} className={secondaryButtonClassName()}>
                              <Edit3 size={14} />
                              编辑
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {campaignLevels.length === 0 && <AdminEmptyState message="暂无闯关关卡数据。" />}
              </div>
            </section>
            <aside className="space-y-4">
              <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <h2 className="text-[18px] font-semibold text-[#101828]">闯关关卡统计</h2>
                <div className="mt-4 space-y-4">
                  {[
                    ["关卡总数", campaignLevels.length],
                    ["已启用关卡", campaignLevels.filter((item) => item.enabled).length],
                    ["待启用关卡", campaignLevels.filter((item) => !item.enabled).length],
                    ["总目标分数", 12580],
                    ["总奖励积分", campaignLevels.reduce((sum, item) => sum + Number(item.rewardPoints || 0), 0)],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between rounded-[8px] bg-[#f8fbff] px-3 py-2">
                      <span className="text-sm text-[#667085]">{label}</span>
                      <span className="text-lg font-semibold text-[#101828]">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-[8px] border border-[#f6d26b] bg-[#fff9e6] p-5">
                <h2 className="text-[18px] font-semibold text-[#b7791f]">注意事项</h2>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[#694d16]">
                  <li>关卡排序决定前台闯关路径顺序。</li>
                  <li>禁用的关卡不会在前台显示。</li>
                  <li>修改关卡配置会实时生效。</li>
                </ul>
              </section>
            </aside>
          </div>
        ) : null}

        {activeTab === "snapshots" ? (
          <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[20px] font-semibold text-[#101828]">模板快照检查</h2>
                <p className="mt-1 text-sm text-[#667085]">服务端读取题目模板、标准答案快照和判题规则，生成发布前审计结果。</p>
              </div>
              <button type="button" onClick={() => void snapshotChecksQuery.refetch()} className={secondaryButtonClassName()}>
                <RefreshCw size={15} />
                刷新检查
              </button>
            </div>
            <div className="mb-5 grid gap-3 md:grid-cols-4">
              {[
                ["检查总数", snapshotChecks.total],
                ["通过", snapshotChecks.passed],
                ["警告", snapshotChecks.warning],
                ["失败", snapshotChecks.failed],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-[8px] border border-[#e5eaf3] bg-[#f8fbff] px-4 py-3">
                  <div className="text-sm text-[#667085]">{label}</div>
                  <div className="mt-1 text-[24px] font-semibold text-[#101828]">{value}</div>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-[8px] border border-[#e6edf7]">
              <Table>
                <TableHeader className="bg-[#f6f8fb]">
                  <TableRow>
                    <TableHead>题目</TableHead>
                    <TableHead>模板 / 区域</TableHead>
                    <TableHead>规则</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>检查结果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshotChecks.records.map((item) => {
                    const statusMeta = getAuditStatusMeta(item.status);
                    return (
                      <TableRow key={`snapshot-check-${item.questionId}`}>
                        <TableCell>
                          <div className="font-semibold text-[#101828]">{item.title || "-"}</div>
                          <div className="mt-1 text-xs text-[#667085]">ID {item.questionId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-[#344054]">{item.answerSheet || "-"}</div>
                          <div className="mt-1 text-xs text-[#667085]">{item.answerRange || item.templateFileUrl || "-"}</div>
                        </TableCell>
                        <TableCell>{formatRuleMode(item.ruleSummary)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-[4px] px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
                        </TableCell>
                        <TableCell className="max-w-[420px] text-sm text-[#475467]">
                          {item.messages?.length ? item.messages.join("；") : "模板、快照与规则均可用"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {snapshotChecksQuery.isLoading ? <AdminEmptyState message="正在检查模板快照..." /> : snapshotChecks.records.length === 0 && <AdminEmptyState message="暂无快照检查数据。" />}
            </div>
          </section>
        ) : null}

        {activeTab === "exceptions" ? (
          <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[20px] font-semibold text-[#101828]">异常题目</h2>
                <p className="mt-1 text-sm text-[#667085]">服务端按模板、标准快照、判题规则和启用状态自动聚合异常。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void runAllPublishTests()} disabled={publishTesting} className={primaryButtonClassName()}>
                  {publishTesting ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  批量测试
                </button>
                <button type="button" onClick={() => void exceptionsQuery.refetch()} className={secondaryButtonClassName()}>
                  <RefreshCw size={15} />
                  刷新异常
                </button>
              </div>
            </div>
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              {[
                ["异常总数", exceptionReport.total],
                ["严重", exceptionReport.critical],
                ["警告", exceptionReport.warning],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-[8px] border border-[#e5eaf3] bg-[#f8fbff] px-4 py-3">
                  <div className="text-sm text-[#667085]">{label}</div>
                  <div className="mt-1 text-[24px] font-semibold text-[#101828]">{value}</div>
                </div>
              ))}
            </div>
            {lastPublishTest ? (
              <div className="mb-5 rounded-[8px] border border-[#dbeafe] bg-[#f8fbff] px-4 py-3 text-sm text-[#344054]">
                最近批量测试：通过 {lastPublishTest.passed} 题，失败 {lastPublishTest.failed} 题，耗时 {lastPublishTest.durationMs ?? 0}ms
              </div>
            ) : null}
            <div className="overflow-hidden rounded-[8px] border border-[#e6edf7]">
              <Table>
                <TableHeader className="bg-[#f6f8fb]">
                  <TableRow>
                    <TableHead>题目</TableHead>
                    <TableHead>区域</TableHead>
                    <TableHead>级别</TableHead>
                    <TableHead>异常规则</TableHead>
                    <TableHead>说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptionReport.records.map((item, index) => {
                    const severityMeta = getExceptionSeverityMeta(item.severity);
                    return (
                      <TableRow key={`question-exception-${item.questionId}-${item.code || index}`}>
                        <TableCell>
                          <div className="font-semibold text-[#101828]">{item.title || "-"}</div>
                          <div className="mt-1 text-xs text-[#667085]">ID {item.questionId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-[#344054]">{item.answerSheet || "-"}</div>
                          <div className="mt-1 text-xs text-[#667085]">{item.answerRange || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-[4px] px-2.5 py-1 text-xs font-semibold ${severityMeta.className}`}>{severityMeta.label}</span>
                        </TableCell>
                        <TableCell>{item.code || "-"}</TableCell>
                        <TableCell className="max-w-[420px] text-sm text-[#475467]">{item.message || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {exceptionsQuery.isLoading ? <AdminEmptyState message="正在聚合异常题目..." /> : exceptionReport.records.length === 0 && <AdminEmptyState message="暂无异常题目。" />}
            </div>
          </section>
        ) : null}
      </div>

      <FormDialog
        open={batchImportOpen}
        onOpenChange={setBatchImportOpen}
        title="导入模板题"
        description="粘贴模板题 JSON，系统会逐条复用新建题目的模板校验、快照生成与判题规则标准化流程。"
        submitLabel={batchImportSubmitting ? "导入中..." : "开始导入"}
        contentClassName="w-[min(920px,calc(100vw-2rem))]"
        onSubmit={submitBatchImport}
      >
        <div className="space-y-4">
          <Field label="导入 JSON">
            <textarea
              value={batchImportText}
              onChange={(event) => setBatchImportText(event.target.value)}
              className={`${textareaClassName()} min-h-[360px] font-mono text-xs leading-5`}
              placeholder='{"records":[{"title":"SUMIF 条件求和","questionCategoryId":1,"difficulty":3,"templateFileUrl":"/uploads/demo.xlsx","answerSheet":"练习表","answerRange":"B2:F20","answerSnapshotJson":"{}","checkFormula":true}]}'
            />
          </Field>
          <div className="rounded-[8px] border border-[#dbeafe] bg-[#f8fbff] px-4 py-3 text-sm leading-6 text-[#344054]">
            支持直接粘贴 records 数组或完整对象。成功导入后会刷新题目列表、模板快照检查和异常题目统计；失败行会保留弹窗，便于修正后重试。
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "编辑题目" : "新建题目"}
        description="按基本信息、上传模板、答题与判题、预览发布完成配置。"
        submitLabel={editing ? "保存配置" : "创建题目"}
        contentClassName="w-[min(1280px,calc(100vw-2rem))]"
        bodyClassName="px-6 py-5 bg-white"
        onSubmit={submit}
      >
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-[#e5eaf3] pb-5">
          {QUESTION_EDITOR_STEPS.map((step, index) => {
            const completed = Boolean(editing) || index < editorStep;
            const active = index === editorStep;
            return (
              <button key={step.key} type="button" onClick={() => setEditorStep(index)} className="flex min-w-[150px] items-center gap-3 text-left">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                  active || completed ? "border-[#1769ff] bg-[#1769ff] text-white" : "border-[#c7d2e4] bg-white text-[#667085]"
                }`}>
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${active || completed ? "text-[#1769ff]" : "text-[#667085]"}`}>{step.label}</div>
                </div>
                {index < QUESTION_EDITOR_STEPS.length - 1 ? <div className="hidden h-px w-16 bg-[#d8e0ec] xl:block" /> : null}
              </button>
            );
          })}
        </div>

        {editorStep === 0 ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)]">
            <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-5">
              <h3 className="mb-4 text-[20px] font-semibold text-[#101828]">基本信息</h3>
              <div className="space-y-4">
                <Field label="题目标题">
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    className={inputClassName()}
                    placeholder="例如 SUMIF 条件求和"
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="所属分类">
                    <select value={String(form.questionCategoryId)} onChange={(event) => setForm((prev) => ({ ...prev, questionCategoryId: event.target.value }))} className={inputClassName()}>
                      <option value="">请选择</option>
                      {questionCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="难度">
                    <select
                      value={String(normalizeQuestionDifficulty(form.difficulty))}
                      onChange={(event) => setForm((prev) => applyQuestionDifficulty(prev, event.target.value))}
                      className={inputClassName()}
                    >
                      {QUESTION_DIFFICULTY_POINT_OPTIONS.map((item) => (
                        <option key={item.difficulty} value={item.difficulty}>
                          难度 {item.difficulty} · {item.points} 积分
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="奖励积分">
                    <input
                      type="number"
                      value={resolveQuestionPointsByDifficulty(form.difficulty)}
                      readOnly
                      className={`${inputClassName()} bg-slate-50 text-slate-500`}
                    />
                  </Field>
                </div>
                <Field label="题目说明">
                  <textarea
                    value={form.explanation}
                    onChange={(event) => setForm((prev) => ({ ...prev, explanation: event.target.value }))}
                    className={textareaClassName()}
                    placeholder="请输入题目要求，避免泄露标准答案。"
                  />
                </Field>
                <AdminFormSwitch
                  label="启用（发布后学员可见）"
                  checked={Boolean(form.enabled)}
                  onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
                />
              </div>
            </section>

            <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-5">
              <h3 className="mb-4 text-[20px] font-semibold text-[#101828]">前台练习展示预览</h3>
              <div className="rounded-[8px] border border-[#dfe7f2] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-1 text-[22px] font-semibold text-[#101828]">{form.title || "SUMIF 条件求和"}</div>
                    <div className="mt-2 inline-flex rounded-[4px] bg-[#dcfce7] px-2 py-1 text-xs font-semibold text-[#16a34a]">基础</div>
                  </div>
                  <div className="text-sm font-semibold text-[#16a34a]">奖励积分：{resolveQuestionPointsByDifficulty(form.difficulty)} 分</div>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#344054]">
                  {form.explanation || "在“练习表”中，使用函数统计各地区的销售额总和，并在右侧表格中填写结果。"}
                </p>
                <div className="mt-4 rounded-[8px] border border-[#e5eaf3] bg-[#fbfdff] p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="overflow-hidden rounded-[4px] border border-[#d8e0ec] bg-white text-center text-xs">
                      <div className="bg-[#f3f6fb] py-2 font-semibold">练习表</div>
                      {["地区", "华东", "华南", "华北", "..."].map((item) => (
                        <div key={item} className="grid grid-cols-3 border-t border-[#edf1f7]">
                          <span className="px-2 py-2">{item}</span>
                          <span className="border-l border-[#edf1f7] px-2 py-2">产品</span>
                          <span className="border-l border-[#edf1f7] px-2 py-2">销售额</span>
                        </div>
                      ))}
                    </div>
                    <div className="overflow-hidden rounded-[4px] border border-[#d8e0ec] bg-white text-center text-xs">
                      <div className="bg-[#f3f6fb] py-2 font-semibold">结果填写区</div>
                      {["华东", "华南", "华北", "西南"].map((item, index) => (
                        <div key={item} className="grid grid-cols-2 border-t border-[#edf1f7]">
                          <span className={`px-2 py-2 ${index === 0 ? "border border-[#16a34a]" : ""}`}>{item}</span>
                          <span className="border-l border-[#edf1f7] px-2 py-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-[#667085]">请在结果填写区使用函数进行计算。</p>
              </div>
            </section>
          </div>
        ) : null}

        {editorStep === 1 ? (
          <section className="space-y-4">
            <div className="rounded-[8px] border border-[#e5eaf3] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900">Excel 模板</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{form.templateFileUrl || "尚未上传模板文件"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {editing ? (
                    <button
                      type="button"
                      onClick={() => setIsTemplateEditMode((current) => !current)}
                      className={secondaryButtonClassName()}
                    >
                      <Edit3 size={14} />
                      {isTemplateEditMode ? "完成修改" : "修改模板"}
                    </button>
                  ) : null}
                  {form.templateFileUrl ? (
                    <button
                      type="button"
                      onClick={() => void removeCurrentTemplate()}
                      disabled={!isTemplateEditMode}
                      className={`${secondaryButtonClassName()} ${!isTemplateEditMode ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <X size={14} />
                      移除模板
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={openAnswerRangeEditor}
                    disabled={!isTemplateEditMode || !form.templateFileUrl}
                    className={`${secondaryButtonClassName()} ${!isTemplateEditMode || !form.templateFileUrl ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <MousePointer2 size={14} />
                    框选区域
                  </button>
                  <label className={`${primaryButtonClassName()} cursor-pointer ${!isTemplateEditMode ? "opacity-50 pointer-events-none" : ""}`}>
                    {uploadingTemplate ? <LoaderCircle size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                    上传模板
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      disabled={!isTemplateEditMode}
                      onChange={(event) => {
                        void handleTemplateUpload(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-[8px] border border-[#e5eaf3] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <ImageIcon size={16} />
                    理想答案参考图
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    可选。上传后，前台答题页会显示“查看参考答案”按钮。
                  </p>
                  <div className="mt-2 truncate text-xs text-slate-500">{form.idealAnswerImageUrl || "尚未上传答案照片"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {form.idealAnswerImageUrl ? (
                    <button type="button" onClick={removeIdealAnswerImage} className={secondaryButtonClassName()}>
                      <X size={14} />
                      移除
                    </button>
                  ) : null}
                  <label className={`${primaryButtonClassName()} cursor-pointer`}>
                    {uploadingIdealAnswerImage ? <LoaderCircle size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                    上传答案照片
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploadingIdealAnswerImage}
                      onChange={(event) => {
                        void uploadIdealAnswerImageFile(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
              <div
                tabIndex={0}
                onPaste={handleIdealAnswerImagePaste}
                className="mt-4 flex min-h-[150px] items-center justify-center rounded-[8px] border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400 outline-none transition focus:border-[#1769ff] focus:bg-[#f8fbff]"
              >
                {form.idealAnswerImageUrl ? (
                  <img
                    src={normalizeResourceUrl(form.idealAnswerImageUrl)}
                    alt="理想答案参考图"
                    className="max-h-[260px] max-w-full rounded-[6px] border border-slate-200 bg-white object-contain"
                  />
                ) : (
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-500">使用上方按钮上传，或 Ctrl+V 粘贴答案截图</div>
                    <div className="text-xs text-slate-400">支持 PNG、JPG、JPEG、WEBP，单张不超过 8MB</div>
                  </div>
                )}
              </div>
            </div>

            {formulaDetectionNotice ? (
              <div className="rounded-[8px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
                {formulaDetectionNotice}
              </div>
            ) : null}
            {templateLoadError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                <span>{templateLoadError}</span>
                {form.templateFileUrl ? (
                  <button
                    type="button"
                    onClick={() => void loadTemplateWorkbook(form.templateFileUrl, form.answerSheet, form.answerRange, form.answerSnapshotJson, form.dynamicArrayRules)}
                    className="inline-flex h-8 items-center justify-center rounded-[2px] border border-amber-300 bg-white px-3 text-xs font-bold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
                  >
                    重新加载
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-[8px] border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
                <FileSpreadsheet size={16} />
                模板编辑器
              </div>
              {templateLoading ? (
                <div className="flex h-48 items-center justify-center text-sm text-slate-400">正在加载模板...</div>
              ) : templateLoadError ? (
                <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-amber-200 bg-amber-50 px-5 text-center text-sm text-amber-800">
                  <div>{templateLoadError}</div>
                  {form.templateFileUrl ? (
                    <button
                      type="button"
                      onClick={() => void loadTemplateWorkbook(form.templateFileUrl, form.answerSheet, form.answerRange, form.answerSnapshotJson, form.dynamicArrayRules)}
                      className={secondaryButtonClassName()}
                    >
                      重新加载模板
                    </button>
                  ) : null}
                </div>
              ) : sheetOptions.length > 0 ? (
                <ExcelEditorErrorBoundary
                  resetKey={templateEditorResetKey}
                  fallback={(
                    <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-rose-200 bg-rose-50 px-5 text-center text-sm text-rose-700">
                      <div>模板编辑器加载失败，请重新加载模板后再修改答案。</div>
                      <button
                        type="button"
                        onClick={() => void loadTemplateWorkbook(form.templateFileUrl, form.answerSheet, form.answerRange, form.answerSnapshotJson, form.dynamicArrayRules)}
                        className={secondaryButtonClassName()}
                      >
                        重新加载模板
                      </button>
                    </div>
                  )}
                >
                  <Suspense fallback={(
                    <FastWorkbookFallbackEditor
                      workbook={editorWorkbook}
                      onWorkbookChange={isTemplateEditMode ? setEditorWorkbook : () => undefined}
                      selectedSheetName={selectedSheetName}
                      onSelectedSheetNameChange={setSelectedSheetName}
                      editableRange={isTemplateEditMode && isSelectingAnswerRange ? selection : undefined}
                      readOnly={!isTemplateEditMode}
                      viewportClassName="h-[460px]"
                    />
                  )}>
                    <ExcelWorkbookEditor
                      workbook={editorWorkbook}
                      onWorkbookChange={isTemplateEditMode ? setEditorWorkbook : undefined}
                      selectedSheetName={selectedSheetName}
                      onSelectedSheetNameChange={(sheetName) => {
                        setSelectedSheetName(sheetName);
                        if (isTemplateEditMode) {
                          setForm((prev) => ({ ...prev, answerSheet: sheetName }));
                        }
                      }}
                      selection={isTemplateEditMode && isSelectingAnswerRange ? selection : undefined}
                      onSelectionChange={isTemplateEditMode && isSelectingAnswerRange ? ((nextSelection) => {
                        setSelection(nextSelection);
                      }) : undefined}
                      editableRange={isTemplateEditMode && isSelectingAnswerRange ? selection : undefined}
                      selectionEnabled={isTemplateEditMode && isSelectingAnswerRange}
                      focusRange={isSelectingAnswerRange ? selection : persistedFocusRange}
                      focusRequestVersion={editorFullscreenVersion}
                      requestFullscreenVersion={editorFullscreenVersion}
                      showConfirmSelectionButton={isSelectingAnswerRange}
                      confirmSelectionLabel="确认区域"
                      onConfirmSelection={confirmAnswerRange}
                      onSnapshotCaptureReady={(capture) => {
                        editorSnapshotGetterRef.current = capture;
                      }}
                      preserveDynamicArraySpillChildren
                    />
                  </Suspense>
                </ExcelEditorErrorBoundary>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-[8px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                  上传 Excel 模板后即可开始配置
                </div>
              )}
            </div>
          </section>
        ) : null}

        {editorStep === 2 ? (
          <section className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
              <div className="rounded-[8px] border border-[#e5eaf3] bg-white p-5">
                <h3 className="text-[18px] font-semibold text-[#101828]">工作表预览</h3>
                <div className="mt-4 overflow-hidden rounded-[8px] border border-[#d8e0ec] bg-white text-center text-xs">
                  <div className="grid grid-cols-6 bg-[#f3f6fb] font-semibold">
                    {["", "A", "B", "C", "D", "E"].map((item) => <div key={`answer-head-${item}`} className="border-r border-b border-[#d8e0ec] px-2 py-2">{item}</div>)}
                  </div>
                  {["销售数据分析表", "日期", "2024-01-01", "2024-01-02", "2024-01-03", "合计", "平均值", "最大值", "最小值"].map((row, rowIndex) => (
                    <div key={`answer-row-${row}`} className="grid grid-cols-6">
                      <div className="border-r border-b border-[#d8e0ec] bg-[#f8fafc] px-2 py-2 font-semibold">{rowIndex + 1}</div>
                      {Array.from({ length: 5 }).map((_, colIndex) => (
                        <div key={`answer-cell-${rowIndex}-${colIndex}`} className={`border-r border-b border-[#d8e0ec] px-2 py-2 ${
                          rowIndex >= 1 && rowIndex <= 7 && colIndex >= 1 ? "bg-[#eaf2ff]" : ""
                        } ${rowIndex >= 5 && colIndex === 1 ? "ring-1 ring-[#16a34a]" : ""}`}>
                          {colIndex === 0 ? row : colIndex === 1 ? "产品A" : colIndex === 2 ? "120" : colIndex === 4 ? "¥6,000" : ""}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#475467]">
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 border border-[#1769ff] bg-[#eaf2ff]" />答题区域 ({form.answerRange || "待选择"})</span>
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 border border-[#16a34a]" />标准答案区域 ({previewRangeRef || "待生成"})</span>
                </div>
              </div>

              <div className="rounded-[8px] border border-[#e5eaf3] bg-white p-5">
                <h3 className="text-[18px] font-semibold text-[#101828]">区域与判题配置</h3>
                <div className="mt-4 space-y-4">
                  <Field label="答题工作表">
                    {sheetOptions.length > 0 ? (
                      <select
                        value={primarySheetName}
                        onChange={(event) => {
                          const nextSheetName = event.target.value;
                          setSelectedSheetName(nextSheetName);
                          setForm((prev) => ({
                            ...prev,
                            answerSheet: nextSheetName,
                            dynamicArrayRules: prev.gradingMode === "dynamic_array"
                              ? (prev.dynamicArrayRules || []).map((item, index) => (index === 0 ? { ...item, sheet: nextSheetName } : item))
                              : prev.dynamicArrayRules,
                          }));
                        }}
                        className={inputClassName()}
                      >
                        <option value="">请选择</option>
                        {sheetOptions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                      </select>
                    ) : (
                      <input value={form.answerSheet || selectedSheetName} onChange={(event) => setForm((prev) => ({ ...prev, answerSheet: event.target.value }))} className={inputClassName()} placeholder="练习表" />
                    )}
                  </Field>
                  <Field label="答题区域">
                    <div className="flex gap-2">
                      <input value={form.answerRange || currentSelectionText} onChange={(event) => setForm((prev) => ({ ...prev, answerRange: event.target.value.toUpperCase() }))} className={inputClassName()} placeholder="B2:F20" />
                      <button
                        type="button"
                        onClick={() => {
                          setEditorStep(1);
                          openAnswerRangeEditor();
                        }}
                        disabled={!form.templateFileUrl}
                        className={`${answerRangeButtonClassName()} ${!form.templateFileUrl ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <MousePointer2 size={14} />
                        打开框选
                      </button>
                    </div>
                  </Field>
                  <Field label="标准答案区域">
                    <input value={previewRangeRef || ""} readOnly className={`${inputClassName()} bg-slate-50 text-slate-500`} placeholder="选择答题区域后生成" />
                  </Field>
                  <div className="space-y-2 text-sm text-[#344054]">
                    <div className="font-semibold">判题方式</div>
                    <div className="flex flex-wrap gap-4">
                      <label className="inline-flex items-center gap-2"><input type="radio" checked={Boolean(form.checkFormula) && !isDynamicArrayMode} onChange={() => setForm((prev) => ({ ...prev, gradingMode: "simple", checkFormula: true }))} />公式校验</label>
                      <label className="inline-flex items-center gap-2"><input type="radio" checked={!form.checkFormula && !isDynamicArrayMode} onChange={() => setForm((prev) => ({ ...prev, gradingMode: "simple", checkFormula: false }))} />结果快照</label>
                      <label className="inline-flex items-center gap-2"><input type="radio" checked={isDynamicArrayMode} onChange={() => setForm((prev) => ({ ...prev, gradingMode: "dynamic_array" }))} />公式+快照</label>
                    </div>
                  </div>
                  {answerPreviewHasEmptyCell ? <div className="rounded-[8px] bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">答题区域中存在空白单元格，保存前请补全标准答案。</div> : null}
                  {missingFormulaCellRefs.length > 0 ? (
                    <div className="rounded-[8px] bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                      检测函数公式已开启，{missingFormulaCellRefs.slice(0, 6).join("、")}{missingFormulaCellRefs.length > 6 ? ` 等 ${missingFormulaCellRefs.length} 个单元格` : ""} 不是公式。
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[8px] border border-[#e5eaf3] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[18px] font-semibold text-[#101828]">判题规则</h3>
                  {isDynamicArrayMode ? (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        dynamicArrayRules: [...(prev.dynamicArrayRules || []), defaultDynamicArrayRule(primarySheetName)],
                      }))}
                      className={secondaryButtonClassName()}
                    >
                      <Plus size={14} />
                      新增规则
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 space-y-3 text-sm text-[#344054]">
                  <div className="rounded-[8px] bg-[#f8fbff] p-3">当前模式：{isDynamicArrayMode ? "动态数组判题" : form.checkFormula ? "公式校验" : "结果快照"}</div>
                  <div className="rounded-[8px] bg-[#f8fbff] p-3">答题区域：{form.answerRange || "待选择"}</div>
                  {isDynamicArrayMode ? (
                    <div className="space-y-3">
                      {(form.dynamicArrayRules || []).map((rule, index) => (
                        <div key={`dynamic-rule-${index}`} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-sm font-black text-slate-800">规则 {index + 1}</div>
                            <button
                              type="button"
                              onClick={() => setForm((prev) => {
                                const nextRules = (prev.dynamicArrayRules || []).filter((_, ruleIndex) => ruleIndex !== index);
                                return { ...prev, dynamicArrayRules: nextRules.length > 0 ? nextRules : [defaultDynamicArrayRule(primarySheetName)] };
                              })}
                              className={secondaryButtonClassName()}
                              disabled={(form.dynamicArrayRules || []).length <= 1}
                            >
                              <Trash2 size={14} />
                              删除
                            </button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <Field label="锚点单元格">
                              <input
                                value={rule.anchorCell}
                                onChange={(event) => setForm((prev) => ({
                                  ...prev,
                                  dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index ? { ...item, anchorCell: event.target.value.toUpperCase() } : item)),
                                }))}
                                className={inputClassName()}
                                placeholder="例如 F2"
                              />
                            </Field>
                            <Field label="溢出区域">
                              <input
                                value={rule.spillRange}
                                onChange={(event) => setForm((prev) => ({
                                  ...prev,
                                  dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index ? { ...item, spillRange: event.target.value.toUpperCase() } : item)),
                                }))}
                                className={inputClassName()}
                                placeholder="例如 F2:G6"
                              />
                            </Field>
                            <Field label="分值">
                              <input
                                type="number"
                                min="1"
                                value={rule.score}
                                onChange={(event) => setForm((prev) => ({
                                  ...prev,
                                  dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index ? { ...item, score: event.target.value } : item)),
                                }))}
                                className={inputClassName()}
                              />
                            </Field>
                          </div>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Field label="规则名称">
                              <input
                                value={rule.label}
                                onChange={(event) => setForm((prev) => ({
                                  ...prev,
                                  dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index ? { ...item, label: event.target.value } : item)),
                                }))}
                                className={inputClassName()}
                                placeholder="例如 按条件筛选结果"
                              />
                            </Field>
                            <Field label="公式关键字">
                              <input
                                value={rule.formulaKeywordsText}
                                onChange={(event) => setForm((prev) => ({
                                  ...prev,
                                  dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index ? { ...item, formulaKeywordsText: event.target.value } : item)),
                                }))}
                                className={inputClassName()}
                                placeholder="例如 FILTER, SORT"
                              />
                            </Field>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <AdminFormSwitch
                              label="首格必须包含公式"
                              checked={Boolean(rule.requireAnchorFormula)}
                              onCheckedChange={(next) => setForm((prev) => ({
                                ...prev,
                                dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index ? { ...item, requireAnchorFormula: next } : item)),
                              }))}
                            />
                            <AdminFormSwitch
                              label="溢出子单元格不允许手填公式"
                              checked={Boolean(rule.requireSpillCellsWithoutFormula)}
                              onCheckedChange={(next) => setForm((prev) => ({
                                ...prev,
                                dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index ? { ...item, requireSpillCellsWithoutFormula: next } : item)),
                              }))}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[8px] bg-[#f8fbff] p-3">公式校验：{form.checkFormula ? "启用" : "关闭"}</div>
                  )}
                </div>
              </div>
              <div className="rounded-[8px] border border-[#e5eaf3] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[18px] font-semibold text-[#101828]">测试结果</h3>
                  <button type="button" onClick={() => void runEditorPublishTest()} className={primaryButtonClassName()}>
                    一键测试提交
                  </button>
                </div>
                <div className={`mt-4 rounded-[8px] border px-4 py-3 text-sm font-semibold ${
                  lastPublishRecord?.passed ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]" : "border-[#dbeafe] bg-[#f8fbff] text-[#344054]"
                }`}>
                  {lastPublishRecord
                    ? `最近测试：${lastPublishRecord.passed ? "通过" : "未通过"}，得分 ${lastPublishRecord.score ?? 0}/${lastPublishRecord.totalScore ?? 0}`
                    : "保存题目后可执行服务端一键测试，系统会用标准答案快照生成测试提交并调用判题规则。"}
                </div>
                <div className="mt-4 overflow-x-auto">
                  <div className="grid min-w-[720px] grid-cols-[140px_minmax(220px,1fr)_minmax(220px,1fr)_120px] gap-x-3 gap-y-2 text-sm">
                    {["校验项", "预期值", "实际值", "误差"].map((item) => (
                      <div key={item} className="min-w-0 font-semibold text-[#475467]">{item}</div>
                    ))}
                    {[
                      lastPublishRecord?.title || "总销售额合计",
                      String(lastPublishRecord?.totalScore ?? (answerPreviewText || "-")),
                      String(lastPublishRecord?.score ?? (answerPreviewText || "-")),
                      lastPublishRecord ? (lastPublishRecord.passed ? "0%" : "待修正") : "0%",
                    ].map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="min-w-0 max-h-[320px] overflow-auto whitespace-pre-wrap break-words leading-6 text-[#101828] [overflow-wrap:anywhere]"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {editorStep === 3 ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[8px] border border-[#e5eaf3] bg-white p-5">
              <h3 className="text-[18px] font-semibold text-[#101828]">预览发布</h3>
              <div className="mt-4 rounded-[8px] border border-[#dfe7f2] bg-[#fbfdff] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[22px] font-semibold text-[#101828]">{form.title || "SUMIF 条件求和"}</div>
                    <p className="mt-3 text-sm leading-6 text-[#475467]">{form.explanation || "发布前请确认题目说明、模板、答题区域和判题规则。"}</p>
                  </div>
                  <span className="rounded-[4px] bg-[#dcfce7] px-2 py-1 text-xs font-semibold text-[#16a34a]">{form.enabled ? "启用" : "草稿"}</span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[#475467] md:grid-cols-3">
                  <div>分类：{questionCategories.find((item) => String(item.id) === String(form.questionCategoryId))?.name || "未选择"}</div>
                  <div>奖励：{resolveQuestionPointsByDifficulty(form.difficulty)} 分</div>
                  <div>区域：{form.answerSheet || selectedSheetName || "-"} / {form.answerRange || "-"}</div>
                </div>
              </div>
              <div className="mt-5 rounded-[8px] border border-[#e5eaf3] bg-white p-4">
                <h4 className="text-sm font-black text-slate-900">发布内容修改</h4>
                <div className="mt-4 space-y-4">
                  <Field label="题目标题">
                    <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} className={inputClassName()} />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="所属分类">
                      <select value={String(form.questionCategoryId)} onChange={(event) => setForm((prev) => ({ ...prev, questionCategoryId: event.target.value }))} className={inputClassName()}>
                        <option value="">请选择</option>
                        {questionCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </Field>
                    <Field label="难度">
                      <select
                        value={String(normalizeQuestionDifficulty(form.difficulty))}
                        onChange={(event) => setForm((prev) => applyQuestionDifficulty(prev, event.target.value))}
                        className={inputClassName()}
                      >
                        {QUESTION_DIFFICULTY_POINT_OPTIONS.map((item) => (
                          <option key={item.difficulty} value={item.difficulty}>
                            难度 {item.difficulty} · {item.points} 积分
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="题目说明">
                    <textarea value={form.explanation} onChange={(event) => setForm((prev) => ({ ...prev, explanation: event.target.value }))} className={textareaClassName()} />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="答题工作表">
                      <input value={form.answerSheet || selectedSheetName} onChange={(event) => setForm((prev) => ({ ...prev, answerSheet: event.target.value }))} className={inputClassName()} />
                    </Field>
                    <Field label="答题区域">
                      <input value={form.answerRange} onChange={(event) => setForm((prev) => ({ ...prev, answerRange: event.target.value.toUpperCase() }))} className={inputClassName()} placeholder="B2:F20" />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="判题模式">
                      <select
                        value={form.gradingMode}
                        onChange={(event) => setForm((prev) => ({
                          ...prev,
                          gradingMode: event.target.value as QuestionGradingMode,
                          dynamicArrayRules: event.target.value === "dynamic_array"
                            ? ((prev.dynamicArrayRules?.length && prev.dynamicArrayRules.some((item) => item.anchorCell || item.spillRange))
                              ? prev.dynamicArrayRules
                              : [{
                                ...defaultDynamicArrayRule(prev.answerSheet || selectedSheetName),
                                sheet: prev.answerSheet || selectedSheetName || "",
                                spillRange: prev.answerRange || "",
                                requireAnchorFormula: prev.checkFormula !== false,
                              }])
                            : prev.dynamicArrayRules,
                        }))}
                        className={inputClassName()}
                      >
                        <option value="simple">普通区域判题</option>
                        <option value="dynamic_array">动态数组判题</option>
                      </select>
                    </Field>
                    <label className="flex items-end">
                      <span className="inline-flex h-9 items-center gap-2 rounded-[2px] border border-[#d9d9d9] bg-white px-3 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(form.checkFormula)}
                          onChange={(event) => setForm((prev) => ({ ...prev, checkFormula: event.target.checked }))}
                          disabled={isDynamicArrayMode}
                        />
                        检测函数公式
                      </span>
                    </label>
                  </div>
                  <AdminFormSwitch
                    label="启用（发布后学员可见）"
                    checked={Boolean(form.enabled)}
                    onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
                  />
                </div>
              </div>
            </div>
            <div className="rounded-[8px] border border-[#f6d26b] bg-[#fff9e6] p-5">
              <h3 className="text-[18px] font-semibold text-[#b7791f]">发布前检查</h3>
              <div className="mt-4 space-y-2 text-sm text-[#694d16]">
                {QUESTION_PUBLISH_CHECKS.map((item) => <div key={item}>{item}</div>)}
              </div>
            </div>
          </section>
        ) : null}

      </FormDialog>

      <FormDialog
        open={levelConfigOpen}
        onOpenChange={setLevelConfigOpen}
        title="编辑闯关关卡"
        description="调整关卡类型、目标时间、奖励经验、奖励积分与首通额外奖励。"
        submitLabel="保存配置"
        contentClassName="w-[min(920px,calc(100vw-2rem))]"
        onSubmit={submitLevelConfig}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="关卡名称">
                <input value={levelConfigEditing?.title || ""} readOnly className={`${inputClassName()} bg-slate-50 text-slate-500`} />
              </Field>
              <Field label="所属章节">
                <input value={levelConfigEditing?.chapterName || ""} readOnly className={`${inputClassName()} bg-slate-50 text-slate-500`} />
              </Field>
              <Field label="关联题目">
                <input value={levelConfigEditing?.questionTitle || ""} readOnly className={`${inputClassName()} bg-slate-50 text-slate-500`} />
              </Field>
              <Field label="关卡类型">
                <select value={levelConfigForm.levelType} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, levelType: e.target.value }))} className={inputClassName()}>
                  <option value="normal">练习关卡</option>
                  <option value="elite">精英关卡</option>
                  <option value="exam">测验关卡</option>
                  <option value="boss">Boss 关卡</option>
                </select>
              </Field>
              <Field label="难度">
                <select value={levelConfigForm.difficulty} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, difficulty: e.target.value }))} className={inputClassName()}>
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                  <option value="expert">专家</option>
                </select>
              </Field>
              <Field label="目标时间（秒）">
                <input type="number" value={levelConfigForm.targetTimeSeconds} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, targetTimeSeconds: e.target.value }))} className={inputClassName()} />
              </Field>
              <Field label="奖励经验">
                <input type="number" value={levelConfigForm.rewardExp} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, rewardExp: e.target.value }))} className={inputClassName()} />
              </Field>
              <Field label="奖励积分">
                <input type="number" value={levelConfigForm.rewardPoints} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, rewardPoints: e.target.value }))} className={inputClassName()} />
              </Field>
              <Field label="首通额外奖励">
                <input type="number" value={levelConfigForm.firstPassBonus} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, firstPassBonus: e.target.value }))} className={inputClassName()} />
              </Field>
            </div>
            <AdminFormSwitch
              label="是否启用"
              checked={Boolean(levelConfigForm.enabled)}
              onCheckedChange={(next) => setLevelConfigForm((prev) => ({ ...prev, enabled: next }))}
            />
            <div className="rounded-[8px] border border-[#f6d26b] bg-[#fff9e6] px-4 py-3 text-sm text-[#8a5a00]">
              <AlertTriangle size={16} className="mr-2 inline-block" />
              修改关卡会影响前台闯关路径。
            </div>
          </section>

          <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-4">
            <h3 className="text-[18px] font-semibold text-[#101828]">前台闯关卡片预览</h3>
            <div className="mt-4 rounded-[8px] border border-[#dbeafe] bg-[#f8fbff] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-[6px] bg-[#1769ff] px-3 py-1 text-sm font-semibold text-white">第 {levelConfigEditing?.id || "-"} 关</span>
                <span className="rounded-[6px] bg-[#fff7ed] px-3 py-1 text-sm font-semibold text-[#f97316]">{levelConfigForm.difficulty === "medium" ? "中等" : levelConfigForm.difficulty}</span>
              </div>
              <div className="text-[22px] font-semibold text-[#101828]">{levelConfigEditing?.title || "条件判断进阶"}</div>
              <div className="mt-3 rounded-[6px] bg-white px-3 py-2 text-sm text-[#475467]">{levelConfigEditing?.chapterName || "第二章：条件与逻辑函数"}</div>
              <p className="mt-3 text-sm leading-6 text-[#667085]">{levelConfigEditing?.questionTitle || "掌握多条件判断与逻辑运算，提升数据分析的准确性。"}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-[8px] bg-white p-3">
                  <div className="text-[#667085]">目标分数</div>
                  <div className="mt-1 text-lg font-semibold text-[#101828]">{levelConfigForm.rewardExp || 0} 分</div>
                </div>
                <div className="rounded-[8px] bg-white p-3">
                  <div className="text-[#667085]">奖励积分</div>
                  <div className="mt-1 text-lg font-semibold text-[#101828]">{levelConfigForm.rewardPoints || 0} 积分</div>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-[#e5eaf3]">
                <div className="h-full w-0 rounded-full bg-[#1769ff]" />
              </div>
              <button type="button" className={`${primaryButtonClassName()} mt-4 w-full`}>开始闯关</button>
            </div>
          </section>
        </div>
      </FormDialog>
    </AdminPageShell>
  );
}
