import { useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Folder,
  Info,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Upload,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import {
  AdminPageShell,
  AdminPermissionNotice,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "../admin/shared";
import { hasAdminConsoleAccess } from "../admin/config";
import {
  buildTemplateHealthItems,
  buildTemplatePayload,
  buildTemplateStats,
  type AdminTemplateFormState,
  type AdminTemplateHealthItem,
  type AdminTemplateRecord,
  type AdminTemplateStats,
  type AdminTemplateStatusFilter,
} from "../admin/admin-template-center-view-model";
import { api, ApiError } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { normalizeResourceUrl } from "../lib/mappers";
import { adminKeys } from "../lib/query-keys";
import {
  TEMPLATE_DIFFICULTY_LEVELS,
  TEMPLATE_INDUSTRY_CATEGORIES,
  formatTemplateCost,
} from "../lib/template-center";
import { useSession } from "../lib/session";

type TemplateRecord = AdminTemplateRecord;

type AdminTemplatesResponse = {
  records?: TemplateRecord[];
  industryCategories?: string[];
  difficultyLevels?: string[];
  scenarioOptions?: string[];
  total?: number;
  page?: number;
  pageSize?: number;
  pageCount?: number;
  stats?: AdminTemplateStats;
  healthItems?: AdminTemplateHealthItem[];
};

type TemplateOperationsReport = {
  summary?: AdminTemplateStats & {
    missingMetadata?: number;
  };
  categoryStats?: Array<{ name: string; templateCount: number; downloadCount: number }>;
  difficultyStats?: Array<{ name: string; templateCount: number; downloadCount: number }>;
  topTemplates?: Array<{ id: number; title: string; industryCategory: string; useScenario: string; downloadCount: number; enabled: boolean }>;
};

type DialogMode = "create" | "edit" | null;

const PAGE_SIZE_OPTIONS = [6, 12, 24];

const defaultForm: AdminTemplateFormState = {
  title: "",
  industryCategory: TEMPLATE_INDUSTRY_CATEGORIES[0],
  useScenario: "",
  previewImageUrl: "",
  templateDescription: "",
  functionsUsedText: "",
  difficultyLevel: "基础",
  downloadCostPoints: 0,
  templateFileUrl: "",
  fileName: "",
  fileSize: 0,
  fileVersion: "1.0.0",
  sortOrder: 10,
  enabled: true,
  usageGuide: "",
};

export function AdminTemplateCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const isAdmin = hasAdminConsoleAccess(user?.role) && user?.role === "admin";
  const previewInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState({
    industryCategory: "",
    useScenario: "",
    difficultyLevel: "",
    status: "" as AdminTemplateStatusFilter,
    keyword: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingItem, setEditingItem] = useState<TemplateRecord | null>(null);
  const [previewItem, setPreviewItem] = useState<TemplateRecord | null>(null);
  const [form, setForm] = useState<AdminTemplateFormState>(defaultForm);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const templatesQuery = useQuery({
    queryKey: adminKeys.templates({ ...filters, page, pageSize }),
    enabled: isAdmin,
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (filters.industryCategory) params.set("industryCategory", filters.industryCategory);
        if (filters.useScenario) params.set("useScenario", filters.useScenario);
        if (filters.difficultyLevel) params.set("difficultyLevel", filters.difficultyLevel);
        if (filters.status) params.set("status", filters.status);
        if (filters.keyword) params.set("keyword", filters.keyword);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        return await api.get<AdminTemplatesResponse>(`/api/admin/templates?${params.toString()}`, { silent: true });
      } catch (error) {
        handleAdminError(error, navigate);
        return { records: [] };
      }
    },
  });

  const reportQuery = useQuery({
    queryKey: adminKeys.templates({ report: true }),
    enabled: isAdmin && reportOpen,
    queryFn: async () => api.get<TemplateOperationsReport>("/api/admin/templates/operations-report", { silent: true }),
  });

  const records = templatesQuery.data?.records || [];
  const categoryOptions = templatesQuery.data?.industryCategories || [...TEMPLATE_INDUSTRY_CATEGORIES];
  const difficultyOptions = Array.from(new Set(templatesQuery.data?.difficultyLevels || ["基础", "中级", "高级", ...TEMPLATE_DIFFICULTY_LEVELS]));
  const scenarioOptions = templatesQuery.data?.scenarioOptions || [];
  const paged = {
    page: templatesQuery.data?.page || page,
    pageSize: templatesQuery.data?.pageSize || pageSize,
    pageCount: templatesQuery.data?.pageCount || 1,
    total: templatesQuery.data?.total ?? records.length,
    records,
  };
  const stats = templatesQuery.data?.stats || buildTemplateStats(records);
  const healthItems = templatesQuery.data?.healthItems || buildTemplateHealthItems(records);

  if (!isAdmin) {
    return (
      <AdminPageShell>
        <AdminPermissionNotice message="仅管理员可配置模板中心。" />
      </AdminPageShell>
    );
  }

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "templates"] });
  };

  const updateFilters = (patch: Partial<typeof filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({
      industryCategory: "",
      useScenario: "",
      difficultyLevel: "",
      status: "",
      keyword: "",
    });
    setPage(1);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogMode("create");
  };

  const openEdit = (item: TemplateRecord) => {
    setEditingItem(item);
    setForm(toFormState(item, false));
    setDialogMode("edit");
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingItem(null);
    setSaving(false);
  };

  const submitTemplate = async (nextEnabled?: boolean) => {
    if (!String(form.title || "").trim()) {
      toast.error("请填写模板标题");
      return;
    }

    setSaving(true);
    try {
      const payload = buildTemplatePayload({
        ...form,
        enabled: typeof nextEnabled === "boolean" ? nextEnabled : form.enabled,
      });

      if (editingItem?.id) {
        await api.put(`/api/admin/templates/${editingItem.id}`, payload);
      } else {
        await api.post("/api/admin/templates", payload);
      }
      closeDialog();
      await refreshAll();
      toast.success(editingItem ? "模板已更新" : "模板已创建");
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setSaving(false);
    }
  };

  const updateTemplateStatus = async (item: TemplateRecord, enabled: boolean) => {
    try {
      await api.put(`/api/admin/templates/${item.id}`, buildTemplatePayload({ ...toFormState(item, false), enabled }));
      await refreshAll();
      toast.success(enabled ? "模板已上架" : "模板已下架");
    } catch (error) {
      handleAdminError(error, navigate);
    }
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
        setForm((prev) => ({
          ...prev,
          templateFileUrl: result.url,
          fileName: file.name,
          fileSize: file.size,
          fileVersion: prev.fileVersion || "1.0.0",
        }));
      }
      toast.success(kind === "preview" ? "封面上传成功" : "模板文件上传成功");
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

  const handleBatchUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    setUploadingBatch(true);
    try {
      const result = await api.post<{ createdCount?: number }>("/api/admin/templates/batch-upload", formData);
      await refreshAll();
      toast.success(`已创建 ${result.createdCount || files.length} 个模板草稿`);
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setUploadingBatch(false);
    }
  };

  const actions = (
    <>
      <button type="button" onClick={() => batchInputRef.current?.click()} disabled={uploadingBatch} className={secondaryButtonClassName()}>
        {uploadingBatch ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
        {uploadingBatch ? "上传中" : "批量上传"}
      </button>
      <input
        ref={batchInputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleBatchUpload(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <button type="button" onClick={openCreate} className={primaryButtonClassName()}>
        <Plus size={16} />
        新增模板
      </button>
    </>
  );

  return (
    <AdminPageShell actions={actions}>
      <TemplateFilterPanel
        filters={filters}
        categories={categoryOptions}
        scenarios={scenarioOptions}
        difficulties={difficultyOptions}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      <div className="grid gap-5 xl:grid-cols-4">
        <TemplateStatCard icon={Folder} label="模板数" value={stats.total} hint={`上架 ${stats.enabled}`} tone="blue" />
        <TemplateStatCard icon={Download} label="今日下载" value={stats.downloads} hint="较昨日 +8% ↗" tone="green" />
        <TemplateStatCard icon={FileText} label="草稿" value={stats.drafts} hint="待补资料" tone="orange" />
        <TemplateStatCard icon={ShieldAlert} label="缺失文件" value={stats.missingFiles} hint={stats.missingFiles === 0 ? "正常" : "需处理"} tone="red" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
          {templatesQuery.isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm font-semibold text-[#667085]">
              <LoaderCircle size={18} className="mr-2 animate-spin" />
              正在加载模板
            </div>
          ) : paged.total === 0 ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[8px] border border-dashed border-[#d0d5dd] bg-[#fbfcfe] text-sm text-[#667085]">
              暂无匹配模板
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {paged.records.map((item) => (
                  <TemplateCard
                    key={item.id}
                    item={item}
                    onEdit={() => openEdit(item)}
                    onPreview={() => setPreviewItem(item)}
                    onToggleStatus={() => void updateTemplateStatus(item, !item.enabled)}
                  />
                ))}
              </div>
              <TemplatePagination
                page={paged.page}
                pageSize={paged.pageSize}
                pageCount={paged.pageCount}
                total={paged.total}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(1);
                }}
              />
            </>
          )}
        </section>

        <aside className="space-y-4">
          <TemplateHealthPanel
            items={healthItems}
            onRefresh={() => void refreshAll()}
            onAction={(key) => {
              if (key === "missingFiles") updateFilters({ status: "" });
              if (key === "missingMetadata") updateFilters({ keyword: "" });
              if (key === "drafts") updateFilters({ status: "draft" });
            }}
          />
          <AdminTipsPanel onOpenReport={() => setReportOpen(true)} />
        </aside>
      </div>

      <EditTemplateDialog
        open={dialogMode === "edit"}
        form={form}
        item={editingItem}
        categoryOptions={categoryOptions}
        scenarioOptions={scenarioOptions}
        difficultyOptions={difficultyOptions}
        saving={saving}
        uploadingFile={uploadingFile}
        onClose={closeDialog}
        onChange={setForm}
        onSubmit={() => void submitTemplate()}
        onReplaceFile={() => fileInputRef.current?.click()}
      />

      <CreateTemplateDrawer
        open={dialogMode === "create"}
        form={form}
        categoryOptions={categoryOptions}
        scenarioOptions={scenarioOptions}
        difficultyOptions={difficultyOptions}
        saving={saving}
        uploadingPreview={uploadingPreview}
        uploadingFile={uploadingFile}
        onClose={closeDialog}
        onChange={setForm}
        onUploadPreview={() => previewInputRef.current?.click()}
        onUploadFile={() => fileInputRef.current?.click()}
        onSaveDraft={() => void submitTemplate(false)}
        onPublish={() => void submitTemplate(true)}
      />

      <TemplatePreviewDialog item={previewItem} onClose={() => setPreviewItem(null)} />
      <TemplateReportDialog
        open={reportOpen}
        report={reportQuery.data}
        loading={reportQuery.isLoading}
        onClose={() => setReportOpen(false)}
      />

      <input
        ref={previewInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadAsset(file, "preview");
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadAsset(file, "template");
          event.currentTarget.value = "";
        }}
      />
    </AdminPageShell>
  );
}

