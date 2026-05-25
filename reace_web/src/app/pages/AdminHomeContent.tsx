import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  Bold,
  ChevronDown,
  ChevronRight,
  Code2,
  Edit3,
  Eraser,
  Eye,
  FileText,
  Folder,
  Heading2,
  Image as ImageIcon,
  Import,
  Italic,
  Link2,
  List,
  Minus,
  MoreHorizontal,
  Quote,
  Rows3,
  Save,
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
  const [editingCategory, setEditingCategory] = useState<TutorialCategoryRecord | null>(null);
  const [editingArticle, setEditingArticle] = useState<TutorialArticleRecord | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expandedCategoryId, setExpandedCategoryId] = useState("");
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>([]);
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
          <button type="button" onClick={() => navigate("/tutorials")} className={secondaryButtonClassName()}>
            <Eye size={16} />
            预览首页
          </button>
          <button type="button" onClick={() => toast("可通过分类排序和教程排序字段完成发布编排。")} className={secondaryButtonClassName()}>
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
                      <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{item.name}</span>
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
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <FileText size={15} className="shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{article.title || `教程 ${article.id}`}</span>
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
                  <button type="button" onClick={() => navigate("/tutorials")} className={secondaryButtonClassName()}>
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

      <FormDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        title={editingCategory ? "编辑首页分类" : "新增首页分类"}
        description="分类用于组织首页教程的父级容器。"
        submitLabel={editingCategory ? "保存分类" : "创建分类"}
        onSubmit={submitCategory}
      >
        <Field label="分类名称">
          <input value={categoryForm.name} onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))} className={inputClassName()} />
        </Field>
        <Field label="分类说明">
          <textarea value={categoryForm.description} onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))} className={textareaClassName()} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="排序">
            <input type="number" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm((prev) => ({ ...prev, sortOrder: Number(e.target.value || 0) }))} className={inputClassName()} />
          </Field>
          <AdminFormSwitch
            label="启用该分类"
            checked={Boolean(categoryForm.enabled)}
            onCheckedChange={(next) => setCategoryForm((prev) => ({ ...prev, enabled: next }))}
          />
        </div>
      </FormDialog>

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
      dangerouslySetInnerHTML={{ __html: value }}
    />
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
