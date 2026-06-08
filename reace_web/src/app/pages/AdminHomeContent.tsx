import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  BookOpenText,
  Bold,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Code2,
  Edit3,
  Eraser,
  Eye,
  FileText,
  Folder,
  Heading2,
  Image as ImageIcon,
  Import,
  Info,
  Italic,
  Link2,
  List,
  Minus,
  Monitor,
  MoreHorizontal,
  Quote,
  Rows3,
  Save,
  Smartphone,
  Star,
  Strikethrough,
  Table2,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import {
  AdminEmptyState,
  AdminPageShell,
  AdminPermissionNotice,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "../admin/shared";
import { hasAdminConsoleAccess } from "../admin/config";
import { api, ApiError } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { adminKeys } from "../lib/query-keys";
import { sanitizeRichHtml } from "../lib/rich-content";
import { useSession } from "../lib/session";

type FormDialogProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: () => Promise<void> | void;
  children: ReactNode;
};

type TutorialCategoryForm = {
  name: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
};

type TutorialCategoryRecord = TutorialCategoryForm & {
  id: number;
  articleCount?: number;
};

type TutorialArticleForm = {
  categoryId: string;
  title: string;
  summary: string;
  oneLineUsage: string;
  content: string;
  audienceTrack: string;
  difficulty: string;
  recommendLevel: number;
  functionTags: string;
  starter: boolean;
  homeFeatured: boolean;
  relatedChapterIds: number[];
  relatedQuestionIds: number[];
  sortOrder: number;
  enabled: boolean;
};

type TutorialArticleRecord = Omit<TutorialArticleForm, "categoryId"> & {
  id: number;
  categoryId: number | string;
  categoryName?: string | null;
};

type TutorialArticleListResponse = {
  records?: TutorialArticleRecord[];
};

type TutorialLinkOption = {
  id: number;
  name?: string | null;
  title?: string | null;
  description?: string | null;
};

type TutorialLinkOptionsResponse = {
  chapters?: TutorialLinkOption[];
  questions?: TutorialLinkOption[];
};

type PreviewDevice = "desktop" | "mobile";

type SortCategoryRow = {
  id: number;
  name: string;
  sortOrder: number;
};

type SortArticleRow = {
  id: number;
  title: string;
  sortOrder: number;
};

const defaultCategoryForm: TutorialCategoryForm = {
  name: "",
  description: "",
  sortOrder: 0,
  enabled: true,
};

const defaultArticleForm: TutorialArticleForm = {
  categoryId: "",
  title: "",
  summary: "",
  oneLineUsage: "",
  content: "",
  audienceTrack: "beginner",
  difficulty: "basic",
  recommendLevel: 1,
  functionTags: "",
  starter: false,
  homeFeatured: false,
  relatedChapterIds: [] as number[],
  relatedQuestionIds: [] as number[],
  sortOrder: 0,
  enabled: true,
};

