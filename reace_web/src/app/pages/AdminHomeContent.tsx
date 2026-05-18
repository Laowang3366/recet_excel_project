import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bold,
  Code2,
  Edit3,
  Eraser,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Minus,
  Quote,
  Strikethrough,
  Table2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  AddButton,
  AdminEmptyState,
  AdminPageShell,
  AdminPermissionNotice,
  AdminSection,
  FilterBar,
  FilterField,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "../admin/shared";
import { hasAdminConsoleAccess } from "../admin/config";
import { api, ApiError } from "../lib/api";
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

  const openEditArticle = (item: TutorialArticleRecord) => {
    setEditingArticle(item);
    setArticleForm({
      categoryId: String(item.categoryId || ""),
      title: item.title || "",
      summary: item.summary || "",
      oneLineUsage: item.oneLineUsage || "",
      content: item.content || "",
      audienceTrack: item.audienceTrack || "beginner",
      difficulty: item.difficulty || "basic",
      recommendLevel: item.recommendLevel ?? 1,
      functionTags: item.functionTags || "",
      starter: Boolean(item.starter),
      homeFeatured: Boolean(item.homeFeatured),
      relatedChapterIds: item.relatedChapterIds || [],
      relatedQuestionIds: item.relatedQuestionIds || [],
      sortOrder: item.sortOrder ?? 0,
      enabled: item.enabled ?? true,
    });
    setArticleOpen(true);
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

  const deleteArticle = async (item: TutorialArticleRecord) => {
    if (!window.confirm(`确认删除条目“${item.title}”？`)) {
      return;
    }
    try {
      await api.delete(`/api/admin/tutorials/articles/${item.id}`);
      await refreshAll();
      toast.success("条目已删除");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  return (
    <AdminPageShell>
      <AdminSection title="首页教程分类" actions={<AddButton onClick={openCreateCategory}>新增分类</AddButton>}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>分类名称</TableHead>
              <TableHead>说明</TableHead>
              <TableHead>条目数</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>启用</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                <TableCell className="max-w-[420px] truncate">{item.description || "-"}</TableCell>
                <TableCell>{item.articleCount ?? 0}</TableCell>
                <TableCell>{item.sortOrder ?? 0}</TableCell>
                <TableCell>
                  <AdminTableSwitch
                    checked={Boolean(item.enabled)}
                    onCheckedChange={async (next) => {
                      try {
                        await api.put(`/api/admin/tutorials/categories/${item.id}`, {
                          name: item.name,
                          description: item.description,
                          sortOrder: item.sortOrder,
                          enabled: next,
                        });
                        await refreshAll();
                      } catch (error) {
                        handleAdminError(error, navigate);
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEditCategory(item)} className={secondaryButtonClassName()}>
                      <Edit3 size={14} />
                      编辑
                    </button>
                    <button type="button" onClick={() => deleteCategory(item)} className={secondaryButtonClassName()}>
                      <Trash2 size={14} />
                      删除
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {categories.length === 0 ? <div className="mt-4"><AdminEmptyState message="暂无首页教程分类。" /></div> : null}
      </AdminSection>

      <AdminSection title="首页教程条目" actions={<AddButton onClick={openCreateArticle} disabled={!categoryOptions.length}>新增条目</AddButton>}>
        <FilterBar>
          <FilterField label="分类筛选">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClassName()}>
              <option value="">全部分类</option>
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </FilterField>
        </FilterBar>

        <div className="mt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
              <TableHead>所属分类</TableHead>
              <TableHead>轨道 / 难度</TableHead>
              <TableHead>关联练习</TableHead>
              <TableHead>摘要</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>启用</TableHead>
              <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-bold text-slate-800">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-400">ID {item.id}</div>
                  </TableCell>
                  <TableCell>{item.categoryName || "-"}</TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold text-slate-700">{audienceTrackLabel[item.audienceTrack] || "通用"}</div>
                    <div className="mt-1 text-xs text-slate-400">{difficultyLabel[item.difficulty] || "基础"}</div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    章节 {item.relatedChapterIds?.length || 0} / 题目 {item.relatedQuestionIds?.length || 0}
                  </TableCell>
                  <TableCell className="max-w-[420px] truncate">{item.summary || "暂无摘要"}</TableCell>
                  <TableCell>{item.sortOrder ?? 0}</TableCell>
                  <TableCell>
                    <AdminTableSwitch
                      checked={Boolean(item.enabled)}
                      onCheckedChange={async (next) => {
                        try {
                          await api.put(`/api/admin/tutorials/articles/${item.id}`, {
                            categoryId: item.categoryId,
                            title: item.title,
                            summary: item.summary,
                            oneLineUsage: item.oneLineUsage,
                            content: item.content,
                            audienceTrack: item.audienceTrack,
                            difficulty: item.difficulty,
                            recommendLevel: item.recommendLevel,
                            functionTags: item.functionTags,
                            starter: item.starter,
                            homeFeatured: item.homeFeatured,
                            relatedChapterIds: item.relatedChapterIds || [],
                            relatedQuestionIds: item.relatedQuestionIds || [],
                            sortOrder: item.sortOrder,
                            enabled: next,
                          });
                          await refreshAll();
                        } catch (error) {
                          handleAdminError(error, navigate);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEditArticle(item)} className={secondaryButtonClassName()}>
                        <Edit3 size={14} />
                        编辑
                      </button>
                      <button type="button" onClick={() => deleteArticle(item)} className={secondaryButtonClassName()}>
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {articles.length === 0 ? <div className="mt-4"><AdminEmptyState message="暂无首页教程条目。" /></div> : null}
        </div>
      </AdminSection>

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
        title={editingArticle ? "编辑首页条目" : "新增首页条目"}
        description="条目会作为分类下的子级内容展示到首页。"
        submitLabel={editingArticle ? "保存条目" : "创建条目"}
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
          className={`overflow-auto px-6 py-5 outline-none ${tutorialHtmlContentClass} ${compact ? "min-h-[320px]" : "min-h-[360px]"}`}
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
      <div className={`flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400 ${compact ? "min-h-[320px]" : "min-h-[360px]"}`}>
        暂无正文内容
      </div>
    );
  }

  return (
    <div
      className={`overflow-auto rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-inner ${tutorialHtmlContentClass} ${compact ? "min-h-[320px]" : "min-h-[360px]"}`}
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

function AdminTableSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <span className={`text-xs font-bold ${checked ? "text-emerald-600" : "text-slate-400"}`}>
        {checked ? "已启用" : "未启用"}
      </span>
    </div>
  );
}

function handleAdminError(error: unknown, navigate: ReturnType<typeof useNavigate>) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      navigate("/auth");
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

function toggleId(values: number[], id: number, checked: boolean) {
  const next = new Set(values || []);
  if (checked) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return Array.from(next);
}
