import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, ImagePlus, LoaderCircle, Trash2, UploadCloud, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import {
  AddButton,
  AdminBulkActions,
  AdminBulkCheckbox,
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
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { normalizeResourceUrl } from "../lib/mappers";
import { adminKeys } from "../lib/query-keys";
import {
  formatTemplateCost,
  parseFunctionsInput,
  TEMPLATE_DIFFICULTY_LEVELS,
  TEMPLATE_INDUSTRY_CATEGORIES,
} from "../lib/template-center";
import { useSession } from "../lib/session";
import { openAdminConfirm, runAdminBulkDelete } from "./AdminConsoleShared";

type TemplateForm = {
  title: string;
  industryCategory: string;
  useScenario: string;
  previewImageUrl: string;
  templateDescription: string;
  functionsUsedText: string;
  difficultyLevel: string;
  downloadCostPoints: number;
  templateFileUrl: string;
  sortOrder: number;
  enabled: boolean;
};

type TemplateRecord = Omit<TemplateForm, "functionsUsedText"> & {
  id: number;
  functionsUsed?: string[];
  downloadCount?: number;
  updateTime?: string | null;
};

type AdminTemplatesResponse = {
  records?: TemplateRecord[];
  industryCategories?: string[];
  difficultyLevels?: string[];
};

const defaultForm: TemplateForm = {
  title: "",
  industryCategory: TEMPLATE_INDUSTRY_CATEGORIES[0],
  useScenario: "",
  previewImageUrl: "",
  templateDescription: "",
  functionsUsedText: "",
  difficultyLevel: TEMPLATE_DIFFICULTY_LEVELS[0],
  downloadCostPoints: 0,
  templateFileUrl: "",
  sortOrder: 0,
  enabled: true,
};

export function AdminTemplateCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const isAdmin = hasAdminConsoleAccess(user?.role) && user?.role === "admin";
  const previewInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TemplateRecord | null>(null);
  const [form, setForm] = useState<TemplateForm>(defaultForm);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const templatesQuery = useQuery({
    queryKey: adminKeys.templates({ industryCategory: filterCategory }),
    enabled: isAdmin,
    queryFn: async () => {
      try {
        const suffix = filterCategory ? `?industryCategory=${encodeURIComponent(filterCategory)}` : "";
        return await api.get<AdminTemplatesResponse>(`/api/admin/templates${suffix}`, { silent: true });
      } catch (error) {
        handleAdminError(error, navigate);
        return { records: [] };
      }
    },
  });

  const records = templatesQuery.data?.records || [];
  const bulkSelection = useAdminBulkSelection(records, (item) => item.id);
  const categoryOptions = useMemo(
    () => (templatesQuery.data?.industryCategories || TEMPLATE_INDUSTRY_CATEGORIES).map((item: string) => ({ value: item, label: item })),
    [templatesQuery.data?.industryCategories]
  );
  const difficultyOptions = useMemo(
    () => (templatesQuery.data?.difficultyLevels || TEMPLATE_DIFFICULTY_LEVELS).map((item: string) => ({ value: item, label: item })),
    [templatesQuery.data?.difficultyLevels]
  );

  if (!isAdmin) {
    return (
      <AdminPageShell>
        <AdminPermissionNotice message="仅管理员可配置模板中心。" />
      </AdminPageShell>
    );
  }

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.templates({ industryCategory: filterCategory }) });
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (item: TemplateRecord) => {
    setEditingItem(item);
    setForm({
      title: item.title || "",
      industryCategory: item.industryCategory || TEMPLATE_INDUSTRY_CATEGORIES[0],
      useScenario: item.useScenario || "",
      previewImageUrl: item.previewImageUrl || "",
      templateDescription: item.templateDescription || "",
      functionsUsedText: Array.isArray(item.functionsUsed) ? item.functionsUsed.join("，") : "",
      difficultyLevel: item.difficultyLevel || TEMPLATE_DIFFICULTY_LEVELS[0],
      downloadCostPoints: Number(item.downloadCostPoints || 0),
      templateFileUrl: item.templateFileUrl || "",
      sortOrder: Number(item.sortOrder || 0),
      enabled: Boolean(item.enabled),
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!String(form.title || "").trim()) {
      toast.error("请填写模板标题");
      return;
    }
    try {
      const payload = {
        title: form.title,
        industryCategory: form.industryCategory,
        useScenario: form.useScenario,
        previewImageUrl: form.previewImageUrl,
        templateDescription: form.templateDescription,
        functionsUsed: parseFunctionsInput(form.functionsUsedText || ""),
        difficultyLevel: form.difficultyLevel,
        downloadCostPoints: Number(form.downloadCostPoints || 0),
        templateFileUrl: form.templateFileUrl,
        sortOrder: Number(form.sortOrder || 0),
        enabled: Boolean(form.enabled),
      };
      if (editingItem?.id) {
        await api.put(`/api/admin/templates/${editingItem.id}`, payload);
      } else {
        await api.post("/api/admin/templates", payload);
      }
      setDialogOpen(false);
      await refreshAll();
      toast.success(editingItem ? "模板已更新" : "模板已创建");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  const deleteTemplate = async (item: TemplateRecord) => {
    if (!window.confirm(`确认删除模板“${item.title}”？`)) {
      return;
    }
    try {
      await api.delete(`/api/admin/templates/${item.id}`);
      await refreshAll();
      toast.success("模板已删除");
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  const deleteSelectedTemplates = async () => {
    const items = bulkSelection.selectedItems;
    if (items.length === 0 || bulkDeleting) return;
    const confirmed = await openAdminConfirm({
      title: "批量删除模板",
      message: `确认删除选中的 ${items.length} 个模板？`,
      confirmLabel: "删除选中",
      destructive: true,
    });
    if (!confirmed) return;
    setBulkDeleting(true);
    await runAdminBulkDelete({
      items,
      request: (item) => api.delete(`/api/admin/templates/${item.id}`),
      entityName: "模板",
      errorLabel: "批量删除模板",
      onRefresh: refreshAll,
      onFinally: () => {
        bulkSelection.clear();
        setBulkDeleting(false);
      },
    });
  };

  const uploadAsset = async (file: File, kind: "preview" | "template") => {
    const formData = new FormData();
    formData.append("file", file);
    if (kind === "preview") {
      setUploadingPreview(true);
    } else {
      setUploadingFile(true);
    }
    try {
      const result = await api.post<{ url: string }>("/api/upload", formData);
      if (kind === "preview") {
        setForm((prev) => ({ ...prev, previewImageUrl: result.url }));
      } else {
        setForm((prev) => ({ ...prev, templateFileUrl: result.url }));
      }
      toast.success(kind === "preview" ? "预览图上传成功" : "模板文件上传成功");
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      if (kind === "preview") {
        setUploadingPreview(false);
      } else {
        setUploadingFile(false);
      }
    }
  };

  return (
    <AdminPageShell>
      <AdminSection title="模板中心" actions={<AddButton onClick={openCreate}>新增模板</AddButton>}>
        <FilterBar>
          <FilterField label="行业分类">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={inputClassName()}>
              <option value="">全部分类</option>
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </FilterField>
        </FilterBar>

        <div className="mt-5">
          <AdminBulkActions
            selectedCount={bulkSelection.selectedCount}
            totalCount={records.length}
            allVisibleSelected={bulkSelection.allVisibleSelected}
            deleting={bulkDeleting}
            onToggleAll={bulkSelection.toggleAllVisible}
            onClear={bulkSelection.clear}
            onDeleteSelected={() => void deleteSelectedTemplates()}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">选择</TableHead>
                <TableHead>模板标题</TableHead>
                <TableHead>行业分类</TableHead>
                <TableHead>使用场景</TableHead>
                <TableHead>难度</TableHead>
                <TableHead>积分</TableHead>
                <TableHead>文件</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>启用</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <AdminBulkCheckbox
                      checked={bulkSelection.isSelected(item.id)}
                      onChange={() => bulkSelection.toggleOne(item.id)}
                      label={`选择模板 ${item.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 overflow-hidden rounded-[4px] border border-slate-200 bg-slate-50">
                        {item.previewImageUrl ? (
                          <img src={normalizeResourceUrl(item.previewImageUrl)} alt={item.title} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          函数 {Array.isArray(item.functionsUsed) ? item.functionsUsed.join("、") || "未配置" : "未配置"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{item.industryCategory || "-"}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{item.useScenario || "-"}</TableCell>
                  <TableCell>{item.difficultyLevel || "-"}</TableCell>
                  <TableCell>{formatTemplateCost(item.downloadCostPoints)}</TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-500">
                      <div>{item.templateFileUrl ? "已上传" : "未上传"}</div>
                      <div className="mt-1">下载 {item.downloadCount || 0}</div>
                    </div>
                  </TableCell>
                  <TableCell>{String(item.updateTime || "").replace("T", " ").slice(0, 16) || "-"}</TableCell>
                  <TableCell>
                    <AdminTableSwitch
                      checked={Boolean(item.enabled)}
                      onCheckedChange={async (next) => {
                        try {
                          await api.put(`/api/admin/templates/${item.id}`, {
                            title: item.title,
                            industryCategory: item.industryCategory,
                            useScenario: item.useScenario,
                            previewImageUrl: item.previewImageUrl,
                            templateDescription: item.templateDescription,
                            functionsUsed: item.functionsUsed || [],
                            difficultyLevel: item.difficultyLevel,
                            downloadCostPoints: item.downloadCostPoints,
                            templateFileUrl: item.templateFileUrl,
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
                      <button type="button" onClick={() => openEdit(item)} className={secondaryButtonClassName()}>
                        <Edit3 size={14} />
                        编辑
                      </button>
                      <button type="button" onClick={() => deleteTemplate(item)} className={secondaryButtonClassName()}>
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {records.length === 0 ? <div className="mt-4"><AdminEmptyState message="暂无模板数据。" /></div> : null}
        </div>
      </AdminSection>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingItem ? "编辑模板" : "新增模板"}
        description="模板中心字段全部在这里维护，预览图与模板文件支持直接上传。"
        submitLabel={editingItem ? "保存模板" : "创建模板"}
        onSubmit={submit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="模板标题">
            <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className={inputClassName()} />
          </Field>
          <Field label="行业分类">
            <select value={form.industryCategory} onChange={(e) => setForm((prev) => ({ ...prev, industryCategory: e.target.value }))} className={inputClassName()}>
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="难度等级">
            <select value={form.difficultyLevel} onChange={(e) => setForm((prev) => ({ ...prev, difficultyLevel: e.target.value }))} className={inputClassName()}>
              {difficultyOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>
          <Field label="下载消耗积分">
            <input type="number" min="0" value={form.downloadCostPoints} onChange={(e) => setForm((prev) => ({ ...prev, downloadCostPoints: Number(e.target.value || 0) }))} className={inputClassName()} />
          </Field>
          <Field label="排序">
            <input type="number" value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: Number(e.target.value || 0) }))} className={inputClassName()} />
          </Field>
        </div>

        <Field label="使用场景">
          <textarea value={form.useScenario} onChange={(e) => setForm((prev) => ({ ...prev, useScenario: e.target.value }))} className={textareaClassName()} />
        </Field>

        <Field label="模板说明">
          <textarea value={form.templateDescription} onChange={(e) => setForm((prev) => ({ ...prev, templateDescription: e.target.value }))} className={`${textareaClassName()} min-h-[160px]`} />
        </Field>

        <Field label="使用到的函数">
          <textarea
            value={form.functionsUsedText}
            onChange={(e) => setForm((prev) => ({ ...prev, functionsUsedText: e.target.value }))}
            className={textareaClassName()}
            placeholder="多个函数可用中文逗号、英文逗号或换行分隔"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="预览图">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input value={form.previewImageUrl} onChange={(e) => setForm((prev) => ({ ...prev, previewImageUrl: e.target.value }))} className={inputClassName()} placeholder="/uploads/preview.png" />
                <UploadActionButton
                  icon={ImagePlus}
                  loading={uploadingPreview}
                  label="上传预览图"
                  onClick={() => previewInputRef.current?.click()}
                />
                <input
                  ref={previewInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void uploadAsset(file, "preview");
                    }
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              {form.previewImageUrl ? (
                <img src={normalizeResourceUrl(form.previewImageUrl)} alt="模板预览图" className="h-32 w-full rounded-[6px] border border-slate-200 object-cover" />
              ) : null}
            </div>
          </Field>

          <Field label="模板文件">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input value={form.templateFileUrl} onChange={(e) => setForm((prev) => ({ ...prev, templateFileUrl: e.target.value }))} className={inputClassName()} placeholder="/uploads/template.xlsx" />
                <UploadActionButton
                  icon={UploadCloud}
                  loading={uploadingFile}
                  label="上传模板文件"
                  onClick={() => fileInputRef.current?.click()}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.doc,.docx,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void uploadAsset(file, "template");
                    }
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              <div className="break-all rounded-[4px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {form.templateFileUrl || "尚未上传模板文件"}
              </div>
            </div>
          </Field>
        </div>

        <AdminFormSwitch
          label="启用该模板"
          checked={Boolean(form.enabled)}
          onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
        />
      </FormDialog>
    </AdminPageShell>
  );
}

function UploadActionButton({
  icon: Icon,
  loading,
  label,
  onClick,
}: {
  icon: LucideIcon;
  loading: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex h-11 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Icon size={16} />}
      {loading ? "上传中..." : label}
    </button>
  );
}

function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: () => Promise<void> | void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden p-0 sm:max-w-none">
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
