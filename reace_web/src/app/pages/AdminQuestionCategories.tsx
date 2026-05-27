import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  BarChart3,
  CircleAlert,
  ClipboardList,
  Edit3,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  Info,
  LayoutGrid,
  Link2,
  ListChecks,
  MoreHorizontal,
  Power,
  PowerOff,
  PlusCircle,
  RefreshCw,
  Rows3,
  Save,
  Sigma,
  SlidersHorizontal,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import {
  DEFAULT_QUESTION_CATEGORY_DESIGN_FIELDS,
  QuestionCategoryDesignFields,
  SortableQuestionCategoryRow,
  buildCategoryQuestionListQuery,
  buildQuestionCategoryQuickToggleLabel,
  buildQuestionCategoryMutationPayload,
  buildQuestionCategoryStats,
  buildQuestionCategoryTogglePayload,
  buildSortableCategoryRows,
  moveSortableCategoryRow,
  normalizeCategoryQuestionPreviewRows,
  normalizeQuestionCategoryCards,
} from "../admin/question-categories-view-model";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { AdminEmptyState, AdminPageShell, inputClassName, primaryButtonClassName, secondaryButtonClassName, textareaClassName } from "../admin/shared";
import {
  AdminQuestionsResponse,
  QuestionCategoryForm,
  QuestionCategoryRecord,
  adminRequest,
  defaultQuestionCategoryForm,
  formatAdminEntityMessage,
  openAdminConfirm,
  runAdminDelete,
  showAdminSuccess,
  useAdminRole,
} from "./AdminConsoleShared";

const QUESTION_PREVIEW_PAGE_SIZE = 6;

const iconOptions = [
  { key: "folder", label: "文件夹", icon: Folder },
  { key: "sigma", label: "函数", icon: Sigma },
  { key: "chart", label: "图表", icon: BarChart3 },
  { key: "pie", label: "分析", icon: CircleAlert },
  { key: "table", label: "表格", icon: Table2 },
  { key: "list", label: "清单", icon: ClipboardList },
  { key: "more", label: "更多", icon: MoreHorizontal },
];

function resolveCategoryIcon(iconKey?: string | null) {
  return iconOptions.find((item) => item.key === iconKey)?.icon || Folder;
}

const difficultyOptions = [
  { value: "easy", label: "基础" },
  { value: "medium", label: "中等" },
  { value: "hard", label: "进阶" },
];