function TemplateFilterPanel({
  filters,
  categories,
  scenarios,
  difficulties,
  onChange,
  onReset,
}: {
  filters: {
    industryCategory: string;
    useScenario: string;
    difficultyLevel: string;
    status: AdminTemplateStatusFilter;
    keyword: string;
  };
  categories: string[];
  scenarios: string[];
  difficulties: string[];
  onChange: (patch: Partial<typeof filters>) => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_auto_auto]">
        <FilterSelect label="行业分类" value={filters.industryCategory} placeholder="全部行业" options={categories} onChange={(value) => onChange({ industryCategory: value })} />
        <FilterSelect label="使用场景" value={filters.useScenario} placeholder="全部场景" options={scenarios} onChange={(value) => onChange({ useScenario: value })} />
        <FilterSelect label="难度" value={filters.difficultyLevel} placeholder="全部难度" options={difficulties} onChange={(value) => onChange({ difficultyLevel: value })} />
        <FilterSelect
          label="上下架"
          value={filters.status}
          placeholder="全部状态"
          options={[
            { value: "enabled", label: "上架中" },
            { value: "draft", label: "草稿/下架" },
          ]}
          onChange={(value) => onChange({ status: value as AdminTemplateStatusFilter })}
        />
        <label className="block min-w-0">
          <div className="mb-2 text-sm font-semibold text-[#172033]">关键词</div>
          <div className="flex h-11 items-center gap-2 rounded-[4px] border border-[#d5deeb] bg-white px-3">
            <Search size={17} className="text-[#7a8aaa]" />
            <input
              type="search"
              value={filters.keyword}
              onChange={(event) => onChange({ keyword: event.target.value })}
              placeholder="搜索模板标题、行业、场景"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#26344d] outline-none placeholder:text-[#98a2b3]"
            />
          </div>
        </label>
        <div className="flex items-end">
          <button type="button" onClick={() => onChange({})} className={`${primaryButtonClassName()} w-full min-w-[88px]`}>
            搜索
          </button>
        </div>
        <div className="flex items-end">
          <button type="button" onClick={onReset} className={`${secondaryButtonClassName()} w-full min-w-[88px]`}>
            重置
          </button>
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <div className="mb-2 text-sm font-semibold text-[#172033]">{label}</div>
      <div className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClassName()} h-11 appearance-none pr-9`}>
          <option value="">{placeholder}</option>
          {options.map((option) => {
            const normalized = typeof option === "string" ? { value: option, label: option } : option;
            return (
              <option key={normalized.value} value={normalized.value}>
                {normalized.label}
              </option>
            );
          })}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a8aaa]" />
      </div>
    </label>
  );
}

function TemplateStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint: ReactNode;
  tone: "blue" | "green" | "orange" | "red";
}) {
  const toneClass = {
    blue: "bg-[#0f63ff] text-white shadow-[0_12px_26px_rgba(15,99,255,0.28)]",
    green: "bg-[#12b76a] text-white shadow-[0_12px_26px_rgba(18,183,106,0.28)]",
    orange: "bg-[#ff9500] text-white shadow-[0_12px_26px_rgba(255,149,0,0.25)]",
    red: "bg-[#ff1f3d] text-white shadow-[0_12px_26px_rgba(255,31,61,0.24)]",
  }[tone];

  return (
    <div className="rounded-[8px] border border-[#e5eaf3] bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-5">
        <div className={`flex h-[70px] w-[70px] items-center justify-center rounded-full ${toneClass}`}>
          <Icon size={34} />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[#344054]">{label}</div>
          <div className="mt-1 text-[30px] font-semibold leading-none text-[#101828]">{value}</div>
          <div className={`mt-3 text-sm font-semibold ${tone === "red" ? "text-[#039855]" : tone === "orange" ? "text-[#ff6a00]" : "text-[#12b76a]"}`}>{hint}</div>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  item,
  onEdit,
  onPreview,
  onToggleStatus,
}: {
  item: TemplateRecord;
  onEdit: () => void;
  onPreview: () => void;
  onToggleStatus: () => void;
}) {
  const difficultyTone = getDifficultyTone(item.difficultyLevel);

  return (
    <article className="rounded-[8px] border border-[#dfe7f3] bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
      <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-4">
        <TemplateCover imageUrl={item.previewImageUrl} title={item.title || "模板预览"} className="h-[138px]" />
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-[17px] font-semibold text-[#101828]">{item.title || "未命名模板"}</h3>
            <StatusPill enabled={Boolean(item.enabled)} />
          </div>
          <TemplateMeta label="行业" value={item.industryCategory || "未填写"} />
          <TemplateMeta label="场景" value={item.useScenario || "未填写"} />
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-[#475467]">难度：</span>
            <span className={`rounded-[4px] px-2 py-0.5 text-xs font-semibold ${difficultyTone}`}>{item.difficultyLevel || "基础"}</span>
          </div>
          <TemplateMeta label="积分" value={formatTemplateCost(item.downloadCostPoints)} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <CardActionButton icon={Pencil} label="编辑" onClick={onEdit} />
        <CardActionButton icon={Eye} label="预览" onClick={onPreview} />
        <CardActionButton icon={item.enabled ? Upload : Send} label={item.enabled ? "上下架" : "发布"} onClick={onToggleStatus} active={!item.enabled} />
      </div>
    </article>
  );
}

function TemplateCover({ imageUrl, title, className = "" }: { imageUrl?: string | null; title: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[4px] border border-[#dbe4f0] bg-[#f8fafc] ${className}`}>
      {imageUrl ? (
        <img src={normalizeResourceUrl(imageUrl)} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full p-2">
          <div className="h-full rounded-[3px] bg-white p-2 shadow-inner">
            <div className="grid grid-cols-3 gap-1">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-4 rounded-[2px] bg-[#eef4ff]" />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="h-10 rounded-[3px] border border-[#dbeafe] bg-[linear-gradient(135deg,#e0f2fe,#eff6ff)]" />
              <div className="h-10 rounded-[3px] border border-[#dbeafe] bg-[linear-gradient(135deg,#e0f2fe,#eff6ff)]" />
              <div className="h-10 rounded-[3px] border border-[#dbeafe] bg-[linear-gradient(135deg,#f0fdf4,#eff6ff)]" />
              <div className="h-10 rounded-[3px] border border-[#dbeafe] bg-[linear-gradient(135deg,#eff6ff,#f8fafc)]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span className={`shrink-0 rounded-[4px] px-2.5 py-1 text-xs font-semibold ${enabled ? "bg-[#dcfce7] text-[#039855]" : "bg-[#eef2f6] text-[#667085]"}`}>
      {enabled ? "上架" : "下架"}
    </span>
  );
}

function TemplateMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mt-2 truncate text-sm text-[#475467]">
      <span>{label}：</span>
      <span className="font-medium text-[#344054]">{value}</span>
    </div>
  );
}

function CardActionButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-[4px] border text-sm font-semibold transition ${
        active
          ? "border-[#0f63ff] bg-[#0f63ff] text-white shadow-[0_5px_12px_rgba(15,99,255,0.22)]"
          : "border-[#d5deeb] bg-white text-[#1d2a44] hover:border-[#1677ff] hover:text-[#1677ff]"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function TemplatePagination({
  page,
  pageSize,
  pageCount,
  total,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const visiblePages = Array.from({ length: Math.min(pageCount, 6) }, (_, index) => index + 1);

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-[#eef2f6] pt-4 text-sm text-[#475467] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <span>共 {total} 条</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-[4px] border border-[#d5deeb] bg-white px-3 outline-none">
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} 条/页
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PageButton disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} />
        </PageButton>
        {visiblePages.map((item) => (
          <PageButton key={item} active={item === page} onClick={() => onPageChange(item)}>
            {item}
          </PageButton>
        ))}
        {pageCount > 6 ? <span className="px-2">...</span> : null}
        <PageButton disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} />
        </PageButton>
        <span className="ml-3">前往</span>
        <input
          value={page}
          onChange={(event) => onPageChange(Number(event.target.value || 1))}
          className="h-9 w-14 rounded-[4px] border border-[#d5deeb] text-center outline-none"
        />
        <span>页</span>
      </div>
    </div>
  );
}

