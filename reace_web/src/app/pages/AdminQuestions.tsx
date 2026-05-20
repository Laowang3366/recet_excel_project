import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronDown, ChevronRight, Edit3, FileSpreadsheet, LoaderCircle, MousePointer2, Plus, RotateCcw, Search, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { FastWorkbookFallbackEditor, preloadExcelWorkbookEditor } from "../components/FastWorkbookFallbackEditor";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import { api } from "../lib/api";
import { buildWorkbookWithAnswerSnapshot, clearDynamicArraySpillChildren, columnIndexToLabel, detectFormulaAnswerRegion, extractRangeAnswerSnapshot, findMissingFormulaCellRefs, formatAnswerPreviewCellDisplay, ExcelRangeSelection, ExcelWorkbookSnapshot, DynamicArrayHydrationRule, normalizeSelection, parseRangeRef, selectionToRangeRef, toCellRef } from "../lib/excel";
import { adminKeys, practiceKeys } from "../lib/query-keys";
import { AddButton, AdminBulkActions, AdminBulkCheckbox, AdminEmptyState, AdminPageShell, AdminPagination, AdminSection, FilterBar, FilterField, formatQuestionType, answerRangeButtonClassName, primaryButtonClassName, secondaryButtonClassName, inputClassName, textareaClassName } from "../admin/shared";
import { PagedAdminResponse, QuestionCategoryRecord, DailyChallengeForm, PracticeCampaignLevelRecord, LevelConfigForm, QuestionGradingMode, AdminQuestionForm, AdminQuestionRecord, AdminQuestionsResponse, adminRequest, ExcelEditorErrorBoundary, showAdminSuccess, showAdminError, runAdminDelete, runAdminBulkDelete, openAdminConfirm, formatAdminEntityMessage, useAdminRole, FormDialog, Field, AdminFormSwitch, AdminTableSwitch, toNullableNumber, defaultQuestionForm, defaultDynamicArrayRule, parseDynamicArrayRulesFromJson, buildDynamicArrayRuleJson } from "./AdminConsoleShared";

const ExcelWorkbookEditor = lazy(() =>
  preloadExcelWorkbookEditor().then((module) => ({ default: module.ExcelWorkbookEditor }))
);