export function AdminHomeContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const isAdmin = hasAdminConsoleAccess(user?.role) && user?.role === "admin";
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [articleOpen, setArticleOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewDevice>("desktop");
  const [sortOpen, setSortOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TutorialCategoryRecord | null>(null);
  const [editingArticle, setEditingArticle] = useState<TutorialArticleRecord | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expandedCategoryId, setExpandedCategoryId] = useState("");
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>([]);
  const [sortCategoryRows, setSortCategoryRows] = useState<SortCategoryRow[]>([]);
  const [sortArticleRows, setSortArticleRows] = useState<SortArticleRow[]>([]);
  const [categoryForm, setCategoryForm] = useState<TutorialCategoryForm>(defaultCategoryForm);
  const [articleForm, setArticleForm] = useState<TutorialArticleForm>(defaultArticleForm);

  const categoriesQuery = useQuery({
    queryKey: adminKeys.tutorialCategories(),
    enabled: isAdmin,
    queryFn: async () => {
      try {
        return await api.get<TutorialCategoryRecord[]>("/api/admin/tutorials/categories", { silent: true });
      } catch (error) {
        handleAdminError(error, navigate);
        return [];
      }
    },
  });
  const articlesQuery = useQuery({
    queryKey: adminKeys.tutorialArticles({ categoryId: categoryFilter }),
    enabled: isAdmin,
    queryFn: async () => {
      try {
        const suffix = categoryFilter ? `?categoryId=${categoryFilter}` : "";
        const result = await api.get<TutorialArticleListResponse>(`/api/admin/tutorials/articles${suffix}`, { silent: true });
        return result?.records || [];
      } catch (error) {
        handleAdminError(error, navigate);
        return [];
      }
    },
  });
  const articleLinkOptionsQuery = useQuery({
    queryKey: adminKeys.tutorialLinkOptions(),
    enabled: isAdmin,
    queryFn: async () => {
      try {
        return await api.get<TutorialLinkOptionsResponse>("/api/admin/tutorials/link-options", { silent: true });
      } catch (error) {
        handleAdminError(error, navigate);
        return { chapters: [], questions: [] };
      }
    },
  });

  const categories = categoriesQuery.data || [];
  const articles = articlesQuery.data || [];
  const chapterOptions = articleLinkOptionsQuery.data?.chapters || [];
  const questionOptions = articleLinkOptionsQuery.data?.questions || [];
  const categoryOptions = useMemo(
    () => categories.map((item) => ({ value: String(item.id), label: item.name })),
    [categories]
  );
  const selectedCategory = categories.find((item) => String(item.id) === categoryFilter) || categories[0] || null;
  const linkedQuestions = questionOptions.filter((item) => articleForm.relatedQuestionIds.includes(item.id));
  const linkedChapters = chapterOptions.filter((item) => articleForm.relatedChapterIds.includes(item.id));
  const selectedArticleCount = selectedArticleIds.length;
  const missingSummaryCount = articles.filter((item) => !String(item.summary || item.oneLineUsage || "").trim()).length;
  const unlinkedArticleCount = articles.filter((item) => !(item.relatedQuestionIds?.length || item.relatedChapterIds?.length)).length;
  const disabledCategoryCount = categories.filter((item) => !item.enabled).length;
  const sortConflictCount = countSortConflicts(categories) + countSortConflicts(articles);

  useEffect(() => {
    if (!isAdmin || categoryFilter || !categories[0]?.id) return;
    const firstCategoryId = String(categories[0].id);
    setCategoryFilter(firstCategoryId);
    setExpandedCategoryId(firstCategoryId);
  }, [categories, categoryFilter, isAdmin]);

  useEffect(() => {
    if (!isAdmin || articleOpen) return;
    if (editingArticle && !articles.some((item) => item.id === editingArticle.id)) {
      setEditingArticle(null);
      setArticleForm(defaultArticleForm);
    }
  }, [articles, articleOpen, editingArticle?.id, isAdmin]);

  useEffect(() => {
    const articleIdSet = new Set(articles.map((item) => item.id));
    setSelectedArticleIds((current) => current.filter((id) => articleIdSet.has(id)));
  }, [articles]);

  if (!isAdmin) {
    return (
      <AdminPageShell>
        <AdminPermissionNotice message="仅管理员可配置首页内容。" />
      </AdminPageShell>
    );
  }

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.tutorialCategories() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.tutorialArticles({ categoryId: categoryFilter }) }),
    ]);
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm(defaultCategoryForm);
    setCategoryOpen(true);
  };

  const openEditCategory = (item: TutorialCategoryRecord) => {
    setEditingCategory(item);
    setCategoryForm({
      name: item.name || "",
      description: item.description || "",
      sortOrder: item.sortOrder ?? 0,
      enabled: item.enabled ?? true,
    });
    setCategoryOpen(true);
  };

  const submitCategory = async () => {
    if (!String(categoryForm.name || "").trim()) {
      toast.error("请填写分类名称");
      return;
    }
    try {
      if (editingCategory?.id) {
        await api.put(`/api/admin/tutorials/categories/${editingCategory.id}`, categoryForm);
      } else {
        await api.post("/api/admin/tutorials/categories", categoryForm);
      }
      setCategoryOpen(false);
      await refreshAll();
      toast.success(editingCategory ? "分类已更新" : "分类已创建");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  const deleteCategory = async (item: TutorialCategoryRecord) => {
    if (!window.confirm(`确认删除分类“${item.name}”及其下所有教程？`)) {
      return;
    }
    try {
      await api.delete(`/api/admin/tutorials/categories/${item.id}`);
      await refreshAll();
      toast.success("分类已删除");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  const openCreateArticle = () => {
    setEditingArticle(null);
    setArticleForm({
      ...defaultArticleForm,
      categoryId: categoryFilter || categoryOptions[0]?.value || "",
    });
    setArticleOpen(true);
  };

  const toggleCategoryArticleList = (item: TutorialCategoryRecord) => {
    const nextCategoryId = String(item.id);
    const switchingCategory = categoryFilter !== nextCategoryId;
    setCategoryFilter(nextCategoryId);
    if (switchingCategory) {
      setEditingArticle(null);
      setArticleForm({ ...defaultArticleForm, categoryId: nextCategoryId });
      setSelectedArticleIds([]);
    }
    setExpandedCategoryId((current) => (current === nextCategoryId ? "" : nextCategoryId));
  };

  const openEditArticle = (item: TutorialArticleRecord) => {
    setEditingArticle(item);
    setArticleForm(toArticleForm(item));
  };

  const openPreview = () => {
    setPreviewOpen(true);
  };

  const selectPreviewCategory = (item: TutorialCategoryRecord) => {
    const nextCategoryId = String(item.id);
    setCategoryFilter(nextCategoryId);
    setExpandedCategoryId(nextCategoryId);
    setSelectedArticleIds([]);
  };

  const openBatchSort = () => {
    setSortCategoryRows(
      categories
        .map((item) => ({ id: item.id, name: item.name, sortOrder: item.sortOrder ?? 0 }))
        .sort((left, right) => left.sortOrder - right.sortOrder)
    );
    setSortArticleRows(
      articles
        .map((item) => ({ id: item.id, title: item.title || `教程 ${item.id}`, sortOrder: item.sortOrder ?? 0 }))
        .sort((left, right) => left.sortOrder - right.sortOrder)
    );
    setSortOpen(true);
  };

  const submitArticle = async () => {
    if (!String(articleForm.categoryId || "").trim()) {
      toast.error("请选择所属分类");
      return;
    }
    if (!String(articleForm.title || "").trim()) {
      toast.error("请填写条目标题");
      return;
    }
    try {
      const payload = {
        ...articleForm,
        categoryId: Number(articleForm.categoryId),
        recommendLevel: Number(articleForm.recommendLevel || 0),
      };
      if (editingArticle?.id) {
        await api.put(`/api/admin/tutorials/articles/${editingArticle.id}`, payload);
      } else {
        await api.post("/api/admin/tutorials/articles", payload);
      }
      setArticleOpen(false);
      await refreshAll();
      toast.success(editingArticle ? "条目已更新" : "条目已创建");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  const deleteSelectedArticles = async () => {
    if (!selectedArticleIds.length) return;
    const selectedSet = new Set(selectedArticleIds);
    const selectedItems = articles.filter((item) => selectedSet.has(item.id));
    const deleteCount = selectedItems.length || selectedArticleIds.length;
    if (!window.confirm(`确认删除选中的 ${deleteCount} 个教程？`)) {
      return;
    }
    try {
      for (const id of selectedArticleIds) {
        await api.delete(`/api/admin/tutorials/articles/${id}`);
      }
      if (editingArticle && selectedSet.has(editingArticle.id)) {
        setEditingArticle(null);
        setArticleForm({ ...defaultArticleForm, categoryId: categoryFilter });
      }
      setSelectedArticleIds([]);
      await refreshAll();
      toast.success("已删除所选教程");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  const submitBatchSort = async () => {
    try {
      for (const row of sortCategoryRows) {
        const source = categories.find((item) => item.id === row.id);
        if (!source || Number(source.sortOrder ?? 0) === Number(row.sortOrder || 0)) continue;
        await api.put(`/api/admin/tutorials/categories/${row.id}`, {
          name: source.name || "",
          description: source.description || "",
          enabled: source.enabled ?? true,
          sortOrder: Number(row.sortOrder || 0),
        });
      }
      for (const row of sortArticleRows) {
        const source = articles.find((item) => item.id === row.id);
        if (!source || Number(source.sortOrder ?? 0) === Number(row.sortOrder || 0)) continue;
        await api.put(`/api/admin/tutorials/articles/${row.id}`, {
          ...toArticleForm(source),
          categoryId: Number(source.categoryId),
          sortOrder: Number(row.sortOrder || 0),
        });
      }
      setSortOpen(false);
      await refreshAll();
      toast.success("排序已保存");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  return (
    <AdminPageShell
      title="首页内容"
      description="统一管理首页教程内容、分类结构与发布编排。"
      actions={
        <>
          <button type="button" onClick={openCreateArticle} disabled={!categoryOptions.length} className={primaryButtonClassName()}>
            <BookOpenText size={16} />
            新增教程
          </button>
          <button type="button" onClick={() => toast("Markdown 导入将沿用当前教程编辑流程。")} className={secondaryButtonClassName()}>
            <Import size={16} />
            导入 Markdown
          </button>
          <button type="button" onClick={openPreview} className={secondaryButtonClassName()}>
            <Eye size={16} />
            预览首页
          </button>
          <button type="button" onClick={openBatchSort} className={secondaryButtonClassName()}>
            <Rows3 size={16} />
            批量排序
          </button>
        </>
      }
    >
      <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#e8f1ff] text-[#1677ff]">
            <FileText size={30} />
          </div>
          <div>
            <h2 className="text-[22px] font-semibold text-[#101828]">教程内容编排</h2>
            <p className="mt-1 text-[15px] text-[#667085]">左侧按分类管理教程，右侧编辑文章内容、关联练习和发布设置。</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[282px_minmax(0,1fr)]">
        <aside className="flex min-h-[620px] flex-col rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-[#101828]">教程分类</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={openCreateCategory} className="text-sm font-semibold text-[#1677ff] hover:text-[#0958d9]">
                新增
              </button>
              <button
                type="button"
                onClick={() => void deleteSelectedArticles()}
                disabled={!selectedArticleCount}
                className="text-sm font-semibold text-[#d92d20] transition hover:text-[#b42318] disabled:cursor-not-allowed disabled:text-[#cbd5e1]"
              >
                删除所选
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {categories.map((item) => {
              const categoryId = String(item.id);
              const active = categoryId === String(selectedCategory?.id);
              const expanded = expandedCategoryId === categoryId;
              const visibleArticles = active ? articles : [];
              return (
                <div key={item.id} className="space-y-1">
                  <div
                    className={`group/category relative flex min-h-[54px] items-center gap-2 rounded-[6px] border-l-4 px-3 transition ${
                      active
                        ? "border-[#1677ff] bg-[#eef5ff] text-[#1677ff]"
                        : "border-transparent bg-white text-[#344054] hover:bg-[#f8fbff]"
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => toggleCategoryArticleList(item)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <Folder size={20} className={active ? "text-[#1677ff]" : "text-[#98a2b3]"} />
                      <span className="min-w-0 flex-1 truncate text-[16px] font-medium" title={item.name}>{item.name}</span>
                      <span className="text-[15px] text-[#667085]">{item.articleCount ?? 0}</span>
                    </button>
                    <div className="hidden shrink-0 items-center gap-1 group-hover/category:flex">
                      <button type="button" onClick={() => openEditCategory(item)} className="rounded-[4px] p-1 text-[#667085] hover:bg-white hover:text-[#1677ff]" aria-label="编辑分类">
                        <Edit3 size={14} />
                      </button>
                      <button type="button" onClick={() => void deleteCategory(item)} className="rounded-[4px] p-1 text-[#667085] hover:bg-white hover:text-[#d92d20]" aria-label="删除分类">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {expanded ? (
                    <div className="ml-5 space-y-1 border-l border-[#d8e6ff] pl-3">
                      {articlesQuery.isLoading ? (
                        <div className="rounded-[6px] bg-[#f8fbff] px-3 py-3 text-sm text-[#667085]">教程加载中...</div>
                      ) : visibleArticles.length > 0 ? (
                        visibleArticles.map((article) => {
                          const activeArticle = editingArticle?.id === article.id;
                          const checked = selectedArticleIds.includes(article.id);
                          return (
                            <div
                              key={article.id}
                              className={`flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left transition ${
                                activeArticle
                                  ? "bg-[#1677ff] text-white shadow-sm"
                                  : "text-[#344054] hover:bg-[#f2f6ff] hover:text-[#1677ff]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  setSelectedArticleIds((current) => toggleId(current, article.id, event.target.checked));
                                }}
                                aria-label={`选择 ${article.title || `教程 ${article.id}`}`}
                                className="h-4 w-4 shrink-0 rounded border-[#cbd5e1] accent-[#1677ff]"
                              />
                              <button
                                type="button"
                                onClick={() => openEditArticle(article)}
                                title={article.title || `教程 ${article.id}`}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <FileText size={15} className="shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={article.title || `教程 ${article.id}`}>{article.title || `教程 ${article.id}`}</span>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    activeArticle ? "bg-white/15 text-white" : "bg-[#eef2f6] text-[#667085]"
                                  }`}
                                >
                                  {difficultyLabel[article.difficulty] || "基础"} · Lv.{article.recommendLevel ?? 1}
                                </span>
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-[6px] border border-dashed border-[#d0d5dd] bg-[#fbfcfe] px-3 py-3 text-sm text-[#667085]">该分类暂无教程</div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {categories.length === 0 ? <AdminEmptyState message="暂无首页教程分类。" /> : null}
          </div>
        </aside>

        <main className="space-y-5">
          <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-[20px] font-semibold text-[#101828]">
                  编辑教程：{editingArticle?.title || "请选择左侧教程"}
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  {selectedCategory?.name ? `当前分类：${selectedCategory.name}` : "先展开左侧分类，再选择教程进行编辑。"}
                </p>
              </div>
              {editingArticle ? (
                <div className="flex items-center gap-2">
                <span className={`rounded-[4px] px-3 py-1 text-xs font-semibold ${articleForm.enabled ? "bg-[#dff7ea] text-[#039855]" : "bg-[#eef2f6] text-[#667085]"}`}>
                  {articleForm.enabled ? "已启用" : "未启用"}
                </span>
                <button type="button" onClick={() => void submitArticle()} disabled={!articleForm.categoryId || !articleForm.title.trim()} className={primaryButtonClassName()}>
                  <Save size={16} />
                  保存教程
                </button>
                </div>
              ) : null}
            </div>

            {!editingArticle && articles.length === 0 ? (
              <AdminEmptyState message="当前分类暂无教程，请点击右上角新增教程。" />
            ) : !editingArticle ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-[6px] border border-dashed border-[#d0d5dd] bg-[#fbfcfe] px-6 text-center">
                <div>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f1ff] text-[#1677ff]">
                    <BookOpenText size={26} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#101828]">从左侧教程列表选择内容</h3>
                  <p className="mt-2 text-sm text-[#667085]">展开分类后点击具体教程，编辑框会在这里打开。</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr]">
                  <Field label="标题">
                    <input value={articleForm.title} onChange={(e) => setArticleForm((prev) => ({ ...prev, title: e.target.value }))} className={inputClassName()} />
                  </Field>
                  <Field label="所属分类">
                    <select value={articleForm.categoryId} onChange={(e) => setArticleForm((prev) => ({ ...prev, categoryId: e.target.value }))} className={inputClassName()}>
                      {categoryOptions.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="难度 / 推荐等级">
                    <select
                      value={articleForm.difficulty}
                      onChange={(e) =>
                        setArticleForm((prev) => ({
                          ...prev,
                          difficulty: e.target.value,
                          recommendLevel: recommendLevelByDifficulty[e.target.value] || prev.recommendLevel,
                        }))
                      }
                      className={inputClassName()}
                    >
                      {Object.entries(difficultyLabel).map(([value, label]) => (
                        <option key={value} value={value}>{label} / Lv.{recommendLevelByDifficulty[value] || 1}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="标签">
                    <input value={articleForm.functionTags} onChange={(e) => setArticleForm((prev) => ({ ...prev, functionTags: e.target.value }))} placeholder="XLOOKUP, 查找, 匹配" className={inputClassName()} />
                  </Field>
                </div>
                <Field label="一句话说明">
                  <input value={articleForm.oneLineUsage} onChange={(e) => setArticleForm((prev) => ({ ...prev, oneLineUsage: e.target.value }))} className={inputClassName()} />
                </Field>
                <div className="rounded-[6px] border border-[#d0d5dd] bg-white">
                  <TutorialContentEditor
                    value={articleForm.content}
                    onChange={(next) => setArticleForm((prev) => ({ ...prev, content: next }))}
                  />
                </div>
              </div>
            )}
          </section>

          {editingArticle ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-[#101828]">关联练习</h2>
                <button
                  type="button"
                  onClick={() => {
                    if (editingArticle) {
                      setArticleOpen(true);
                    } else {
                      openCreateArticle();
                    }
                  }}
                  className="text-sm font-semibold text-[#1677ff] hover:text-[#0958d9]"
                >
                  管理关联
                </button>
              </div>
              <div className="space-y-2">
                {[...linkedQuestions, ...linkedChapters].slice(0, 4).map((item) => (
                  <div key={`${"title" in item ? "q" : "c"}-${item.id}`} className="flex min-h-12 items-center gap-3 rounded-[6px] border border-[#edf0f5] bg-white px-4">
                    <FileText size={18} className="text-[#1677ff]" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#344054]">{item.title || item.name}</span>
                    <span className="rounded-[4px] bg-[#dff7ea] px-2.5 py-1 text-xs font-semibold text-[#039855]">已关联</span>
                    <MoreHorizontal size={18} className="text-[#98a2b3]" />
                  </div>
                ))}
                {linkedQuestions.length + linkedChapters.length === 0 ? (
                  <div className="rounded-[6px] border border-dashed border-[#d0d5dd] bg-[#fbfcfe] px-4 py-8 text-center text-sm text-[#667085]">暂无关联练习</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (editingArticle) setArticleOpen(true);
                }}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[4px] border border-dashed border-[#1677ff] bg-white text-sm font-semibold text-[#1677ff] transition hover:bg-[#f0f7ff]"
              >
                <Upload size={16} />
                关联练习
              </button>
            </section>

            <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <h2 className="mb-4 text-[18px] font-semibold text-[#101828]">发布设置</h2>
              <div className="divide-y divide-[#edf0f5]">
                <SettingRow label="首页精选" hint="精选内容将在首页推荐位展示">
                  <Switch checked={Boolean(articleForm.homeFeatured)} onCheckedChange={(next) => setArticleForm((prev) => ({ ...prev, homeFeatured: next }))} />
                </SettingRow>
                <SettingRow label="排序" hint="数值越小越靠前">
                  <input
                    type="number"
                    value={articleForm.sortOrder}
                    onChange={(e) => setArticleForm((prev) => ({ ...prev, sortOrder: Number(e.target.value || 0) }))}
                    className="h-9 w-20 rounded-[4px] border border-[#d0d5dd] bg-white px-2 text-sm text-[#344054] outline-none focus:border-[#1677ff]"
                  />
                </SettingRow>
                <SettingRow label="启用状态" hint="启用后将在首页展示">
                  <Switch checked={Boolean(articleForm.enabled)} onCheckedChange={(next) => setArticleForm((prev) => ({ ...prev, enabled: next }))} />
                </SettingRow>
                <SettingRow label="预览按钮" hint="打开前台教程中心">
                  <button type="button" onClick={openPreview} className={secondaryButtonClassName()}>
                    <Eye size={16} />
                    预览
                  </button>
                </SettingRow>
              </div>
            </section>
          </div>
          ) : null}
        </main>
      </div>

      <CategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        editingCategory={editingCategory}
        form={categoryForm}
        setForm={setCategoryForm}
        onSubmit={submitCategory}
      />

      <HomeContentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        mode={previewMode}
        onModeChange={setPreviewMode}
        categories={categories}
        selectedCategory={selectedCategory}
        articles={articles}
        missingSummaryCount={missingSummaryCount}
        unlinkedArticleCount={unlinkedArticleCount}
        disabledCategoryCount={disabledCategoryCount}
        sortConflictCount={sortConflictCount}
        onSelectCategory={selectPreviewCategory}
        onReturnEdit={() => setPreviewOpen(false)}
        onConfirmPublish={() => {
          setPreviewOpen(false);
          toast.success("首页内容已确认");
        }}
      />

      <BatchSortDialog
        open={sortOpen}
        onOpenChange={setSortOpen}
        categoryRows={sortCategoryRows}
        articleRows={sortArticleRows}
        selectedCategoryName={selectedCategory?.name || ""}
        onCategoryRowsChange={setSortCategoryRows}
        onArticleRowsChange={setSortArticleRows}
        onSubmit={submitBatchSort}
      />

      <FormDialog
        open={articleOpen}
        onOpenChange={setArticleOpen}
        title={editingArticle ? "编辑教程" : "新增教程"}
        description="教程会作为分类下的子级内容展示到首页。"
        submitLabel={editingArticle ? "保存教程" : "创建教程"}
        onSubmit={submitArticle}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="所属分类">
            <select value={articleForm.categoryId} onChange={(e) => setArticleForm((prev) => ({ ...prev, categoryId: e.target.value }))} className={inputClassName()}>
              <option value="">请选择</option>
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>
          <Field label="排序">
            <input type="number" value={articleForm.sortOrder} onChange={(e) => setArticleForm((prev) => ({ ...prev, sortOrder: Number(e.target.value || 0) }))} className={inputClassName()} />
          </Field>
        </div>
        <Field label="条目标题">
          <input value={articleForm.title} onChange={(e) => setArticleForm((prev) => ({ ...prev, title: e.target.value }))} className={inputClassName()} />
        </Field>
        <Field label="一句话用途">
          <input value={articleForm.oneLineUsage} onChange={(e) => setArticleForm((prev) => ({ ...prev, oneLineUsage: e.target.value }))} className={inputClassName()} />
        </Field>
        <Field label="摘要">
          <textarea value={articleForm.summary} onChange={(e) => setArticleForm((prev) => ({ ...prev, summary: e.target.value }))} className={textareaClassName()} />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="学习轨道">
            <select value={articleForm.audienceTrack} onChange={(e) => setArticleForm((prev) => ({ ...prev, audienceTrack: e.target.value }))} className={inputClassName()}>
              {Object.entries(audienceTrackLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="难度等级">
            <select value={articleForm.difficulty} onChange={(e) => setArticleForm((prev) => ({ ...prev, difficulty: e.target.value }))} className={inputClassName()}>
              {Object.entries(difficultyLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="推荐权重">
            <input type="number" value={articleForm.recommendLevel} onChange={(e) => setArticleForm((prev) => ({ ...prev, recommendLevel: Number(e.target.value || 0) }))} className={inputClassName()} />
          </Field>
        </div>
        <Field label="函数标签">
          <input value={articleForm.functionTags} onChange={(e) => setArticleForm((prev) => ({ ...prev, functionTags: e.target.value }))} placeholder="例如：SUM, AVERAGE" className={inputClassName()} />
        </Field>
        <div className="block">
          <div className="mb-1.5 text-sm font-bold text-slate-700">正文内容</div>
          <TutorialContentEditor
            value={articleForm.content}
            onChange={(next) => setArticleForm((prev) => ({ ...prev, content: next }))}
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Field label="关联章节">
            <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="space-y-2">
                {chapterOptions.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={articleForm.relatedChapterIds.includes(item.id)}
                      onChange={(event) =>
                        setArticleForm((prev) => ({
                          ...prev,
                          relatedChapterIds: toggleId(prev.relatedChapterIds, item.id, event.target.checked),
                        }))
                      }
                    />
                    <span>
                      <span className="block font-semibold text-slate-800">{item.name}</span>
                      {item.description ? <span className="mt-0.5 block text-xs text-slate-400">{item.description}</span> : null}
                    </span>
                  </label>
                ))}
                {chapterOptions.length === 0 ? <div className="text-sm text-slate-400">暂无可关联章节</div> : null}
              </div>
            </div>
          </Field>
          <Field label="关联题目">
            <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="space-y-2">
                {questionOptions.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={articleForm.relatedQuestionIds.includes(item.id)}
                      onChange={(event) =>
                        setArticleForm((prev) => ({
                          ...prev,
                          relatedQuestionIds: toggleId(prev.relatedQuestionIds, item.id, event.target.checked),
                        }))
                      }
                    />
                    <span className="block font-semibold text-slate-800">{item.title}</span>
                  </label>
                ))}
                {questionOptions.length === 0 ? <div className="text-sm text-slate-400">暂无可关联题目</div> : null}
              </div>
            </div>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminFormSwitch
            label="标记为新手起步内容"
            checked={Boolean(articleForm.starter)}
            onCheckedChange={(next) => setArticleForm((prev) => ({ ...prev, starter: next }))}
          />
          <AdminFormSwitch
            label="在首页优先展示"
            checked={Boolean(articleForm.homeFeatured)}
            onCheckedChange={(next) => setArticleForm((prev) => ({ ...prev, homeFeatured: next }))}
          />
        </div>
        <AdminFormSwitch
          label="启用该条目"
          checked={Boolean(articleForm.enabled)}
          onCheckedChange={(next) => setArticleForm((prev) => ({ ...prev, enabled: next }))}
        />
      </FormDialog>
    </AdminPageShell>
  );
}

type ContentEditorMode = "content" | "preview" | "split";

const tutorialHtmlContentClass =
  "text-slate-700 [&_a]:font-semibold [&_a]:text-emerald-700 [&_blockquote]:mt-4 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-400 [&_blockquote]:bg-emerald-50 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_code]:font-mono [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-slate-950 [&_hr]:my-5 [&_hr]:border-slate-200 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_p]:leading-7 [&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-slate-100 [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6";

function TutorialContentEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [mode, setMode] = useState<ContentEditorMode>("content");
  const editorRef = useRef<HTMLDivElement>(null);
  const sourceValue = value || "";

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    if (editor.innerHTML !== sourceValue) {
      editor.innerHTML = sourceValue;
    }
  }, [mode, sourceValue]);

  const syncEditorContent = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML === "<br>" ? "" : editor.innerHTML;
    onChange(html);
  };

  const runEditorCommand = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, commandValue);
    syncEditorContent();
  };

  const insertHtml = (html: string) => runEditorCommand("insertHTML", html);

  const selectedText = () => window.getSelection()?.toString() || "";

  const actions: Array<{ label: string; icon: LucideIcon; onClick: () => void }> = [
    { label: "加粗", icon: Bold, onClick: () => runEditorCommand("bold") },
    { label: "斜体", icon: Italic, onClick: () => runEditorCommand("italic") },
    { label: "删除线", icon: Strikethrough, onClick: () => runEditorCommand("strikeThrough") },
    { label: "标题", icon: Heading2, onClick: () => insertHtml(`<h2>${escapeHtml(selectedText() || "小标题")}</h2><p><br></p>`) },
    { label: "列表", icon: List, onClick: () => runEditorCommand("insertUnorderedList") },
    { label: "引用", icon: Quote, onClick: () => insertHtml(`<blockquote>${escapeHtml(selectedText() || "引用内容")}</blockquote><p><br></p>`) },
    {
      label: "链接",
      icon: Link2,
      onClick: () => {
        const href = window.prompt("链接地址", "https://");
        if (!href) return;
        insertHtml(`<a href="${escapeHtml(href)}">${escapeHtml(selectedText() || "链接文本")}</a>`);
      },
    },
    {
      label: "图片",
      icon: ImageIcon,
      onClick: () => {
        const src = window.prompt("图片地址", "/uploads/example.png");
        if (!src) return;
        insertHtml(`<img src="${escapeHtml(src)}" alt="图片说明" />`);
      },
    },
    { label: "代码块", icon: Code2, onClick: () => insertHtml(`<pre><code>${escapeHtml(selectedText() || "=SUM(A1:A10)")}</code></pre><p><br></p>`) },
    {
      label: "表格",
      icon: Table2,
      onClick: () =>
        insertHtml(
          "<table><thead><tr><th>字段</th><th>说明</th></tr></thead><tbody><tr><td>示例</td><td>内容</td></tr></tbody></table><p><br></p>"
        ),
    },
    { label: "分割线", icon: Minus, onClick: () => runEditorCommand("insertHorizontalRule") },
    { label: "清除格式", icon: Eraser, onClick: () => runEditorCommand("removeFormat") },
  ];

  const editorTabs: Array<{ key: ContentEditorMode; label: string }> = [
    { key: "content", label: "内容" },
    { key: "preview", label: "预览" },
    { key: "split", label: "对照" },
  ];

  const renderToolbar = () => (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
      {actions.map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white hover:text-slate-950 hover:shadow-sm"
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );

  const renderVisualEditor = (compact = false) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {renderToolbar()}
      <div className="relative">
        {!sourceValue.trim() ? (
          <div className="pointer-events-none absolute left-6 top-5 text-sm text-slate-400">
            直接输入正文，工具栏可设置标题、列表、引用、链接、图片、代码块和表格。
          </div>
        ) : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncEditorContent}
          onBlur={syncEditorContent}
          className={`overflow-y-auto px-6 py-5 outline-none ${tutorialHtmlContentClass} ${compact ? "h-[320px]" : "h-[520px]"}`}
        />
      </div>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 pt-3">
        <div className="flex items-center gap-4">
          {editorTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={`border-b-2 px-1 pb-3 text-sm font-bold transition ${
                mode === item.key
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="pb-3 text-xs font-semibold text-slate-500">支持 HTML 标签渲染</div>
      </div>

      <div className="p-4">
        {mode === "content" ? renderVisualEditor() : null}
        {mode === "preview" ? <TutorialHtmlPreview value={sourceValue} /> : null}
        {mode === "split" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {renderVisualEditor(true)}
            <TutorialHtmlPreview value={sourceValue} compact />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TutorialHtmlPreview({ value, compact = false }: { value: string; compact?: boolean }) {
  if (!value.trim()) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400 ${compact ? "h-[320px]" : "h-[520px]"}`}>
        暂无正文内容
      </div>
    );
  }

  return (
    <div
      className={`overflow-auto rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-inner ${tutorialHtmlContentClass} ${compact ? "h-[320px]" : "h-[520px]"}`}
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value) }}
    />
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  editingCategory,
  form,
  setForm,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  editingCategory: TutorialCategoryRecord | null;
  form: TutorialCategoryForm;
  setForm: Dispatch<SetStateAction<TutorialCategoryForm>>;
  onSubmit: () => Promise<void> | void;
}) {
  const title = editingCategory ? "编辑教程分类" : "新增教程分类";
  const nameLength = String(form.name || "").length;
  const descriptionLength = String(form.description || "").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[min(760px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-[10px] border border-[#d0d5dd] bg-white p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#e5e7eb] px-6 py-5">
          <DialogTitle className="text-[18px] font-semibold text-[#101828]">{title}</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[1fr_255px]">
          <div className="space-y-5 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
              <label className="text-sm font-semibold text-[#344054]">
                分类名称 <span className="text-[#f04438]">*</span>
              </label>
              <div className="relative">
                <input
                  value={form.name}
                  maxLength={30}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="请输入分类名称"
                  className="h-10 w-full rounded-[4px] border border-[#d0d5dd] bg-white px-3 pr-14 text-sm text-[#101828] outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#e8f1ff]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#98a2b3]">{nameLength}/30</span>
              </div>
            </div>

            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-4">
              <label className="pt-2 text-sm font-semibold text-[#344054]">分类说明</label>
              <div className="relative">
                <textarea
                  value={form.description}
                  maxLength={120}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="请输入分类说明（选填）"
                  className="min-h-[76px] w-full resize-none rounded-[4px] border border-[#d0d5dd] bg-white px-3 py-2 pr-16 text-sm text-[#101828] outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#e8f1ff]"
                />
                <span className="absolute bottom-2 right-3 text-xs font-medium text-[#98a2b3]">{descriptionLength}/120</span>
              </div>
            </div>

            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
              <label className="text-sm font-semibold text-[#344054]">
                排序值 <span className="text-[#f04438]">*</span>
              </label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value || 0) }))}
                className="h-10 w-24 rounded-[4px] border border-[#d0d5dd] bg-white px-3 text-sm text-[#101828] outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#e8f1ff]"
              />
            </div>

            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
              <label className="text-sm font-semibold text-[#344054]">是否启用</label>
              <Switch checked={Boolean(form.enabled)} onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))} />
            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-[#344054]">首页显示样式预览</div>
              <div className="flex items-center gap-4 rounded-[6px] border border-[#d0d5dd] bg-white p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#e8f1ff] text-[#1677ff]">
                  <Folder size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold text-[#101828]">{form.name || "新分类名称"}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-[#667085]">
                    {form.description || "这里是分类说明的摘要展示，用于首页导航或分类卡片展示。"}
                  </div>
                </div>
                <div className="text-sm font-semibold text-[#667085]">{form.sortOrder || 0}</div>
              </div>
            </div>
          </div>

          <aside className="border-l border-[#e5e7eb] bg-[#fbfcfe] px-5 py-6">
            <div className="rounded-[6px] border border-[#bcd7ff] bg-[#f3f8ff] p-4 text-sm text-[#344054]">
              <div className="mb-2 flex items-center gap-2 font-semibold text-[#1677ff]">
                <Info size={16} />
                分类说明
              </div>
              <p className="leading-6">分类会影响首页教程导航，请确认排序和启用状态。</p>
            </div>
          </aside>
        </div>

        <DialogFooter className="border-t border-[#e5e7eb] bg-white px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>
            取消
          </button>
          <button type="button" onClick={() => void onSubmit()} className={primaryButtonClassName()}>
            保存分类
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HomeContentPreviewDialog({
  open,
  onOpenChange,
  mode,
  onModeChange,
  categories,
  selectedCategory,
  articles,
  missingSummaryCount,
  unlinkedArticleCount,
  disabledCategoryCount,
  sortConflictCount,
  onSelectCategory,
  onReturnEdit,
  onConfirmPublish,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  mode: PreviewDevice;
  onModeChange: (mode: PreviewDevice) => void;
  categories: TutorialCategoryRecord[];
  selectedCategory: TutorialCategoryRecord | null;
  articles: TutorialArticleRecord[];
  missingSummaryCount: number;
  unlinkedArticleCount: number;
  disabledCategoryCount: number;
  sortConflictCount: number;
  onSelectCategory: (item: TutorialCategoryRecord) => void;
  onReturnEdit: () => void;
  onConfirmPublish: () => void;
}) {
  const currentCategory = selectedCategory || categories[0] || null;
  const previewArticles = articles.slice(0, 4);
  const totalIssueCount = missingSummaryCount + unlinkedArticleCount + disabledCategoryCount + sortConflictCount;
  const previewWidthClass = mode === "mobile" ? "mx-auto max-w-[390px]" : "w-full";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(1180px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-[8px] border border-[#d0d5dd] bg-white p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#e5e7eb] px-6 py-5">
          <DialogTitle className="text-[18px] font-semibold text-[#101828]">首页内容预览</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onModeChange("desktop")}
              className={`inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-[4px] border px-4 text-sm font-semibold ${
                mode === "desktop" ? "border-[#1677ff] bg-[#f3f8ff] text-[#1677ff]" : "border-[#d0d5dd] bg-white text-[#344054]"
              }`}
            >
              <Monitor size={16} />
              桌面端
            </button>
            <button
              type="button"
              onClick={() => onModeChange("mobile")}
              className={`inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-[4px] border px-4 text-sm font-semibold ${
                mode === "mobile" ? "border-[#1677ff] bg-[#f3f8ff] text-[#1677ff]" : "border-[#d0d5dd] bg-white text-[#344054]"
              }`}
            >
              <Smartphone size={16} />
              移动端
            </button>
          </div>

          <div className={`grid gap-5 ${mode === "mobile" ? "grid-cols-1" : "lg:grid-cols-[225px_minmax(0,1fr)_270px]"} ${previewWidthClass}`}>
            <aside className="rounded-[6px] border border-[#d0d5dd] bg-white p-4">
              <h3 className="mb-4 text-[16px] font-semibold text-[#101828]">教程分类导航</h3>
              <div className="space-y-2">
                {categories.map((item) => {
                  const active = item.id === currentCategory?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.name}
                      onClick={() => onSelectCategory(item)}
                      className={`flex h-11 w-full items-center gap-2 rounded-[4px] border px-3 text-left text-sm transition ${
                        active ? "border-[#1677ff] bg-[#f3f8ff] text-[#1677ff]" : "border-transparent text-[#344054] hover:bg-[#f8fbff]"
                      }`}
                    >
                      <Folder size={17} />
                      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                      <span className="text-xs font-semibold">{item.articleCount ?? 0}</span>
                    </button>
                  );
                })}
                {categories.length === 0 ? <div className="rounded-[4px] border border-dashed border-[#d0d5dd] px-3 py-6 text-center text-sm text-[#98a2b3]">暂无分类</div> : null}
              </div>
            </aside>

            <main className="min-w-0">
              <div className="mb-4 overflow-hidden rounded-[6px] border border-[#d0d5dd] bg-gradient-to-r from-white to-[#dff8ee] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-[18px] font-semibold text-[#101828]">{currentCategory?.name || "请选择分类"}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-[#667085]">{currentCategory?.description || "分类说明会展示在这里，用于确认首页分类摘要。"}</p>
                  </div>
                  <div className="hidden h-16 w-36 shrink-0 items-center justify-center rounded-[4px] bg-white/70 text-[#1677ff] sm:flex">
                    <BookOpenText size={36} />
                  </div>
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between text-sm text-[#667085]">
                <span>共 {articles.length} 个教程</span>
                <span>排序：推荐排序</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {previewArticles.map((item) => (
                  <article key={item.id} className="rounded-[6px] border border-[#d0d5dd] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[#dff7ea] text-[#039855]">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-[#101828]" title={item.title}>{item.title || `教程 ${item.id}`}</h4>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#667085]">{item.summary || item.oneLineUsage || "暂无摘要"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {splitTags(item.functionTags).slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-[4px] bg-[#eef5ff] px-2.5 py-1 text-xs font-semibold text-[#1677ff]">{tag}</span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-[#667085]">
                      <span className="inline-flex items-center gap-1">
                        推荐等级：
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={index} size={13} fill={index < Math.min(5, (item.recommendLevel || 1) + 2) ? "currentColor" : "none"} className={index < Math.min(5, (item.recommendLevel || 1) + 2) ? "text-[#f59e0b]" : "text-[#cbd5e1]"} />
                        ))}
                        Lv.{item.recommendLevel ?? 1}
                      </span>
                      <Bookmark size={16} className="text-[#667085]" />
                    </div>
                  </article>
                ))}
                {previewArticles.length === 0 ? <div className="col-span-full rounded-[6px] border border-dashed border-[#d0d5dd] bg-[#fbfcfe] px-4 py-12 text-center text-sm text-[#98a2b3]">当前分类暂无教程</div> : null}
              </div>

              <button type="button" className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[4px] border border-[#d0d5dd] bg-white text-sm font-semibold text-[#1677ff]">
                查看全部 {articles.length} 个教程
                <ArrowRight size={16} />
              </button>
            </main>

            <aside className="space-y-4">
              <section className="rounded-[6px] border border-[#d0d5dd] bg-white p-4">
                <h3 className="mb-4 border-b border-[#e5e7eb] pb-3 text-[16px] font-semibold text-[#101828]">发布检查</h3>
                <PreviewCheckRow title="缺失摘要" hint="存在未填写摘要的教程" count={missingSummaryCount} />
                <PreviewCheckRow title="未关联练习" hint="存在未关联练习的教程" count={unlinkedArticleCount} />
                <PreviewCheckRow title="未启用分类" hint="所有分类均已启用" count={disabledCategoryCount} successWhenZero />
                <PreviewCheckRow title="排序冲突" hint="未检测到排序冲突" count={sortConflictCount} successWhenZero />
              </section>
              <section className="rounded-[6px] bg-[#edf5ff] p-4">
                <h3 className="text-[16px] font-semibold text-[#1677ff]">检查总结</h3>
                <p className="mt-2 text-sm leading-6 text-[#344054]">共检查 {categories.length + articles.length} 条内容，发现 {totalIssueCount} 个问题</p>
                <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1677ff]">
                  查看详情报告
                  <ArrowRight size={14} />
                </button>
              </section>
            </aside>
          </div>
        </div>

        <DialogFooter className="border-t border-[#e5e7eb] bg-white px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>
            关闭
          </button>
          <button type="button" onClick={onReturnEdit} className={secondaryButtonClassName()}>
            返回编辑
          </button>
          <button type="button" onClick={onConfirmPublish} className={primaryButtonClassName()}>
            确认发布
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewCheckRow({ title, hint, count, successWhenZero = false }: { title: string; hint: string; count: number; successWhenZero?: boolean }) {
  const ok = successWhenZero ? count === 0 : count === 0;
  return (
    <div className="flex items-center gap-3 border-b border-[#edf0f5] py-3 last:border-b-0">
      {ok ? <CheckCircle2 size={18} className="shrink-0 text-[#12b76a]" /> : <AlertCircle size={18} className="shrink-0 text-[#f79009]" />}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[#101828]">{title}</div>
        <div className="mt-1 text-xs text-[#667085]">{hint}</div>
      </div>
      <span className={`rounded-[4px] px-2.5 py-1 text-sm font-semibold ${ok ? "bg-[#dff7ea] text-[#039855]" : "bg-[#fff4e5] text-[#f79009]"}`}>{count} 个</span>
    </div>
  );
}

function BatchSortDialog({
  open,
  onOpenChange,
  categoryRows,
  articleRows,
  selectedCategoryName,
  onCategoryRowsChange,
  onArticleRowsChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  categoryRows: SortCategoryRow[];
  articleRows: SortArticleRow[];
  selectedCategoryName: string;
  onCategoryRowsChange: Dispatch<SetStateAction<SortCategoryRow[]>>;
  onArticleRowsChange: Dispatch<SetStateAction<SortArticleRow[]>>;
  onSubmit: () => Promise<void> | void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[min(920px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-[8px] border border-[#d0d5dd] bg-white p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#e5e7eb] px-6 py-5">
          <DialogTitle className="text-[18px] font-semibold text-[#101828]">批量排序</DialogTitle>
          <DialogDescription>调整分类与当前分类下教程的排序值，数值越小越靠前。</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto bg-[#f8fafc] p-6 lg:grid-cols-2">
          <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-4">
            <h3 className="mb-4 text-[16px] font-semibold text-[#101828]">教程分类排序</h3>
            <div className="space-y-2">
              {categoryRows.map((row) => (
                <div key={row.id} className="flex items-center gap-3 rounded-[6px] border border-[#edf0f5] bg-white px-3 py-2">
                  <Folder size={18} className="text-[#98a2b3]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#344054]" title={row.name}>{row.name}</span>
                  <input
                    type="number"
                    value={row.sortOrder}
                    onChange={(event) =>
                      onCategoryRowsChange((current) =>
                        current.map((item) => (item.id === row.id ? { ...item, sortOrder: Number(event.target.value || 0) } : item))
                      )
                    }
                    className="h-9 w-20 rounded-[4px] border border-[#d0d5dd] px-2 text-sm outline-none focus:border-[#1677ff]"
                  />
                </div>
              ))}
              {categoryRows.length === 0 ? <div className="rounded-[6px] border border-dashed border-[#d0d5dd] px-4 py-8 text-center text-sm text-[#98a2b3]">暂无分类</div> : null}
            </div>
          </section>

          <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-4">
            <h3 className="mb-1 text-[16px] font-semibold text-[#101828]">教程排序</h3>
            <p className="mb-4 text-sm text-[#667085]">{selectedCategoryName ? `当前分类：${selectedCategoryName}` : "请选择分类后排序教程"}</p>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {articleRows.map((row) => (
                <div key={row.id} className="flex items-center gap-3 rounded-[6px] border border-[#edf0f5] bg-white px-3 py-2">
                  <FileText size={18} className="text-[#98a2b3]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#344054]" title={row.title}>{row.title}</span>
                  <input
                    type="number"
                    value={row.sortOrder}
                    onChange={(event) =>
                      onArticleRowsChange((current) =>
                        current.map((item) => (item.id === row.id ? { ...item, sortOrder: Number(event.target.value || 0) } : item))
                      )
                    }
                    className="h-9 w-20 rounded-[4px] border border-[#d0d5dd] px-2 text-sm outline-none focus:border-[#1677ff]"
                  />
                </div>
              ))}
              {articleRows.length === 0 ? <div className="rounded-[6px] border border-dashed border-[#d0d5dd] px-4 py-8 text-center text-sm text-[#98a2b3]">当前分类暂无教程</div> : null}
            </div>
          </section>
        </div>

        <DialogFooter className="border-t border-[#e5e7eb] bg-white px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>
            取消
          </button>
          <button type="button" onClick={() => void onSubmit()} className={primaryButtonClassName()}>
            保存排序
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toArticleForm(item: TutorialArticleRecord): TutorialArticleForm {
  return {
    categoryId: String(item.categoryId || ""),
    title: item.title || "",
    summary: item.summary || "",
    oneLineUsage: item.oneLineUsage || "",
    content: item.content || "",
    audienceTrack: item.audienceTrack || "beginner",
    difficulty: item.difficulty || "basic",
    recommendLevel: item.recommendLevel ?? recommendLevelByDifficulty[item.difficulty || "basic"] ?? 1,
    functionTags: item.functionTags || "",
    starter: Boolean(item.starter),
    homeFeatured: Boolean(item.homeFeatured),
    relatedChapterIds: item.relatedChapterIds || [],
    relatedQuestionIds: item.relatedQuestionIds || [],
    sortOrder: item.sortOrder ?? 0,
    enabled: item.enabled ?? true,
  };
}

function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(840px,calc(100vw-2rem))] flex-col overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">{children}</div>
        </div>
        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>
            取消
          </button>
          <button type="button" onClick={() => void onSubmit()} className={primaryButtonClassName()}>
            {submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-bold text-slate-700">{label}</div>
      {children}
    </label>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[58px] items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium text-[#344054]">{label}</div>
        {hint ? <div className="mt-1 text-xs text-[#98a2b3]">{hint}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function AdminFormSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function handleAdminError(error: unknown, navigate: ReturnType<typeof useNavigate>) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      navigate(buildCurrentAuthRedirectPath());
      return;
    }
    if (error.status === 403) {
      navigate("/admin/overview");
      return;
    }
    toast.error(error.message || "后台请求失败");
    return;
  }
  toast.error("后台请求失败");
}

const audienceTrackLabel: Record<string, string> = {
  beginner: "新手入门",
  advanced: "进阶提升",
  general: "通用",
};

const difficultyLabel: Record<string, string> = {
  basic: "基础",
  medium: "中等",
  advanced: "进阶",
};

const recommendLevelByDifficulty: Record<string, number> = {
  basic: 1,
  medium: 2,
  advanced: 3,
};

function toggleId(values: number[], id: number, checked: boolean) {
  const next = new Set(values || []);
  if (checked) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return Array.from(next);
}

function splitTags(value?: string | null) {
  return String(value || "")
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function countSortConflicts(items: Array<{ sortOrder?: number }>) {
  const counts = new Map<number, number>();
  items.forEach((item) => {
    const key = Number(item.sortOrder ?? 0);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.values()).filter((count) => count > 1).length;
}