export function AdminQuestionCategories() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionCategoryRecord | null>(null);
  const [questionListCategory, setQuestionListCategory] = useState<QuestionCategoryRecord | null>(null);
  const [questionPreviewPage, setQuestionPreviewPage] = useState(1);
  const [form, setForm] = useState<QuestionCategoryForm>(defaultQuestionCategoryForm());
  const [designFields, setDesignFields] = useState<QuestionCategoryDesignFields>(DEFAULT_QUESTION_CATEGORY_DESIGN_FIELDS);
  const [sortRows, setSortRows] = useState<SortableQuestionCategoryRow[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const questionCategoriesQuery = useQuery({
    queryKey: adminKeys.questionCategories(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<QuestionCategoryRecord[]>(api.get("/api/admin/question-categories", { silent: true }), navigate, role);
      return result || [];
    },
  });

  const questionPreviewQuery = useQuery({
    queryKey: adminKeys.questions({
      source: "category-preview",
      categoryId: questionListCategory?.id ?? "",
      page: questionPreviewPage,
      size: QUESTION_PREVIEW_PAGE_SIZE,
    }),
    enabled: Boolean(role && questionListCategory?.id),
    queryFn: async () => {
      if (!questionListCategory?.id) return { questions: [], total: 0 };
      const queryString = buildCategoryQuestionListQuery({
        categoryId: questionListCategory.id,
        page: questionPreviewPage,
        size: QUESTION_PREVIEW_PAGE_SIZE,
      });
      const result = await adminRequest<AdminQuestionsResponse>(api.get(`/api/admin/questions?${queryString}`, { silent: true }), navigate, role);
      return result || { questions: [], total: 0 };
    },
  });

  const records = questionCategoriesQuery.data || [];
  const cards = useMemo(() => normalizeQuestionCategoryCards(records), [records]);
  const stats = useMemo(() => buildQuestionCategoryStats(records), [records]);
  const enabledCards = cards.filter((item) => item.enabled);
  const draftCards = cards.filter((item) => !item.enabled);
  const groupOptions = useMemo(() => buildGroupOptions(records, form.groupName), [records, form.groupName]);

  const refreshCategories = () => queryClient.invalidateQueries({ queryKey: adminKeys.questionCategories() }).then(() => undefined);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultQuestionCategoryForm(), sortOrder: getNextSortOrder(records) });
    setDesignFields(DEFAULT_QUESTION_CATEGORY_DESIGN_FIELDS);
    setOpen(true);
  };

  const openEdit = (item: QuestionCategoryRecord) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      description: item.description || "",
      groupName: item.groupName || "",
      sortOrder: Number(item.sortOrder || 0),
      enabled: item.enabled ?? true,
    });
    setDesignFields(getDesignFieldsFromRecord(item));
    setOpen(true);
  };

  const submit = async () => {
    const payload = buildQuestionCategoryMutationPayload(form, designFields);
    if (!payload.name) {
      toast.error("请填写分类名称");
      return;
    }
    if (editing) {
      const result = await adminRequest<QuestionCategoryRecord>(api.put(`/api/admin/question-categories/${editing.id}`, payload), navigate, role, "更新题目分类");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("题目分类", editing.name || result?.name || form.name, "已更新"));
    } else {
      const result = await adminRequest<QuestionCategoryRecord>(api.post("/api/admin/question-categories", payload), navigate, role, "创建题目分类");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("题目分类", result?.name || form.name, "已创建"));
    }
    await refreshCategories();
  };

  const toggleEnabled = async (item: QuestionCategoryRecord, nextEnabled: boolean) => {
    const payload = buildQuestionCategoryTogglePayload(item, nextEnabled);
    const result = await adminRequest(
      api.put(`/api/admin/question-categories/${item.id}`, payload),
      navigate,
      role,
      nextEnabled ? "启用题目分类" : "停用题目分类",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("题目分类", item.name, nextEnabled ? "已启用" : "已停用"));
    await refreshCategories();
  };

  const remove = async (item: QuestionCategoryRecord) => {
    const confirmed = await openAdminConfirm({
      title: "删除题目分类",
      message: `确认删除题目分类 ${item.name}？`,
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (!confirmed) return;
    await runAdminDelete({
      request: api.delete(`/api/admin/question-categories/${item.id}`),
      successMessage: formatAdminEntityMessage("题目分类", item.name, "已删除"),
      staleMessage: `题目分类《${item.name}》不存在，列表已刷新`,
      errorLabel: "删除题目分类",
      onRefresh: refreshCategories,
    });
  };

  const openSort = () => {
    setSortRows(buildSortableCategoryRows(records));
    setDraggingIndex(null);
    setSortOpen(true);
  };

  const submitSort = async () => {
    try {
      const updates = [];
      for (const row of sortRows) {
        const source = records.find((item) => item.id === row.id);
        if (!source || Number(source.sortOrder ?? 0) === Number(row.sortOrder)) continue;
        updates.push({ id: row.id, sortOrder: Number(row.sortOrder || 0) });
      }
      if (updates.length > 0) {
        await api.put("/api/admin/question-categories/sort", { items: updates });
      }
      setSortOpen(false);
      await refreshCategories();
      toast.success("分类排序已保存");
    } catch (error) {
      await adminRequest(Promise.reject(error), navigate, role, "保存分类排序");
    }
  };

  const moveSortRow = (fromIndex: number, toIndex: number) => {
    setSortRows((current) => moveSortableCategoryRow(current, fromIndex, toIndex));
  };

  const openQuestionList = (item: QuestionCategoryRecord) => {
    setQuestionPreviewPage(1);
    setQuestionListCategory(item);
  };

  return (
    <AdminPageShell
      title="题目分类"
      description="统一管理分类结构、前台章节映射与题目归类状态。"
      actions={
        <>
          <button type="button" onClick={openSort} disabled={records.length === 0} className={secondaryButtonClassName()}>
            <SlidersHorizontal size={16} />
            批量排序
          </button>
          <button type="button" onClick={openCreate} className={primaryButtonClassName()}>
            <PlusCircle size={16} />
            新增分类
          </button>
        </>
      }
    >
      <section className="rounded-[8px] border border-[#e5e7eb] bg-white px-6 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[7px] bg-[#e8f1ff] text-[#1677ff]">
              <FolderOpen size={35} />
              <span className="absolute bottom-2 left-5 h-4 w-4 rounded-[2px] bg-[#1677ff]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[22px] font-semibold text-[#101828]">章节板块配置</h2>
              <p className="mt-1 text-[15px] leading-6 text-[#667085]">分类同时影响前台章节板块和后台筛选，必须清楚显示题目数量、启用状态和排序。</p>
            </div>
          </div>
          <div className="grid gap-5 border-t border-[#edf0f5] pt-5 sm:grid-cols-2 xl:w-[520px] xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <FeatureNote icon={RefreshCw} title="前台同步中" description="章节已更新 2 分钟前" />
            <FeatureNote icon={ListChecks} title="可批量排序" description="支持自定义排序号" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard tone="blue" icon={LayoutGrid} label="分类数" value={stats.categoryCount} hint="全部启用" />
        <MetricCard tone="green" icon={Link2} label="题目映射" value={stats.questionCount} hint="前台同步" />
        <MetricCard tone="orange" icon={FileText} label="草稿配置" value={stats.draftCount} hint="需检查" />
        <MetricCard tone="red" icon={CircleAlert} label="异常" value={stats.anomalyCount} hint="无缺失" />
      </div>

      <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <h2 className="text-[22px] font-semibold text-[#101828]">分类列表</h2>
        {questionCategoriesQuery.isLoading ? (
          <div className="mt-4 rounded-[8px] border border-dashed border-[#d0d5dd] bg-[#fbfcfe] px-6 py-12 text-center text-sm text-[#667085]">题目分类加载中...</div>
        ) : records.length === 0 ? (
          <div className="mt-4"><AdminEmptyState message="暂无题目分类。" /></div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 xl:grid-cols-3">
              {enabledCards.map((item) => (
                <CategoryCard
                  key={item.id}
                  item={item}
                  source={records.find((record) => record.id === item.id)}
                  onEdit={openEdit}
                  onDelete={remove}
                  onToggle={toggleEnabled}
                  onSort={openSort}
                  onViewQuestions={openQuestionList}
                />
              ))}
            </div>
            {draftCards.map((item) => (
              <DraftCategoryRow
                key={item.id}
                item={item}
                source={records.find((record) => record.id === item.id)}
                onEdit={openEdit}
                onDelete={remove}
                onToggle={toggleEnabled}
              />
            ))}
          </div>
        )}
      </section>

      <QuestionCategoryDialog
        open={open}
        editing={editing}
        form={form}
        groupOptions={groupOptions}
        designFields={designFields}
        onOpenChange={setOpen}
        onFormChange={setForm}
        onDesignFieldsChange={setDesignFields}
        onSubmit={submit}
      />

      <BatchSortDialog
        open={sortOpen}
        rows={sortRows}
        draggingIndex={draggingIndex}
        onOpenChange={setSortOpen}
        onRowsReset={() => setSortRows(buildSortableCategoryRows(records))}
        onSubmit={submitSort}
        onDragStart={setDraggingIndex}
        onDragEnd={() => setDraggingIndex(null)}
        onMove={moveSortRow}
      />

      <QuestionListDialog
        open={Boolean(questionListCategory)}
        category={questionListCategory}
        questions={questionPreviewQuery.data?.questions || []}
        total={questionPreviewQuery.data?.total || 0}
        page={questionPreviewPage}
        pageSize={QUESTION_PREVIEW_PAGE_SIZE}
        loading={questionPreviewQuery.isLoading || questionPreviewQuery.isFetching}
        onOpenChange={(next) => {
          if (!next) setQuestionListCategory(null);
        }}
        onPageChange={setQuestionPreviewPage}
      />
    </AdminPageShell>
  );
}

function FeatureNote({ icon: Icon, title, description }: { icon: typeof RefreshCw; title: string; description: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e8f1ff] text-[#1677ff]">
        <Icon size={24} />
      </div>
      <div>
        <div className="text-[16px] font-semibold text-[#101828]">{title}</div>
        <div className="mt-1 text-sm text-[#667085]">{description}</div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof LayoutGrid;
  label: string;
  value: number;
  hint: string;
  tone: "blue" | "green" | "orange" | "red";
}) {
  const toneClass = {
    blue: "bg-[#075ff7] text-white",
    green: "bg-[#12b76a] text-white",
    orange: "bg-[#ff9f1a] text-white",
    red: "bg-[#ff2d2d] text-white",
  }[tone];
  return (
    <div className="flex h-[124px] items-center rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-4">
        <div className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full ${toneClass}`}>
          <Icon size={26} />
        </div>
        <div>
          <div className="text-[16px] font-medium text-[#344054]">{label}</div>
          <div className="mt-1 text-[34px] font-semibold leading-none text-[#101828]">{value}</div>
          <div className="mt-1.5 text-[16px] text-[#667085]">{hint}</div>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({
  item,
  source,
  onEdit,
  onDelete,
  onToggle,
  onSort,
  onViewQuestions,
}: {
  item: ReturnType<typeof normalizeQuestionCategoryCards>[number];
  source?: QuestionCategoryRecord;
  onEdit: (item: QuestionCategoryRecord) => void;
  onDelete: (item: QuestionCategoryRecord) => void;
  onToggle: (item: QuestionCategoryRecord, nextEnabled: boolean) => void;
  onSort: () => void;
  onViewQuestions: (item: QuestionCategoryRecord) => void;
}) {
  const Icon = resolveCategoryIcon(item.iconKey);
  const toggleAction = buildQuestionCategoryQuickToggleLabel(item.enabled);
  const ToggleIcon = item.enabled ? PowerOff : Power;
  return (
    <article className="group flex h-[158px] flex-col overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition hover:border-[#b7d6ff] hover:shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
      <div className="relative flex min-h-0 flex-1 gap-4 px-5 py-4">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#e8f1ff] text-[#075ff7]">
          <Icon size={27} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[20px] font-semibold text-[#101828]" title={item.displayName}>{item.displayName}</h3>
          <p className="mt-1 min-h-[24px] truncate text-[16px] text-[#344054]" title={item.description}>{item.description || item.groupName || "分类说明待补充"}</p>
          <div className="mt-3 grid grid-cols-[minmax(58px,1fr)_84px_90px] items-center gap-3 text-[15px] text-[#344054]">
            <span>{item.questionCount} 题</span>
            <span className="inline-flex h-7 items-center justify-center rounded-[4px] bg-[#dff7ea] px-3 text-sm font-semibold text-[#039855]">{item.statusLabel}</span>
            <span>排序 {item.sortOrder}</span>
          </div>
        </div>
        {source ? (
          <button
            type="button"
            onClick={() => void onDelete(source)}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-transparent text-[#d92d20] transition hover:border-[#fda29b] hover:bg-[#fff1f0]"
            aria-label={`删除 ${item.name}`}
            title="删除"
          >
            <Trash2 size={17} />
          </button>
        ) : null}
      </div>
      <div className="grid h-[39px] grid-cols-4 border-t border-[#edf0f5] text-[15px] font-medium text-[#344054]">
        <CategoryActionButton disabled={!source} onClick={() => source && onEdit(source)} icon={Edit3} label="编辑" />
        <CategoryActionButton disabled={!source} onClick={() => source && onViewQuestions(source)} icon={ClipboardList} label="查看题目" />
        <CategoryActionButton disabled={!source} onClick={() => source && onToggle(source, toggleAction.nextEnabled)} icon={ToggleIcon} label={toggleAction.label} />
        <CategoryActionButton onClick={onSort} icon={Rows3} label="调整排序" />
      </div>
    </article>
  );
}

function DraftCategoryRow({
  item,
  source,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: ReturnType<typeof normalizeQuestionCategoryCards>[number];
  source?: QuestionCategoryRecord;
  onEdit: (item: QuestionCategoryRecord) => void;
  onDelete: (item: QuestionCategoryRecord) => void;
  onToggle: (item: QuestionCategoryRecord, nextEnabled: boolean) => void;
}) {
  const toggleAction = buildQuestionCategoryQuickToggleLabel(item.enabled);
  const ToggleIcon = item.enabled ? PowerOff : Power;
  return (
    <div className="flex min-h-[60px] items-center gap-4 rounded-[8px] border border-[#e5e7eb] bg-white px-4 text-[#344054]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef2f6] text-[#667085]">
        <Folder size={24} />
      </div>
      <div className="min-w-0 flex-1 truncate text-[18px] font-semibold">更多分类： <span className="font-medium">{item.displayName}</span></div>
      <div className="hidden text-[16px] md:block">{item.questionCount} 题</div>
      <div className="rounded-[4px] bg-[#eef2f6] px-4 py-1 text-sm font-semibold text-[#475467]">{item.statusLabel}</div>
      <div className="hidden text-[16px] md:block">排序 {item.sortOrder}</div>
      {source ? (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onEdit(source)} className="rounded-[4px] p-2 text-[#344054] hover:bg-[#f2f4f7] hover:text-[#1677ff]" aria-label={`编辑 ${item.name}`}>
            <Edit3 size={16} />
          </button>
          <button type="button" onClick={() => onToggle(source, toggleAction.nextEnabled)} className="rounded-[4px] p-2 text-[#344054] hover:bg-[#f2f4f7] hover:text-[#039855]" aria-label={`${toggleAction.label} ${item.name}`} title={toggleAction.label}>
            <ToggleIcon size={16} />
          </button>
          <button type="button" onClick={() => void onDelete(source)} className="rounded-[4px] p-2 text-[#344054] hover:bg-[#fff1f0] hover:text-[#d92d20]" aria-label={`删除 ${item.name}`}>
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CategoryActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Edit3;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 border-r border-[#edf0f5] transition last:border-r-0 hover:bg-[#f8fbff] hover:text-[#1677ff] disabled:cursor-not-allowed disabled:opacity-50">
      <Icon size={16} />
      {label}
    </button>
  );
}

function QuestionCategoryDialog({
  open,
  editing,
  form,
  groupOptions,
  designFields,
  onOpenChange,
  onFormChange,
  onDesignFieldsChange,
  onSubmit,
}: {
  open: boolean;
  editing: QuestionCategoryRecord | null;
  form: QuestionCategoryForm;
  groupOptions: string[];
  designFields: QuestionCategoryDesignFields;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: QuestionCategoryForm) => void;
  onDesignFieldsChange: (fields: QuestionCategoryDesignFields) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[90vh] w-[min(840px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-[8px] border-[#d0d5dd] bg-white p-0 shadow-[0_22px_60px_rgba(15,23,42,0.22)] sm:max-w-none">
        <DialogHeader className="border-b border-transparent px-8 pb-2 pt-7">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[24px] font-semibold text-[#101828]">{editing ? "编辑题目分类" : "新增题目分类"}</DialogTitle>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-[4px] p-2 text-[#344054] hover:bg-[#f2f4f7]" aria-label="关闭">
              <X size={22} />
            </button>
          </div>
          <DialogDescription className="sr-only">维护题目分类名称、说明、排序和启用状态。</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[calc(90vh-150px)] gap-6 overflow-y-auto px-8 pb-7 pt-3 lg:grid-cols-[minmax(0,1.5fr)_288px]">
          <div className="space-y-4">
            <HorizontalField label="分类名称" required>
              <CountedInput value={form.name} max={50} onChange={(value) => onFormChange({ ...form, name: value })} />
            </HorizontalField>
            <HorizontalField label="所属分组" required>
              <select value={form.groupName} onChange={(event) => onFormChange({ ...form, groupName: event.target.value })} className={inputClassName()}>
                <option value="">未分组</option>
                {groupOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </HorizontalField>
            <HorizontalField label="分类描述">
              <div className="relative">
                <textarea
                  value={form.description}
                  maxLength={200}
                  onChange={(event) => onFormChange({ ...form, description: event.target.value })}
                  className={`${textareaClassName()} min-h-[110px] pr-16`}
                />
                <span className="absolute bottom-3 right-3 text-sm text-[#667085]">{form.description.length}/200</span>
              </div>
            </HorizontalField>
            <HorizontalField label="前台显示名称" required>
              <CountedInput value={designFields.frontDisplayName} max={50} onChange={(value) => onDesignFieldsChange({ ...designFields, frontDisplayName: value })} />
            </HorizontalField>
            <HorizontalField label="排序值" required>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => onFormChange({ ...form, sortOrder: event.target.value })}
                className={inputClassName()}
              />
            </HorizontalField>
            <HorizontalField label="分类图标选择" required>
              <div>
                <div className="grid grid-cols-7 gap-3">
                  {iconOptions.map((item) => {
                    const Icon = item.icon;
                    const active = designFields.iconKey === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onDesignFieldsChange({ ...designFields, iconKey: item.key })}
                        className={`flex h-[52px] items-center justify-center rounded-[6px] border transition ${
                          active ? "border-[#1677ff] bg-[#eef5ff] text-[#1677ff] shadow-[0_0_0_1px_rgba(22,119,255,0.28)]" : "border-[#d0d5dd] bg-white text-[#344054] hover:border-[#4096ff]"
                        }`}
                        aria-label={item.label}
                      >
                        <Icon size={26} />
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm text-[#667085]">建议选择与分类内容相关的图标，便于前台识别</p>
              </div>
            </HorizontalField>
            <HorizontalField label="推荐难度">
              <select value={designFields.recommendedDifficulty} onChange={(event) => onDesignFieldsChange({ ...designFields, recommendedDifficulty: event.target.value })} className={inputClassName()}>
                {difficultyOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </HorizontalField>
            <HorizontalField label="是否启用">
              <div className="flex h-12 items-center justify-between rounded-[6px] border border-[#d0d5dd] bg-white px-4">
                <span className={`text-sm font-semibold ${form.enabled ? "text-[#039855]" : "text-[#667085]"}`}>{form.enabled ? "当前启用" : "当前停用"}</span>
                <Switch checked={Boolean(form.enabled)} onCheckedChange={(next) => onFormChange({ ...form, enabled: next })} className="h-[30px] w-[58px] data-[state=checked]:bg-[#1677ff]" />
              </div>
            </HorizontalField>
          </div>
          <aside className="rounded-[8px] border border-[#e5e7eb] bg-white p-6 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f1ff] text-[#1677ff]">
                <ListChecks size={30} />
                <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1677ff] text-[10px] font-semibold text-white">i</span>
              </div>
              <h3 className="text-[18px] font-semibold text-[#101828]">提示</h3>
            </div>
            <ul className="mt-7 space-y-5 text-[16px] leading-6 text-[#344054]">
              <li className="flex gap-3"><span>•</span><span>分类会影响前台章节板块</span></li>
              <li className="flex gap-3"><span>•</span><span>停用分类不会删除题目</span></li>
              <li className="flex gap-3"><span>•</span><span>排序值越小越靠前</span></li>
            </ul>
          </aside>
        </div>
        <DialogFooter className="border-t border-[#e5e7eb] bg-white px-8 py-5">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>取消</button>
          <button type="button" onClick={() => void onSubmit()} className={primaryButtonClassName()}>
            <Save size={16} />
            保存分类
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionListDialog({
  open,
  category,
  questions,
  total,
  page,
  pageSize,
  loading,
  onOpenChange,
  onPageChange,
}: {
  open: boolean;
  category: QuestionCategoryRecord | null;
  questions: NonNullable<AdminQuestionsResponse["questions"]>;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onPageChange: (page: number) => void;
}) {
  const rows = normalizeCategoryQuestionPreviewRows(questions);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[90vh] w-[min(900px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-[8px] border-[#d0d5dd] bg-white p-0 shadow-[0_22px_60px_rgba(15,23,42,0.22)] sm:max-w-none">
        <DialogHeader className="border-b border-[#e5e7eb] px-8 pb-5 pt-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-[24px] font-semibold text-[#101828]">分类题目列表</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-[#667085]">
                {category?.name || "当前分类"} · 共 {total} 题
              </DialogDescription>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-[4px] p-2 text-[#344054] hover:bg-[#f2f4f7]" aria-label="关闭">
              <X size={22} />
            </button>
          </div>
        </DialogHeader>
        <div className="max-h-[calc(90vh-190px)] overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="rounded-[8px] border border-dashed border-[#d0d5dd] bg-[#fbfcfe] px-6 py-12 text-center text-sm text-[#667085]">题目加载中...</div>
          ) : rows.length === 0 ? (
            <AdminEmptyState message="该分类下暂无题目。" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((item) => (
                <article key={item.id} className="rounded-[8px] border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-[#101828]" title={item.title}>{item.title}</h3>
                    <span className={`shrink-0 rounded-[4px] px-2.5 py-1 text-xs font-semibold ${item.statusLabel === "启用" ? "bg-[#dff7ea] text-[#039855]" : "bg-[#eef2f6] text-[#667085]"}`}>
                      {item.statusLabel}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#344054]">
                    <span className="rounded-[4px] bg-[#eef5ff] px-2.5 py-1 font-semibold text-[#1677ff]">{item.difficultyLabel}</span>
                    <span className="rounded-[4px] bg-[#f8fafc] px-2.5 py-1">{item.pointsLabel}</span>
                    <span className="text-[#667085]">ID {item.id}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="flex items-center justify-between border-t border-[#e5e7eb] bg-white px-8 py-5">
          <div className="text-sm text-[#667085]">第 {page} / {totalPages} 页</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1 || loading} className={secondaryButtonClassName()}>上一页</button>
            <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading} className={secondaryButtonClassName()}>下一页</button>
            <button type="button" onClick={() => onOpenChange(false)} className={primaryButtonClassName()}>关闭</button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchSortDialog({
  open,
  rows,
  draggingIndex,
  onOpenChange,
  onRowsReset,
  onSubmit,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  open: boolean;
  rows: SortableQuestionCategoryRow[];
  draggingIndex: number | null;
  onOpenChange: (open: boolean) => void;
  onRowsReset: () => void;
  onSubmit: () => void;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[90vh] w-[min(1080px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-[8px] border-[#d0d5dd] bg-white p-0 shadow-[0_22px_60px_rgba(15,23,42,0.22)] sm:max-w-none">
        <DialogHeader className="px-8 pb-3 pt-7">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[24px] font-semibold text-[#101828]">批量调整分类排序</DialogTitle>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-[4px] p-2 text-[#344054] hover:bg-[#f2f4f7]" aria-label="关闭">
              <X size={22} />
            </button>
          </div>
          <DialogDescription className="sr-only">拖动分类调整前台展示顺序。</DialogDescription>
        </DialogHeader>
        <div className="px-8">
          <div className="flex min-h-[48px] items-center gap-3 rounded-[6px] border border-[#b7d6ff] bg-[#eef5ff] px-4 text-[15px] text-[#344054]">
            <Info size={20} className="text-[#1677ff]" />
            拖动分类调整前台展示顺序。
          </div>
        </div>
        <div className="grid max-h-[calc(90vh-190px)] gap-7 overflow-y-auto px-8 py-6 lg:grid-cols-[minmax(0,1.3fr)_1px_minmax(340px,0.9fr)]">
          <section>
            <h3 className="text-[18px] font-semibold text-[#101828]">分类列表 <span className="text-sm font-normal text-[#667085]">（拖动调整排序）</span></h3>
            <div className="mt-4 grid grid-cols-[34px_minmax(0,1fr)_100px_100px_120px] px-5 text-sm text-[#667085]">
              <span aria-hidden="true" />
              <span>分类名称</span>
              <span>题目数</span>
              <span>状态</span>
              <span>排序值</span>
            </div>
            <div className="mt-3 space-y-2">
              {rows.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingIndex !== null) onMove(draggingIndex, index);
                    onDragEnd();
                  }}
                  onDragEnd={onDragEnd}
                  className={`grid min-h-[56px] cursor-grab grid-cols-[34px_minmax(0,1fr)_100px_100px_120px] items-center rounded-[6px] border bg-white px-4 text-[16px] text-[#344054] shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition ${
                    draggingIndex === index ? "border-[#1677ff] bg-[#f7fbff]" : "border-[#e5e7eb]"
                  }`}
                >
                  <GripVertical size={18} className="text-[#344054]" />
                  <div className="flex min-w-0 items-center gap-3">
                    <Folder size={18} className="text-[#1677ff]" fill="#1677ff" />
                    <span className="truncate font-semibold text-[#101828]">{item.name}</span>
                  </div>
                  <span>{item.questionCount} 题</span>
                  <span className="inline-flex h-7 w-14 items-center justify-center rounded-[4px] bg-[#dff7ea] text-sm font-semibold text-[#039855]">{item.enabled ? "启用" : "草稿"}</span>
                  <span className="font-semibold text-[#344054]">排序 {item.sortOrder}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="hidden bg-[#e5e7eb] lg:block" />
          <section>
            <h3 className="text-[18px] font-semibold text-[#101828]">前台章节预览</h3>
            <p className="mt-1 text-sm text-[#667085]">以下为前台展示顺序预览</p>
            <div className="mt-5 space-y-3">
              {rows.map((item, index) => (
                <div key={item.id} className="grid min-h-[56px] grid-cols-[42px_minmax(0,1fr)_70px] items-center rounded-[6px] border border-[#e5e7eb] bg-white px-4 text-[16px] text-[#344054]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#e8f1ff] font-semibold text-[#1677ff]">{index + 1}</span>
                  <span className="truncate font-semibold text-[#101828]">{item.name}</span>
                  <span>{item.questionCount} 题</span>
                </div>
              ))}
            </div>
          </section>
        </div>
        <DialogFooter className="border-t border-[#e5e7eb] bg-white px-8 py-5">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>取消</button>
          <button type="button" onClick={onRowsReset} className={secondaryButtonClassName()}>恢复默认</button>
          <button type="button" onClick={() => void onSubmit()} className={primaryButtonClassName()}>保存排序</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HorizontalField({
  label,
  required,
  compact,
  children,
}: {
  label: string;
  required?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`grid gap-3 ${compact ? "" : "sm:grid-cols-[108px_minmax(0,1fr)] sm:items-start"}`}>
      <span className="whitespace-nowrap pt-2 text-[16px] font-semibold text-[#101828]">
        {label} {required ? <span className="text-[#ff2d2d]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function CountedInput({ value, max, onChange }: { value: string; max: number; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <input value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} className={`${inputClassName()} pr-16`} />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#667085]">{value.length}/{max}</span>
    </div>
  );
}

function buildGroupOptions(records: QuestionCategoryRecord[], current: string | number | null | undefined) {
  const values = new Set<string>(["函数基础"]);
  records.forEach((item) => {
    if (item.groupName?.trim()) values.add(item.groupName.trim());
    if (item.name?.trim()) values.add(item.name.trim());
  });
  if (typeof current === "string" && current.trim()) values.add(current.trim());
  return [...values];
}

function getDesignFieldsFromRecord(item: QuestionCategoryRecord): QuestionCategoryDesignFields {
  return {
    frontDisplayName: item.frontDisplayName || item.name || "",
    iconKey: item.iconKey || DEFAULT_QUESTION_CATEGORY_DESIGN_FIELDS.iconKey,
    recommendedDifficulty: item.recommendedDifficulty || DEFAULT_QUESTION_CATEGORY_DESIGN_FIELDS.recommendedDifficulty,
  };
}

function getNextSortOrder(records: QuestionCategoryRecord[]) {
  const maxSort = records.reduce((max, item) => Math.max(max, Number(item.sortOrder || 0)), 0);
  return maxSort + 10;
}