export function AdminQuestions() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [questionCategoryId, setQuestionCategoryId] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [enabledFilter, setEnabledFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [campaignConfigExpanded, setCampaignConfigExpanded] = useState(false);
  const [dailyChallengeForm, setDailyChallengeForm] = useState<DailyChallengeForm>({
    challengeDate: "",
    levelId: "",
    rewardExp: "",
    rewardPoints: "",
    enabled: true,
  });
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
  const [editing, setEditing] = useState<AdminQuestionRecord | null>(null);
  const [form, setForm] = useState<AdminQuestionForm>(defaultQuestionForm());
  const [templateWorkbook, setTemplateWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [editorWorkbook, setEditorWorkbook] = useState<ExcelWorkbookSnapshot>({ sheets: [] });
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [selection, setSelection] = useState<ExcelRangeSelection | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState("");
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [isTemplateEditMode, setIsTemplateEditMode] = useState(true);
  const [isSelectingAnswerRange, setIsSelectingAnswerRange] = useState(false);
  const [formulaDetectionNotice, setFormulaDetectionNotice] = useState("");
  const [editorFullscreenVersion, setEditorFullscreenVersion] = useState(0);
  const editorSnapshotGetterRef = useRef<(() => ExcelWorkbookSnapshot | null) | null>(null);
  const size = 20;
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
  const campaignDailyQuery = useQuery({
    queryKey: adminKeys.practiceCampaignDaily(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<{ record?: Partial<DailyChallengeForm> & { levelId?: number | string | null } }>(api.get("/api/admin/practice-campaign/daily-challenge", { silent: true }), navigate, role);
      return result || { record: {} };
    },
  });
  const campaignLevels = campaignLevelsQuery.data?.records || [];

  useEffect(() => {
    const record = campaignDailyQuery.data?.record;
    if (!record) return;
    setDailyChallengeForm({
      challengeDate: record.challengeDate || "",
      levelId: record.levelId ? String(record.levelId) : "",
      rewardExp: record.rewardExp ?? "",
      rewardPoints: record.rewardPoints ?? "",
      enabled: record.enabled ?? true,
    });
  }, [campaignDailyQuery.data]);

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
      const workbookWithAnswer = buildWorkbookWithAnswerSnapshot(snapshot, answerSheet, answerRange, answerSnapshotJson, {
        dynamicArrayRules: Array.isArray(dynamicArrayRules) ? dynamicArrayRules : [],
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
    setForm({
      title: item.title || "",
      questionCategoryId: item.questionCategoryId || "",
      difficulty: item.difficulty ?? 1,
      points: item.points ?? 0,
      explanation: item.explanation || "",
      enabled: item.enabled ?? true,
      templateFileUrl: item.templateFileUrl || "",
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
    const latestWorkbook = editorSnapshotGetterRef.current?.() || editorWorkbook;
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
    const payload = {
      title: form.title,
      type: "excel_template",
      questionCategoryId: toNullableNumber(form.questionCategoryId),
      difficulty: Number(form.difficulty || 1),
      points: Number(form.points || 0),
      explanation: form.explanation,
      enabled: form.enabled,
      templateFileUrl: form.templateFileUrl,
      answerSheet: resolvedSheetName,
      answerRange: resolvedRange,
      answerSnapshotJson: JSON.stringify(answerSnapshot),
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
      title: "删除题目",
      message: `确认删除题目《${item.title}》？`,
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (!confirmed) return;
    await runAdminDelete({
      request: api.delete(`/api/admin/questions/${item.id}`),
      successMessage: formatAdminEntityMessage("题目", item.title, "已删除"),
      staleMessage: `题目《${item.title}》不存在，列表已刷新`,
      errorLabel: "删除题目",
      onRefresh: () => queryClient.invalidateQueries({ queryKey: questionListQueryKey }).then(() => undefined),
    });
  };

  const removeSelected = async () => {
    const items = bulkSelection.selectedItems;
    if (items.length === 0 || bulkDeleting) return;
    const confirmed = await openAdminConfirm({
      title: "批量删除题目",
      message: `确认删除选中的 ${items.length} 道题目？`,
      confirmLabel: "删除选中",
      destructive: true,
    });
    if (!confirmed) return;
    setBulkDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/questions/${item.id}`),
      entityName: "题目",
      errorLabel: "批量删除题目",
      onRefresh: () => queryClient.invalidateQueries({ queryKey: questionListQueryKey }).then(() => undefined),
      onFinally: () => {
        bulkSelection.clear();
        setBulkDeleting(false);
      },
    });
  };

  const submitDailyChallenge = async () => {
    const payload = {
      challengeDate: dailyChallengeForm.challengeDate || undefined,
      levelId: Number(dailyChallengeForm.levelId || 0),
      rewardExp: Number(dailyChallengeForm.rewardExp || 0),
      rewardPoints: Number(dailyChallengeForm.rewardPoints || 0),
      enabled: Boolean(dailyChallengeForm.enabled),
    };
    const result = await adminRequest(
      api.put("/api/admin/practice-campaign/daily-challenge", payload),
      navigate,
      role,
      "更新每日挑战",
    );
    if (!result) return;
    showAdminSuccess("每日挑战配置已更新");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.practiceCampaignDaily() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignDaily() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignOverview() }),
    ]);
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
      if (form.gradingMode === "dynamic_array") {
        setEditorWorkbook(clearDynamicArraySpillChildren(snapshot, [nextDynamicRule]));
      }
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
  const currentPreviewWorkbook = editorSnapshotGetterRef.current?.() || editorWorkbook;
  const answerPreview = extractRangeAnswerSnapshot(
    currentPreviewWorkbook,
    primarySheetName,
    isTemplateEditMode ? (selectionToRangeRef(selection) || primaryRangeRef) : primaryRangeRef,
  );
  const previewRangeRef = isTemplateEditMode ? (selectionToRangeRef(selection) || primaryRangeRef) : primaryRangeRef;
  const previewRange = previewRangeRef ? parseRangeRef(previewRangeRef) : null;
  const persistedRange = primaryRangeRef ? parseRangeRef(primaryRangeRef) : null;
  const persistedFocusRange = primarySheetName && persistedRange
    ? normalizeSelection(primarySheetName, persistedRange.startRow, persistedRange.startCol, persistedRange.endRow, persistedRange.endCol)
    : null;
  const prevSelectionForSheet = (sheetName: string, rangeText: string) => {
    const parsed = rangeText ? parseRangeRef(rangeText) : null;
    if (!parsed || !sheetName) return null;
    return normalizeSelection(sheetName, parsed.startRow, parsed.startCol, parsed.endRow, parsed.endCol);
  };
  const answerPreviewText = answerPreview.values.flatMap((valueRow, rowIndex) =>
    valueRow.map((value, colIndex) => {
      const formula = answerPreview.formulas?.[rowIndex]?.[colIndex];
      return formatAnswerPreviewCellDisplay(value, formula);
    }),
  ).filter((item) => item.trim().length > 0).join(" | ");
  const answerPreviewHasEmptyCell = answerPreview.values.some((row) =>
    row.some((value) => String(value ?? "").trim().length === 0),
  );
  const missingFormulaCellRefs = !isDynamicArrayMode && Boolean(form.checkFormula)
    ? findMissingFormulaCellRefs(answerPreview, previewRangeRef)
    : [];
  const missingFormulaCellRefSet = new Set(missingFormulaCellRefs);
  const previewColumnLabels = previewRange
    ? Array.from({ length: previewRange.endCol - previewRange.startCol + 1 }, (_, index) => columnIndexToLabel(previewRange.startCol + index))
    : [];
  const previewRowLabels = previewRange
    ? Array.from({ length: previewRange.endRow - previewRange.startRow + 1 }, (_, index) => previewRange.startRow + index)
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

  return (
    <AdminPageShell
      title="题库管理"
      description="管理 Excel 模板题，配置答题区域、标准答案与判题方式。"
    >
      <AdminSection title="题目列表" actions={<AddButton onClick={openCreate}>新增题目</AddButton>}>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-[2px] border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
            <div className="text-xs text-[#8c8c8c]">题目总数</div>
            <div className="mt-1 text-2xl font-semibold text-[#262626]">{total}</div>
          </div>
          <div className="rounded-[2px] border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
            <div className="text-xs text-[#8c8c8c]">当前页</div>
            <div className="mt-1 text-2xl font-semibold text-[#262626]">{visibleQuestionCount}</div>
          </div>
          <div className="rounded-[2px] border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
            <div className="text-xs text-[#8c8c8c]">题目分类</div>
            <div className="mt-1 text-2xl font-semibold text-[#262626]">{questionCategories.length}</div>
          </div>
          <div className="rounded-[2px] border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
            <div className="text-xs text-[#8c8c8c]">每页展示</div>
            <div className="mt-1 text-2xl font-semibold text-[#262626]">{size}</div>
          </div>
        </div>

        <FilterBar>
          <FilterField label="题目搜索">
            <div className="flex gap-2">
              <input
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyQuestionKeyword();
                }}
                placeholder="输入题目标题或 ID"
                className={inputClassName()}
              />
              <button type="button" onClick={applyQuestionKeyword} className={primaryButtonClassName()}>
                <Search size={14} />
                搜索
              </button>
            </div>
          </FilterField>
          <FilterField label="题目分类">
            <select value={questionCategoryId} onChange={(e) => { setQuestionCategoryId(e.target.value); setPage(1); }} className={inputClassName()}>
              <option value="">全部</option>
              {questionCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </FilterField>
          <FilterField label="状态">
            <select value={enabledFilter} onChange={(e) => { setEnabledFilter(e.target.value); setPage(1); }} className={inputClassName()}>
              <option value="">全部状态</option>
              <option value="true">已启用</option>
              <option value="false">已停用</option>
            </select>
          </FilterField>
          <FilterField label="难度">
            <select value={difficultyFilter} onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }} className={inputClassName()}>
              <option value="">全部难度</option>
              <option value="1">难度 1</option>
              <option value="2">难度 2</option>
              <option value="3">难度 3</option>
              <option value="4">难度 4</option>
              <option value="5">难度 5</option>
            </select>
          </FilterField>
          <div className="flex items-end gap-2">
            <button type="button" onClick={resetQuestionFilters} disabled={!hasQuestionFilters && !keywordDraft} className={secondaryButtonClassName()}>
              <RotateCcw size={14} />
              重置
            </button>
          </div>
        </FilterBar>

        <div className="mt-4 overflow-hidden rounded-[2px] border border-[#f0f0f0]">
          <div className="p-3 pb-0">
            <AdminBulkActions
              selectedCount={bulkSelection.selectedCount}
              totalCount={records.length}
              allVisibleSelected={bulkSelection.allVisibleSelected}
              deleting={bulkDeleting}
              onToggleAll={bulkSelection.toggleAllVisible}
              onClear={bulkSelection.clear}
              onDeleteSelected={() => void removeSelected()}
            />
          </div>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[#fafafa]">
              <TableRow>
                <TableHead className="w-10">选择</TableHead>
                <TableHead>题目</TableHead>
                <TableHead>工作表 / 区域</TableHead>
                <TableHead>难度 / 奖励</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="sticky right-0 bg-[#fafafa] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <AdminBulkCheckbox
                      checked={bulkSelection.isSelected(item.id)}
                      onChange={() => bulkSelection.toggleOne(item.id)}
                      label={`选择题目 ${item.title}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-[520px] py-2">
                    <div className="line-clamp-1 font-bold text-slate-800">{item.title}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>ID {item.id}</span>
                      <span>·</span>
                      <span>{item.questionCategoryName || "未分类"}</span>
                      <span>·</span>
                      <span>{formatQuestionType(item.type || "excel_template")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="font-medium text-slate-700">{item.answerSheet || "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.answerRange || "未配置区域"}</div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div>难度 {item.difficulty || 1}</div>
                    <div className="mt-1 text-xs text-slate-400">积分 {item.points || 0}</div>
                  </TableCell>
                  <TableCell className="py-2">
                    <AdminTableSwitch
                      checked={Boolean(item.enabled)}
                      onCheckedChange={(next) => void toggleEnabled(item, next)}
                    />
                  </TableCell>
                  <TableCell className="sticky right-0 bg-white py-2">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => void openEdit(item)} className={secondaryButtonClassName()}><Edit3 size={14} />编辑</button>
                      <button type="button" onClick={() => remove(item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
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
      </AdminSection>

      <section className="rounded-[2px] border border-[#f0f0f0] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <button
          type="button"
          onClick={() => setCampaignConfigExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="text-[16px] font-medium text-[#262626]">闯关配置</span>
            <span className="ml-3 text-sm text-[#8c8c8c]">每日挑战和 {campaignLevels.length} 个关卡配置，默认收起以便优先管理题目。</span>
          </span>
          <span className={secondaryButtonClassName()}>
            {campaignConfigExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {campaignConfigExpanded ? "收起配置" : "展开配置"}
          </span>
        </button>
      </section>

      {campaignConfigExpanded ? (
        <>
          <AdminSection title="闯关每日挑战配置">
            <FilterBar>
              <FilterField label="挑战日期">
                <input
                  type="date"
                  value={dailyChallengeForm.challengeDate}
                  onChange={(e) => setDailyChallengeForm((prev) => ({ ...prev, challengeDate: e.target.value }))}
                  className={inputClassName()}
                />
              </FilterField>
              <FilterField label="挑战关卡">
                <select
                  value={dailyChallengeForm.levelId}
                  onChange={(e) => setDailyChallengeForm((prev) => ({ ...prev, levelId: e.target.value }))}
                  className={inputClassName()}
                >
                  <option value="">请选择关卡</option>
                  {campaignLevels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.chapterName} / {item.title}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="奖励经验">
                <input
                  type="number"
                  value={dailyChallengeForm.rewardExp}
                  onChange={(e) => setDailyChallengeForm((prev) => ({ ...prev, rewardExp: e.target.value }))}
                  className={inputClassName()}
                />
              </FilterField>
              <FilterField label="奖励积分">
                <input
                  type="number"
                  value={dailyChallengeForm.rewardPoints}
                  onChange={(e) => setDailyChallengeForm((prev) => ({ ...prev, rewardPoints: e.target.value }))}
                  className={inputClassName()}
                />
              </FilterField>
              <div className="flex items-end">
                <button type="button" onClick={() => void submitDailyChallenge()} className={primaryButtonClassName()}>
                  <Sparkles size={14} />
                  保存每日挑战
                </button>
              </div>
            </FilterBar>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              当前每日挑战会展示在闯关大厅的“每日挑战”入口中。未配置时，前台会自动回退到当前可挑战关卡。
            </div>
          </AdminSection>

          <AdminSection title="闯关关卡配置" description="统一调整关卡类型、目标时间、奖励经验、奖励积分和首通额外奖励。">
            <div className="mt-5 max-h-[520px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-[#fafafa]">
                  <TableRow>
                    <TableHead>关卡</TableHead>
                    <TableHead>章节 / 题目</TableHead>
                    <TableHead>类型 / 难度</TableHead>
                    <TableHead>目标 / 奖励</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="sticky right-0 bg-[#fafafa] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignLevels.map((item) => (
                    <TableRow key={`campaign-level-${item.id}`}>
                      <TableCell>
                        <div className="font-bold text-slate-800">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-400">ID {item.id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-700">{item.chapterName || "-"}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.questionTitle || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <div>{item.levelType || "normal"}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.difficulty || "easy"}</div>
                      </TableCell>
                      <TableCell>
                        <div>目标 {item.targetTimeSeconds || 0}s</div>
                        <div className="mt-1 text-xs text-slate-400">
                          经验 {item.rewardExp || 0} · 积分 {item.rewardPoints || 0} · 首通 {item.firstPassBonus || 0}
                        </div>
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
                      <TableCell className="sticky right-0 bg-white">
                        <div className="flex justify-end">
                          <button type="button" onClick={() => openLevelConfig(item)} className={secondaryButtonClassName()}>
                            <Edit3 size={14} />
                            配置
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {campaignLevels.length === 0 && <AdminEmptyState message="暂无闯关关卡数据。" />}
            </div>
          </AdminSection>
        </>
      ) : null}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "编辑 Excel 模板题" : "新增 Excel 模板题"}
        description="上传模板后，直接在表格里选择答题工作表、框选区域，并填写标准答案。"
        submitLabel={editing ? "保存题目" : "创建题目"}
        contentClassName="w-[min(1120px,calc(100vw-2rem))]"
        bodyClassName="px-6 py-5"
        onSubmit={submit}
      >
        <Field label="题目标题"><textarea value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className={textareaClassName()} /></Field>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="题目分类">
            <select value={String(form.questionCategoryId)} onChange={(e) => setForm((prev) => ({ ...prev, questionCategoryId: e.target.value }))} className={inputClassName()}>
              <option value="">请选择</option>
              {questionCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="题型"><input value={formatQuestionType("excel_template")} readOnly className={inputClassName()} /></Field>
          <Field label="难度"><input type="number" value={form.difficulty} onChange={(e) => setForm((prev) => ({ ...prev, difficulty: e.target.value }))} className={inputClassName()} /></Field>
          <Field label="奖励积分"><input type="number" value={form.points} onChange={(e) => setForm((prev) => ({ ...prev, points: e.target.value }))} className={inputClassName()} /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-[220px,1fr]">
          <Field label="判题模式">
            <select
              value={form.gradingMode}
              onChange={(e) => setForm((prev) => ({
                ...prev,
                gradingMode: e.target.value as QuestionGradingMode,
                dynamicArrayRules: e.target.value === "dynamic_array"
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {form.gradingMode === "dynamic_array"
              ? "动态数组模式会同时校验溢出结果、锚点公式以及扩展区域是否被手工改写。"
              : "普通区域模式会按答题区域逐格比对值，勾选后会额外校验函数公式。"}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-900">Excel 模板</div>
              <div className="mt-1 text-xs text-slate-500">{form.templateFileUrl || "尚未上传模板文件"}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={() => setIsTemplateEditMode((current) => !current)}
                  className={secondaryButtonClassName()}
                >
                  <Edit3 size={14} />
                  {isTemplateEditMode ? "完成修改" : "修改规则"}
                </button>
              )}
              <label className={`${primaryButtonClassName()} cursor-pointer ${!isTemplateEditMode ? "opacity-50 pointer-events-none" : ""}`}>
                {uploadingTemplate ? <LoaderCircle size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                上传模板
                <input type="file" accept=".xlsx,.xls" className="hidden" disabled={!isTemplateEditMode} onChange={(e) => void handleTemplateUpload(e.target.files)} />
              </label>
            </div>
          </div>
          {formulaDetectionNotice && (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
              {formulaDetectionNotice}
            </div>
          )}
          {templateLoadError && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
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
          )}
          {sheetOptions.length > 0 && (
            <div className="grid gap-4 md:grid-cols-4">
              <Field label={isDynamicArrayMode ? "首条规则工作表" : "答题工作表"}>
                <select
                  value={primarySheetName}
                  disabled={!isTemplateEditMode}
                  onChange={(e) => {
                    const nextSheetName = e.target.value;
                    setSelectedSheetName(nextSheetName);
                    setForm((prev) => ({
                      ...prev,
                      answerSheet: nextSheetName,
                      dynamicArrayRules: prev.gradingMode === "dynamic_array"
                        ? (prev.dynamicArrayRules || []).map((item, index) => (index === 0 ? { ...item, sheet: nextSheetName } : item))
                        : prev.dynamicArrayRules,
                    }));
                    const persistedForSheet = prevSelectionForSheet(nextSheetName, primaryRangeRef);
                    setSelection(persistedForSheet);
                  }}
                  className={inputClassName()}
                >
                  <option value="">请选择</option>
                  {sheetOptions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </Field>
              <Field label={isDynamicArrayMode ? "首条规则溢出区域" : "答题区域"}>
                <div className="flex gap-2">
                  <input value={currentSelectionText} readOnly className={inputClassName()} />
                  <button
                    type="button"
                    onClick={openAnswerRangeEditor}
                    disabled={!isTemplateEditMode}
                    className={answerRangeButtonClassName()}
                  >
                    <MousePointer2 size={14} />
                    选择区域
                  </button>
                </div>
              </Field>
              <Field label="标准答案">
                <div className="space-y-2">
                  <input
                    value={answerPreviewText || "未填写"}
                    readOnly
                    className={inputClassName()}
                  />
                  {answerPreviewHasEmptyCell && (
                    <div className="text-xs font-medium text-amber-600">答题区域中存在空白单元格，保存前请补全标准答案。</div>
                  )}
                  {missingFormulaCellRefs.length > 0 && (
                    <div className="text-xs font-medium text-rose-600">
                      检测函数公式已开启，{missingFormulaCellRefs.slice(0, 6).join("、")}{missingFormulaCellRefs.length > 6 ? ` 等 ${missingFormulaCellRefs.length} 个单元格` : ""} 不是公式。
                    </div>
                  )}
                </div>
              </Field>
              {isDynamicArrayMode ? (
                <Field label="首条规则锚点">
                  <input
                    value={primaryDynamicRule.anchorCell}
                    disabled={!isTemplateEditMode}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, index) => (index === 0
                        ? { ...item, anchorCell: e.target.value.toUpperCase() }
                        : item)),
                    }))}
                    className={inputClassName()}
                    placeholder="例如 F2"
                  />
                </Field>
              ) : (
                <label className="flex items-end">
                  <span className={`inline-flex h-9 items-center gap-2 rounded-[2px] border border-[#d9d9d9] bg-white px-3 text-sm font-medium text-slate-700 ${!isTemplateEditMode ? "opacity-60" : ""}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.checkFormula)}
                      disabled={!isTemplateEditMode}
                      onChange={(e) => setForm((prev) => ({ ...prev, checkFormula: e.target.checked }))}
                    />
                    检测函数公式
                  </span>
                </label>
              )}
            </div>
          )}
          {isDynamicArrayMode && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900">动态数组规则</div>
                  <div className="mt-1 text-xs text-slate-500">支持多条规则统一判题，首条规则会同步到模板编辑器预览。</div>
                </div>
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
              </div>
              <div className="space-y-4">
                {(form.dynamicArrayRules || []).map((rule, index) => (
                  <div key={`dynamic-rule-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                    <div className="grid gap-4 md:grid-cols-4">
                      <Field label="工作表">
                        <select
                          value={rule.sheet}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, sheet: e.target.value }
                              : item)),
                          }))}
                          className={inputClassName()}
                        >
                          <option value="">请选择</option>
                          {sheetOptions.map((item) => <option key={`dynamic-sheet-${index}-${item.name}`} value={item.name}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="锚点单元格">
                        <input
                          value={rule.anchorCell}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, anchorCell: e.target.value.toUpperCase() }
                              : item)),
                          }))}
                          className={inputClassName()}
                          placeholder="例如 F2"
                        />
                      </Field>
                      <Field label="溢出区域">
                        <input
                          value={rule.spillRange}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, spillRange: e.target.value.toUpperCase() }
                              : item)),
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
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, score: e.target.value }
                              : item)),
                          }))}
                          className={inputClassName()}
                        />
                      </Field>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="规则名称">
                        <input
                          value={rule.label}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, label: e.target.value }
                              : item)),
                          }))}
                          className={inputClassName()}
                          placeholder="例如 按条件筛选结果"
                        />
                      </Field>
                      <Field label="公式关键字">
                        <input
                          value={rule.formulaKeywordsText}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                              ? { ...item, formulaKeywordsText: e.target.value }
                              : item)),
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
                          dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                            ? { ...item, requireAnchorFormula: next }
                            : item)),
                        }))}
                      />
                      <AdminFormSwitch
                        label="溢出子单元格不允许手填公式"
                        checked={Boolean(rule.requireSpillCellsWithoutFormula)}
                        onCheckedChange={(next) => setForm((prev) => ({
                          ...prev,
                          dynamicArrayRules: (prev.dynamicArrayRules || []).map((item, ruleIndex) => (ruleIndex === index
                            ? { ...item, requireSpillCellsWithoutFormula: next }
                            : item)),
                        }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 text-xs text-slate-500">
            {isTemplateEditMode
              ? (isDynamicArrayMode
                ? "先维护动态数组规则，首条规则可借助模板编辑器框选溢出区域；框选后请补充锚点单元格与公式关键字。"
                : "先选工作表，再在表格里拖拽框选答题区域；框选完成后，在表格中直接填写标准答案或公式。")
              : "当前为查看态。点击“修改规则”后才允许调整工作表、判题区域和标准答案。"}
          </div>
          {previewRange && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900">标准答案预览</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {primarySheetName || "-"} / {previewRangeRef || "-"}
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
                        <th
                          key={`preview-col-${label}`}
                          className="min-w-[120px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-500"
                        >
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
                          const cellRef = previewRange ? toCellRef(previewRange.startRow + rowIndex, previewRange.startCol + colIndex) : "";
                          const missingFormula = missingFormulaCellRefSet.has(cellRef);
                          const displayValue = formatAnswerPreviewCellDisplay(value, formula);
                          return (
                            <td
                              key={`preview-cell-${rowIndex}-${colIndex}`}
                              className={`border-b border-r border-slate-200 px-3 py-2 align-top ${!displayValue.trim() ? "bg-amber-50/70" : missingFormula ? "bg-rose-50/70" : "bg-white"}`}
                            >
                              <div className="flex flex-col gap-1">
                                {formula && (
                                  <span className="inline-flex w-fit rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                                    fx
                                  </span>
                                )}
                                {missingFormula && (
                                  <span className="inline-flex w-fit rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
                                    缺少公式
                                  </span>
                                )}
                                <span className={`break-all font-medium ${formula ? "text-cyan-700" : missingFormula ? "text-rose-700" : "text-slate-700"} ${!displayValue.trim() ? "text-amber-700" : ""}`}>
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
          )}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
            <FileSpreadsheet size={16} />
            模板编辑器
          </div>
          {templateLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">正在加载模板...</div>
          ) : templateLoadError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-5 text-center text-sm text-amber-800">
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
                <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-rose-200 bg-rose-50 px-5 text-center text-sm text-rose-700">
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
                />
              </Suspense>
            </ExcelEditorErrorBoundary>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
              上传 Excel 模板后即可开始配置
            </div>
          )}
        </div>
        <Field label="解析说明"><textarea value={form.explanation} onChange={(e) => setForm((prev) => ({ ...prev, explanation: e.target.value }))} className={textareaClassName()} /></Field>
        <AdminFormSwitch
          label="启用该题目"
          checked={Boolean(form.enabled)}
          onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
        />
      </FormDialog>

      <FormDialog
        open={levelConfigOpen}
        onOpenChange={setLevelConfigOpen}
        title={levelConfigEditing ? `配置关卡：${levelConfigEditing.title}` : "配置闯关关卡"}
        description="调整关卡类型、目标时间、奖励经验、奖励积分与首通额外奖励。"
        submitLabel="保存关卡配置"
        onSubmit={submitLevelConfig}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="关卡类型">
            <select value={levelConfigForm.levelType} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, levelType: e.target.value }))} className={inputClassName()}>
              <option value="normal">普通关</option>
              <option value="elite">精英关</option>
              <option value="exam">测验关</option>
              <option value="boss">Boss关</option>
              <option value="daily">每日挑战</option>
            </select>
          </Field>
          <Field label="难度">
            <select value={levelConfigForm.difficulty} onChange={(e) => setLevelConfigForm((prev) => ({ ...prev, difficulty: e.target.value }))} className={inputClassName()}>
              <option value="easy">简单</option>
              <option value="medium">普通</option>
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
          label="启用该关卡"
          checked={Boolean(levelConfigForm.enabled)}
          onCheckedChange={(next) => setLevelConfigForm((prev) => ({ ...prev, enabled: next }))}
        />
      </FormDialog>
    </AdminPageShell>
  );
}