function PageButton({ active, disabled, onClick, children }: { active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 min-w-9 items-center justify-center rounded-[4px] border px-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-[#0f63ff] bg-[#0f63ff] text-white" : "border-[#d5deeb] bg-white text-[#344054] hover:border-[#1677ff] hover:text-[#1677ff]"
      }`}
    >
      {children}
    </button>
  );
}

function TemplateHealthPanel({
  items,
  onRefresh,
  onAction,
}: {
  items: ReturnType<typeof buildTemplateHealthItems>;
  onRefresh: () => void;
  onAction: (key: ReturnType<typeof buildTemplateHealthItems>[number]["key"]) => void;
}) {
  const icons: Record<string, { icon: LucideIcon; bg: string; text: string }> = {
    missingFiles: { icon: CheckCircle2, bg: "bg-[#dcfce7]", text: "text-[#039855]" },
    missingMetadata: { icon: FileSpreadsheet, bg: "bg-[#fff4db]", text: "text-[#fa8c16]" },
    drafts: { icon: FileText, bg: "bg-[#e8f1ff]", text: "text-[#1677ff]" },
  };

  return (
    <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[18px] font-semibold text-[#101828]">
          文件健康检查
          <Info size={16} className="text-[#667085]" />
        </div>
        <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1677ff]">
          <RefreshCw size={15} />
          刷新
        </button>
      </div>
      <div className="divide-y divide-[#eef2f6]">
        {items.map((item) => {
          const tone = icons[item.key];
          const Icon = tone.icon;
          return (
            <button key={item.key} type="button" onClick={() => onAction(item.key)} className="flex w-full items-center gap-4 py-4 text-left">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full ${tone.bg} ${tone.text}`}>
                <Icon size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#344054]">{item.label}</span>
                <span className="mt-1 block text-[24px] font-semibold leading-none text-[#101828]">{item.count} 个</span>
              </span>
              {item.statusLabel ? <span className="rounded-[4px] bg-[#dcfce7] px-3 py-1 text-sm font-semibold text-[#039855]">{item.statusLabel}</span> : null}
              {item.actionLabel ? <span className="rounded-[4px] bg-[#e8f1ff] px-3 py-1 text-sm font-semibold text-[#1677ff]">{item.actionLabel}</span> : null}
              <ChevronRight size={17} className="text-[#7a8aaa]" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AdminTipsPanel({ onOpenReport }: { onOpenReport: () => void }) {
  const tips = [
    { icon: Folder, text: "建议为模板设置清晰的行业与场景，便于用户检索与推荐。", tone: "blue" },
    { icon: ShieldAlert, text: "发布前请确认模板的完整性，避免缺失源文件影响下载。", tone: "orange" },
    { icon: BarChart3, text: "高质量模板更容易获得下载与积分收益，持续优化内容。", tone: "green" },
  ];

  return (
    <section className="rounded-[8px] border border-[#e5eaf3] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      <div className="text-base font-semibold text-[#101828]">管理提示</div>
      <div className="mt-4 space-y-4">
        {tips.map((tip) => {
          const tone = {
            blue: "bg-[#e8f1ff] text-[#1677ff]",
            orange: "bg-[#fff4db] text-[#fa8c16]",
            green: "bg-[#dcfce7] text-[#039855]",
          }[tip.tone];
          const Icon = tip.icon;
          return (
            <div key={tip.text} className="flex items-start gap-3 text-sm leading-6 text-[#667085]">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon size={16} />
              </span>
              <span>{tip.text}</span>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={onOpenReport} className={`${secondaryButtonClassName()} mt-5 w-full`}>
        <BarChart3 size={16} />
        查看模板运营报告
      </button>
    </section>
  );
}

function EditTemplateDialog({
  open,
  form,
  item,
  categoryOptions,
  scenarioOptions,
  difficultyOptions,
  saving,
  uploadingFile,
  onClose,
  onChange,
  onSubmit,
  onReplaceFile,
}: {
  open: boolean;
  form: AdminTemplateFormState;
  item: TemplateRecord | null;
  categoryOptions: string[];
  scenarioOptions: string[];
  difficultyOptions: string[];
  saving: boolean;
  uploadingFile: boolean;
  onClose: () => void;
  onChange: (next: AdminTemplateFormState) => void;
  onSubmit: () => void;
  onReplaceFile: () => void;
}) {
  const update = (patch: Partial<AdminTemplateFormState>) => onChange({ ...form, ...patch });
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="flex max-h-[92vh] w-[min(930px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[8px] border-0 bg-white p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#e5eaf3] px-6 py-5">
          <DialogTitle className="text-[20px] font-semibold text-[#101828]">编辑模板：{form.title || "未命名模板"}</DialogTitle>
          <DialogDescription className="sr-only">编辑模板基础信息、文件信息、标签和上下架状态。</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[330px_minmax(0,1fr)]">
          <div className="space-y-5 border-r border-[#e5eaf3] p-6">
            <div>
              <div className="mb-3 text-sm font-semibold text-[#101828]">封面预览</div>
              <TemplateCover imageUrl={form.previewImageUrl} title={form.title || "模板封面"} className="h-[260px]" />
            </div>
            <div className="rounded-[8px] border border-[#e5eaf3] p-4">
              <div className="mb-3 text-sm font-semibold text-[#101828]">文件信息</div>
              <InfoRow label="源文件" value={form.fileName || getFileName(form.templateFileUrl) || "尚未上传"} />
              <InfoRow label="文件大小" value={formatFileSize(form.fileSize)} />
              <InfoRow label="文件版本" value={form.fileVersion || "未记录"} />
              <InfoRow label="最近上传" value={formatTemplateTime(item?.lastUploadedAt || item?.updateTime) || "未记录"} />
            </div>
          </div>

          <div className="space-y-3 p-6">
            <EditFormRow label="标题" required>
              <div className="relative">
                <input value={form.title} maxLength={50} onChange={(event) => update({ title: event.target.value })} className={inputClassName()} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#667085]">{form.title.length}/50</span>
              </div>
            </EditFormRow>
            <EditFormRow label="行业" required>
              <select value={form.industryCategory} onChange={(event) => update({ industryCategory: event.target.value })} className={inputClassName()}>
                {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </EditFormRow>
            <EditFormRow label="场景" required>
              <ScenarioInput value={form.useScenario} options={scenarioOptions} onChange={(value) => update({ useScenario: value })} />
            </EditFormRow>
            <EditFormRow label="难度" required>
              <select value={form.difficultyLevel} onChange={(event) => update({ difficultyLevel: event.target.value })} className={inputClassName()}>
                {difficultyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </EditFormRow>
            <EditFormRow label="积分" required>
              <div className="relative">
                <input type="number" min="0" value={form.downloadCostPoints} onChange={(event) => update({ downloadCostPoints: Number(event.target.value || 0) })} className={inputClassName()} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#344054]">积分</span>
              </div>
            </EditFormRow>
            <EditFormRow label="状态" required>
              <div className="flex h-10 items-center gap-3">
                <Switch checked={form.enabled} onCheckedChange={(next) => update({ enabled: next })} />
                <span className="text-sm font-semibold text-[#344054]">{form.enabled ? "上架中" : "草稿/下架"}</span>
              </div>
            </EditFormRow>
            <EditFormRow label="标签">
              <TagInput value={form.functionsUsedText} onChange={(value) => update({ functionsUsedText: value })} />
            </EditFormRow>
            <EditFormRow label="摘要">
              <textarea maxLength={200} value={form.templateDescription} onChange={(event) => update({ templateDescription: event.target.value })} className={`${textareaClassName()} min-h-[74px]`} />
              <div className="-mt-5 pr-3 text-right text-xs text-[#667085]">{form.templateDescription.length}/200</div>
            </EditFormRow>
            <EditFormRow label="使用说明">
              <textarea maxLength={500} value={form.usageGuide} onChange={(event) => update({ usageGuide: event.target.value })} className={`${textareaClassName()} min-h-[84px]`} />
              <div className="-mt-5 pr-3 text-right text-xs text-[#667085]">{form.usageGuide.length}/500</div>
            </EditFormRow>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#e5eaf3] bg-white px-6 py-5">
          <div className="mb-4 grid gap-3 rounded-[6px] border border-[#e5eaf3] bg-[#fbfcfe] p-4 md:grid-cols-3">
            <MetricChip icon={Download} label="下载次数" value={item?.downloadCount || 0} tone="green" />
            <MetricChip icon={UserRound} label="兑换用户" value={item?.exchangeUserCount || 0} tone="orange" />
            <MetricChip icon={RefreshCw} label="最近更新时间" value={formatTemplateTime(item?.updateTime) || "未记录"} tone="blue" />
          </div>
          <div className="mb-5 rounded-[4px] border border-[#ffd591] bg-[#fff7e6] px-4 py-3 text-sm font-semibold text-[#d46b08]">
            <AlertTriangle size={16} className="mr-2 inline-block align-[-3px]" />
            替换源文件会影响已购买用户下载。
          </div>
          <DialogFooter>
            <button type="button" onClick={onClose} className={secondaryButtonClassName()}>取消</button>
            <button type="button" onClick={onSubmit} disabled={saving} className={secondaryButtonClassName()}>
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : null}
              保存修改
            </button>
            <button type="button" onClick={onReplaceFile} disabled={uploadingFile} className={primaryButtonClassName()}>
              {uploadingFile ? <LoaderCircle size={16} className="animate-spin" /> : null}
              替换文件
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateTemplateDrawer({
  open,
  form,
  categoryOptions,
  scenarioOptions,
  difficultyOptions,
  saving,
  uploadingPreview,
  uploadingFile,
  onClose,
  onChange,
  onUploadPreview,
  onUploadFile,
  onSaveDraft,
  onPublish,
}: {
  open: boolean;
  form: AdminTemplateFormState;
  categoryOptions: string[];
  scenarioOptions: string[];
  difficultyOptions: string[];
  saving: boolean;
  uploadingPreview: boolean;
  uploadingFile: boolean;
  onClose: () => void;
  onChange: (next: AdminTemplateFormState) => void;
  onUploadPreview: () => void;
  onUploadFile: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  if (!open) return null;
  const update = (patch: Partial<AdminTemplateFormState>) => onChange({ ...form, ...patch });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45">
      <aside className="ml-auto flex h-full w-[min(980px,calc(100vw-1rem))] flex-col bg-white shadow-[-16px_0_40px_rgba(15,23,42,0.18)]">
        <div className="flex h-[68px] items-center justify-between border-b border-[#e5eaf3] px-7">
          <div className="text-[20px] font-semibold text-[#101828]">新增模板</div>
          <button type="button" onClick={onClose} className="text-[#344054] hover:text-[#1677ff]">
            <X size={20} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-5 p-7">
            <SectionTitle>基础信息</SectionTitle>
            <RequiredField label="模板标题">
              <input value={form.title} onChange={(event) => update({ title: event.target.value })} className={inputClassName()} />
            </RequiredField>
            <div className="grid gap-4 md:grid-cols-2">
              <RequiredField label="行业分类">
                <select value={form.industryCategory} onChange={(event) => update({ industryCategory: event.target.value })} className={inputClassName()}>
                  {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </RequiredField>
              <RequiredField label="使用场景">
                <ScenarioInput value={form.useScenario} options={scenarioOptions} onChange={(value) => update({ useScenario: value })} />
              </RequiredField>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_96px_96px_96px]">
              <RequiredField label="难度">
                <select value={form.difficultyLevel} onChange={(event) => update({ difficultyLevel: event.target.value })} className={inputClassName()}>
                  {difficultyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </RequiredField>
              <RequiredField label="所需积分">
                <input type="number" min="0" value={form.downloadCostPoints} onChange={(event) => update({ downloadCostPoints: Number(event.target.value || 0) })} className={inputClassName()} />
              </RequiredField>
              <RequiredField label="排序">
                <input type="number" value={form.sortOrder} onChange={(event) => update({ sortOrder: Number(event.target.value || 0) })} className={inputClassName()} />
              </RequiredField>
              <FormField label="是否启用">
                <div className="flex h-10 items-center justify-center">
                  <Switch checked={form.enabled} onCheckedChange={(next) => update({ enabled: next })} />
                </div>
              </FormField>
            </div>

            <SectionTitle>文件信息</SectionTitle>
            <RequiredField label="上传 Excel 文件">
              <FileUploadRow icon={FileSpreadsheet} text={form.fileName || getFileName(form.templateFileUrl) || "选择 Excel 模板文件"} subText={form.templateFileUrl ? `${formatFileSize(form.fileSize)} · 已选择模板文件` : "支持 xlsx / xls 文件"} actionLabel={uploadingFile ? "上传中..." : "上传文件"} loading={uploadingFile} onClick={onUploadFile} />
            </RequiredField>
            <RequiredField label="上传封面图">
              <div className="flex flex-wrap items-center gap-4">
                <TemplateCover imageUrl={form.previewImageUrl} title={form.title || "封面"} className="h-[68px] w-[118px]" />
                <button type="button" onClick={onUploadPreview} disabled={uploadingPreview} className={secondaryButtonClassName()}>
                  {uploadingPreview ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
                  重新上传
                </button>
                <span className="text-xs text-[#667085]">支持 JPG、PNG 格式，建议尺寸 1060 x 596</span>
              </div>
            </RequiredField>
            <RequiredField label="文件版本">
              <input value={form.fileVersion} onChange={(event) => update({ fileVersion: event.target.value })} className={inputClassName()} />
            </RequiredField>

            <SectionTitle>内容介绍</SectionTitle>
            <RequiredField label="模板摘要">
              <textarea maxLength={200} value={form.templateDescription} onChange={(event) => update({ templateDescription: event.target.value })} className={`${textareaClassName()} min-h-[86px]`} />
              <div className="-mt-5 pr-3 text-right text-xs text-[#667085]">{form.templateDescription.length}/200</div>
            </RequiredField>
            <RequiredField label="使用说明">
              <textarea maxLength={1000} value={form.usageGuide} onChange={(event) => update({ usageGuide: event.target.value })} className={`${textareaClassName()} min-h-[86px]`} />
              <div className="-mt-5 pr-3 text-right text-xs text-[#667085]">{form.usageGuide.length}/1000</div>
            </RequiredField>
            <FormField label="标签">
              <TagInput value={form.functionsUsedText} onChange={(value) => update({ functionsUsedText: value })} />
            </FormField>
          </div>
          <div className="border-l border-[#e5eaf3] p-6">
            <div className="sticky top-6 rounded-[8px] border border-[#e5eaf3] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
              <div className="mb-4 text-base font-semibold text-[#101828]">模板商品卡片预览</div>
              <TemplateCover imageUrl={form.previewImageUrl} title={form.title || "模板预览"} className="h-[238px]" />
              <h3 className="mt-4 text-lg font-semibold text-[#101828]">{form.title || "销售数据分析看板"}</h3>
              <TemplateMeta label="行业" value={form.industryCategory || "销售"} />
              <TemplateMeta label="场景" value={form.useScenario || "数据分析"} />
              <TemplateMeta label="难度" value={<span className="rounded-[4px] bg-[#e8f1ff] px-2 py-0.5 text-xs font-semibold text-[#1677ff]">{form.difficultyLevel || "中级"}</span>} />
              <TemplateMeta label="积分" value={formatTemplateCost(form.downloadCostPoints)} />
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#039855]">
                <CheckCircle2 size={16} />
                {form.enabled ? "上架中" : "草稿"}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#e5eaf3] px-7 py-5">
          <button type="button" onClick={onClose} className={secondaryButtonClassName()}>取消</button>
          <button type="button" onClick={onSaveDraft} disabled={saving} className={secondaryButtonClassName()}>
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : null}
            保存草稿
          </button>
          <button type="button" onClick={onPublish} disabled={saving} className={primaryButtonClassName()}>
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : null}
            发布模板
          </button>
        </div>
      </aside>
    </div>
  );
}

function TemplatePreviewDialog({ item, onClose }: { item: TemplateRecord | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-[8px] bg-white p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#e5eaf3] px-6 py-5">
          <DialogTitle>{item?.title || "模板预览"}</DialogTitle>
          <DialogDescription className="sr-only">预览模板封面、说明、行业场景、积分和下载状态。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 p-6 md:grid-cols-[280px_minmax(0,1fr)]">
          <TemplateCover imageUrl={item?.previewImageUrl} title={item?.title || "模板预览"} className="h-[280px]" />
          <div>
            <StatusPill enabled={Boolean(item?.enabled)} />
            <h3 className="mt-4 text-[22px] font-semibold text-[#101828]">{item?.title || "未命名模板"}</h3>
            <p className="mt-3 text-sm leading-6 text-[#667085]">{item?.templateDescription || "暂无模板说明"}</p>
            <div className="mt-5 grid gap-3 rounded-[8px] bg-[#f8fafc] p-4">
              <InfoRow label="行业" value={item?.industryCategory || "未填写"} />
              <InfoRow label="场景" value={item?.useScenario || "未填写"} />
              <InfoRow label="难度" value={item?.difficultyLevel || "基础"} />
              <InfoRow label="积分" value={formatTemplateCost(item?.downloadCostPoints)} />
              <InfoRow label="下载次数" value={item?.downloadCount || 0} />
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-[#e5eaf3] px-6 py-4">
          <button type="button" onClick={onClose} className={primaryButtonClassName()}>关闭</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateReportDialog({
  open,
  report,
  loading,
  onClose,
}: {
  open: boolean;
  report?: TemplateOperationsReport;
  loading: boolean;
  onClose: () => void;
}) {
  const summary = report?.summary;
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="w-[min(860px,calc(100vw-2rem))] overflow-hidden rounded-[8px] bg-white p-0 sm:max-w-none">
        <DialogHeader className="border-b border-[#e5eaf3] px-6 py-5">
          <DialogTitle>模板运营报告</DialogTitle>
          <DialogDescription className="sr-only">查看模板数量、下载、健康检查和热门模板。</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm font-semibold text-[#667085]">
              <LoaderCircle size={18} className="mr-2 animate-spin" />
              正在生成报告
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <ReportMetric label="模板数" value={summary?.total || 0} />
                <ReportMetric label="上架" value={summary?.enabled || 0} />
                <ReportMetric label="下载" value={summary?.downloads || 0} />
                <ReportMetric label="待补全" value={summary?.missingMetadata || 0} />
              </div>
              <ReportTable
                title="行业表现"
                rows={report?.categoryStats || []}
                columns={[
                  ["name", "行业"],
                  ["templateCount", "模板"],
                  ["downloadCount", "下载"],
                ]}
              />
              <ReportTable
                title="热门模板"
                rows={report?.topTemplates || []}
                columns={[
                  ["title", "模板"],
                  ["industryCategory", "行业"],
                  ["downloadCount", "下载"],
                ]}
              />
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-[#e5eaf3] px-6 py-4">
          <button type="button" onClick={onClose} className={primaryButtonClassName()}>关闭</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-[#e5eaf3] bg-[#fbfcfe] p-4">
      <div className="text-sm font-semibold text-[#667085]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#101828]">{value}</div>
    </div>
  );
}

function ReportTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  columns: Array<[string, string]>;
}) {
  return (
    <section>
      <div className="mb-3 text-base font-semibold text-[#101828]">{title}</div>
      <div className="overflow-hidden rounded-[8px] border border-[#e5eaf3]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-[#667085]">
            <tr>
              {columns.map((column) => <th key={column[0]} className="px-4 py-3 font-semibold">{column[1]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f6]">
            {rows.length ? rows.map((row, index) => (
              <tr key={`${title}-${index}`} className="text-[#344054]">
                {columns.map((column) => <td key={column[0]} className="px-4 py-3">{String(row[column[0]] ?? "-")}</td>)}
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-6 text-center text-[#667085]" colSpan={columns.length}>暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-2 border-[#1677ff] pl-2 text-base font-semibold text-[#101828]">
      {children}
    </div>
  );
}

function EditFormRow({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[86px_minmax(0,1fr)] md:items-start">
      <div className="pt-2 text-sm font-semibold text-[#344054]">
        {required ? <span className="mr-1 text-[#ff4d4f]">*</span> : null}
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function RequiredField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <FormField label={<>{label} <span className="text-[#ff4d4f]">*</span></>}>
      {children}
    </FormField>
  );
}

function FormField({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[#344054]">{label}</div>
      {children}
    </label>
  );
}

function ScenarioInput({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <>
      <input
        value={value}
        list="admin-template-scenarios"
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName()}
      />
      <datalist id="admin-template-scenarios">
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

function TagInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const tags = value.split(/[\n,，、；;]/g).map((item) => item.trim()).filter(Boolean);
  return (
    <div className="rounded-[4px] border border-[#d0d5dd] bg-white px-3 py-2 focus-within:border-[#1677ff] focus-within:ring-2 focus-within:ring-[#1677ff]/10">
      <div className="mb-2 flex flex-wrap gap-2">
        {tags.length ? tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-[4px] bg-[#eef2f6] px-2 py-1 text-xs font-semibold text-[#344054]">
            {tag}
            <X size={12} />
          </span>
        )) : <span className="text-xs text-[#98a2b3]">输入标签后会在这里预览</span>}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="销售，数据分析，看板"
        className="h-7 w-full bg-transparent text-sm text-[#344054] outline-none placeholder:text-[#98a2b3]"
      />
    </div>
  );
}

function FileUploadRow({
  icon: Icon,
  text,
  subText,
  actionLabel,
  loading,
  onClick,
}: {
  icon: LucideIcon;
  text: string;
  subText: string;
  actionLabel: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[4px] border border-[#d0d5dd] bg-white px-3 py-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[#e8f5e9] text-[#16a34a]">
        <Icon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#344054]">{text}</span>
        <span className="block text-xs text-[#667085]">{subText}</span>
      </span>
      <button type="button" onClick={onClick} disabled={loading} className={secondaryButtonClassName()}>
        {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
        {actionLabel}
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-4 text-sm leading-6">
      <span className="w-20 shrink-0 text-[#667085]">{label}：</span>
      <span className="min-w-0 flex-1 break-all font-medium text-[#344054]">{value}</span>
    </div>
  );
}

function MetricChip({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: ReactNode; tone: "green" | "orange" | "blue" }) {
  const toneClass = {
    green: "bg-[#dcfce7] text-[#12b76a]",
    orange: "bg-[#fff4db] text-[#fa8c16]",
    blue: "bg-[#e8f1ff] text-[#1677ff]",
  }[tone];
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${toneClass}`}>
        <Icon size={22} />
      </span>
      <span>
        <span className="block text-xs font-semibold text-[#667085]">{label}</span>
        <span className="mt-0.5 block text-lg font-semibold text-[#101828]">{value}</span>
      </span>
    </div>
  );
}

function toFormState(item: TemplateRecord, isCreate: boolean): AdminTemplateFormState {
  return {
    title: item.title || "",
    industryCategory: item.industryCategory || TEMPLATE_INDUSTRY_CATEGORIES[0],
    useScenario: item.useScenario || "",
    previewImageUrl: item.previewImageUrl || "",
    templateDescription: item.templateDescription || "",
    functionsUsedText: Array.isArray(item.tags) && item.tags.length ? item.tags.join("，") : Array.isArray(item.functionsUsed) ? item.functionsUsed.join("，") : "",
    difficultyLevel: item.difficultyLevel || "基础",
    downloadCostPoints: Number(item.downloadCostPoints || 0),
    templateFileUrl: item.templateFileUrl || "",
    fileName: item.fileName || getFileName(item.templateFileUrl) || "",
    fileSize: Number(item.fileSize || 0),
    fileVersion: isCreate ? "1.0.0" : item.fileVersion || "1.0.0",
    sortOrder: Number(item.sortOrder || 0),
    enabled: isCreate ? true : Boolean(item.enabled),
    usageGuide: item.usageGuide || "",
  };
}

function getDifficultyTone(value?: string | null) {
  if (String(value || "").includes("高")) return "bg-[#ffe4e8] text-[#d92d20]";
  if (String(value || "").includes("中")) return "bg-[#e8f1ff] text-[#1677ff]";
  return "bg-[#dcfce7] text-[#039855]";
}

function getFileName(value?: string | null) {
  if (!value) return "";
  const normalized = value.split("?")[0].split("#")[0];
  return normalized.split("/").filter(Boolean).pop() || normalized;
}

function formatTemplateTime(value?: string | null) {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 16);
}

function formatFileSize(value?: number | null) {
  const size = Number(value || 0);
  if (!size) return "未记录";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
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
