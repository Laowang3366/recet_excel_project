import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  File,
  FileImage,
  FileSpreadsheet,
  Folder,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";

import { AdminBulkCheckbox, AdminEmptyState, AdminPageShell } from "../admin/shared";
import { useAdminBulkSelection } from "../admin/bulk-selection";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { adminKeys } from "../lib/query-keys";
import { adminRequest, showAdminSuccess, useAdminRole } from "./AdminConsoleShared";
import {
  buildRecycleRiskSummary,
  buildRecycleSourceBreakdown,
  buildRecycleStats,
  formatRetentionText,
  getRecycleDeletedByLabel,
  getRecycleFileExtension,
  getRecycleFileName,
  getRecycleFileSizeLabel,
  getRecycleRetentionDays,
  getRecycleSourceLabel,
  getRecycleStatus,
  type FileRecycleItemView,
} from "./AdminFileRecycleBinUtils";

type FileRecycleItem = FileRecycleItemView;

type FileRecycleStats = {
  totalRecords?: number;
  currentPageRecords?: number;
  recoverableRecords?: number;
  expiringSoonRecords?: number;
  todayDeletedRecords?: number;
  expiredRecords?: number;
  totalFileCount?: number;
  totalSizeBytes?: number | null;
  totalSizeLabel?: string | null;
  hasUnknownSize?: boolean;
  sourceModules?: string[];
  expiredFileCount?: number;
  expiredSizeBytes?: number | null;
  expiredSizeLabel?: string | null;
  hasUnknownExpiredSize?: boolean;
  expiredSourceModules?: string[];
  expiredSourceModuleCounts?: SourceBreakdownItem[];
};

type DeletedByOption = {
  value: string | number;
  label: string;
};

type RecycleRiskSummary = ReturnType<typeof buildRecycleRiskSummary>;
type SourceBreakdownItem = ReturnType<typeof buildRecycleSourceBreakdown>[number];

type FileRecyclePage = {
  records?: FileRecycleItem[];
  total?: number;
  page?: number;
  size?: number;
  stats?: FileRecycleStats;
  deletedByOptions?: DeletedByOption[];
};

type RecycleFilters = {
  keyword: string;
  resourceType: string;
  fileType: string;
  deletedBy: string;
  startDate: string;
  endDate: string;
};

type RestoreIntent = {
  mode: "single" | "bulk";
  items: FileRecycleItem[];
};

type PurgeIntent = {
  mode: "single" | "bulk" | "expired";
  items: FileRecycleItem[];
  summary?: RecycleRiskSummary;
  sourceBreakdown?: SourceBreakdownItem[];
};

const PAGE_SIZE = 10;
const PERMANENT_DELETE_CONFIRM_TEXT = "永久删除";

const defaultFilters: RecycleFilters = {
  keyword: "",
  resourceType: "all",
  fileType: "all",
  deletedBy: "all",
  startDate: "",
  endDate: "",
};

const fileTypeOptions = [
  { value: "all", label: "全部类型" },
  { value: "excel", label: "Excel 文件" },
  { value: "image", label: "图片文件" },
  { value: "other", label: "其他文件" },
];

export function AdminFileRecycleBin() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<RecycleFilters>(defaultFilters);
  const [filters, setFilters] = useState<RecycleFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [restoreIntent, setRestoreIntent] = useState<RestoreIntent | null>(null);
  const [purgeIntent, setPurgeIntent] = useState<PurgeIntent | null>(null);
  const [permanentText, setPermanentText] = useState("");

  const params = useMemo(() => ({
    resourceType: filters.resourceType,
    keyword: filters.keyword.trim(),
    fileType: filters.fileType,
    deletedBy: filters.deletedBy,
    deletedStart: filters.startDate,
    deletedEnd: filters.endDate,
    page,
    size: PAGE_SIZE,
  }), [filters, page]);

  const listQuery = useQuery({
    queryKey: adminKeys.fileRecycleBin(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("size", String(PAGE_SIZE));
      if (filters.resourceType !== "all") searchParams.set("resourceType", filters.resourceType);
      if (filters.keyword.trim()) searchParams.set("keyword", filters.keyword.trim());
      if (filters.fileType !== "all") searchParams.set("fileType", filters.fileType);
      if (filters.deletedBy !== "all") searchParams.set("deletedBy", filters.deletedBy);
      if (filters.startDate) searchParams.set("deletedStart", filters.startDate);
      if (filters.endDate) searchParams.set("deletedEnd", filters.endDate);
      return adminRequest<FileRecyclePage>(
        api.get(`/api/admin/file-recycle-bin?${searchParams.toString()}`, { silent: true }),
        navigate,
        role,
      );
    },
  });

  const records = listQuery.data?.records ?? [];
  const total = listQuery.data?.total ?? 0;
  const filteredRecords = records;
  const stats = useMemo(() => normalizeRecycleStats(listQuery.data?.stats, records, total), [listQuery.data?.stats, records, total]);
  const bulk = useAdminBulkSelection(filteredRecords, (item) => item.id);
  const selectedSummary = useMemo(() => buildRecycleRiskSummary(bulk.selectedItems), [bulk.selectedItems]);
  const expiredItems = useMemo(() => filteredRecords.filter((item) => getRecycleStatus(item).tone === "danger"), [filteredRecords]);
  const cleanupSummary = useMemo(() => buildExpiredCleanupSummary(stats), [stats]);
  const cleanupSourceBreakdown = useMemo(() => buildExpiredSourceBreakdown(stats), [stats]);
  const deletedByOptions = useMemo(
    () => normalizeDeletedByOptions(listQuery.data?.deletedByOptions, records),
    [listQuery.data?.deletedByOptions, records],
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refresh = async () => {
    bulk.clear();
    await queryClient.invalidateQueries({ queryKey: ["admin", "file-recycle-bin"] });
  };

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => adminRequest(
      api.post(`/api/admin/file-recycle-bin/${id}/restore`),
      navigate,
      role,
      "恢复文件",
    ),
    onSuccess: async (result) => {
      if (!result) return;
      showAdminSuccess("已恢复业务记录和文件");
      await refresh();
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: async (items: FileRecycleItem[]) => {
      const result = await adminRequest<{ count?: number }>(
        api.post("/api/admin/file-recycle-bin/restore-batch", { ids: items.map((item) => item.id) }),
        navigate,
        role,
        "批量恢复",
      );
      return result?.count ?? 0;
    },
    onSuccess: async (successCount) => {
      if (successCount > 0) {
        showAdminSuccess(`已恢复 ${successCount} 条回收站记录`);
      }
      await refresh();
    },
  });

  const purgeMutation = useMutation({
    mutationFn: async (id: number) => adminRequest(
      api.delete(`/api/admin/file-recycle-bin/${id}`),
      navigate,
      role,
      "永久删除",
    ),
    onSuccess: async (result) => {
      if (!result) return;
      showAdminSuccess("已永久删除");
      await refresh();
    },
  });

  const purgeBatchMutation = useMutation({
    mutationFn: async (items: FileRecycleItem[]) => adminRequest(
      api.delete("/api/admin/file-recycle-bin/batch", { ids: items.map((item) => item.id) }),
      navigate,
      role,
      "批量永久删除",
    ),
    onSuccess: async (result) => {
      if (!result) return;
      showAdminSuccess("已批量永久删除");
      await refresh();
    },
  });

  const purgeExpiredMutation = useMutation({
    mutationFn: async () => adminRequest(
      api.post("/api/admin/file-recycle-bin/purge-expired"),
      navigate,
      role,
      "清理过期文件",
    ),
    onSuccess: async (result) => {
      if (!result) return;
      showAdminSuccess("已清理过期文件");
      await refresh();
    },
  });

  const handleSearch = () => {
    setFilters({ ...draftFilters, keyword: draftFilters.keyword.trim() });
    setPage(1);
  };

  const handleReset = () => {
    setDraftFilters(defaultFilters);
    setFilters(defaultFilters);
    setPage(1);
  };

  const openPurgeDialog = (intent: PurgeIntent) => {
    setPermanentText("");
    setPurgeIntent(intent);
  };

  const confirmRestore = () => {
    if (!restoreIntent) return;
    const items = restoreIntent.items;
    setRestoreIntent(null);
    if (restoreIntent.mode === "single") {
      restoreMutation.mutate(items[0].id);
      return;
    }
    bulkRestoreMutation.mutate(items);
  };

  const confirmPurge = () => {
    if (!purgeIntent || permanentText !== PERMANENT_DELETE_CONFIRM_TEXT) return;
    const intent = purgeIntent;
    setPurgeIntent(null);
    setPermanentText("");

    if (intent.mode === "single") {
      purgeMutation.mutate(intent.items[0].id);
      return;
    }
    if (intent.mode === "bulk") {
      purgeBatchMutation.mutate(intent.items);
      return;
    }
    purgeExpiredMutation.mutate();
  };

  const actionDisabled = restoreMutation.isPending
    || bulkRestoreMutation.isPending
    || purgeMutation.isPending
    || purgeBatchMutation.isPending
    || purgeExpiredMutation.isPending;

  return (
    <AdminPageShell
      actions={(
        <button
          type="button"
          onClick={() => openPurgeDialog({ mode: "expired", items: expiredItems, summary: cleanupSummary, sourceBreakdown: cleanupSourceBreakdown })}
          disabled={actionDisabled || cleanupSummary.fileCount === 0}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[6px] border border-[#d0d5dd] bg-white px-8 text-[16px] font-semibold text-[#1677ff] shadow-sm transition hover:border-[#1677ff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          清理过期
        </button>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RecycleStatCard
          icon={Folder}
          tone="blue"
          label="回收文件"
          value={stats.totalRecords}
          hint={<>占用 <span className="font-semibold text-[#0b63f6]">{stats.totalSizeLabel}</span></>}
        />
        <RecycleStatCard
          icon={RotateCcw}
          tone="green"
          label="可恢复"
          value={stats.recoverableRecords}
          hint={<><span className="font-semibold text-[#ff6a00]">{stats.expiringSoonRecords}</span> 个即将过期</>}
        />
        <RecycleStatCard
          icon={Trash2}
          tone="orange"
          label="今日删除"
          value={stats.todayDeletedRecords}
          hint={<>本页文件 <span className="font-semibold text-[#ff6a00]">{stats.totalFileCount}</span></>}
        />
        <RecycleStatCard
          icon={AlertTriangle}
          tone="red"
          label="过期清理"
          value={stats.expiredRecords}
          hint={<span className="font-semibold text-[#ff2d2d]">建议确认</span>}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0 rounded-[8px] border border-[#dfe5ef] bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <h2 className="text-[22px] font-semibold leading-none text-[#101828]">文件列表</h2>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setRestoreIntent({ mode: "bulk", items: bulk.selectedItems })}
                disabled={bulk.selectedCount === 0 || actionDisabled}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[4px] border border-[#1677ff] bg-white px-4 text-sm font-semibold text-[#1677ff] transition hover:bg-[#eef6ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                批量恢复
              </button>
              <button
                type="button"
                onClick={() => openPurgeDialog({ mode: "bulk", items: bulk.selectedItems })}
                disabled={bulk.selectedCount === 0 || actionDisabled}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[4px] border border-[#ff8f98] bg-white px-4 text-sm font-semibold text-[#ff2d3d] transition hover:bg-[#fff1f0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                批量永久删除
              </button>
              <button
                type="button"
                onClick={refresh}
                disabled={listQuery.isFetching}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[4px] border border-[#d0d5dd] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#1677ff] hover:text-[#1677ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={16} className={listQuery.isFetching ? "animate-spin" : ""} />
                刷新
              </button>
              {bulk.selectedCount > 0 ? (
                <div className="rounded-[4px] bg-[#eef5ff] px-3 py-2 text-sm text-[#475467]">
                  已选 <span className="font-semibold text-[#1677ff]">{selectedSummary.fileCount}</span> 个文件
                  <span className="mx-1 text-[#98a2b3]">/</span>
                  总大小 <span className="font-semibold text-[#1677ff]">{selectedSummary.releaseSizeLabel}</span>
                  <span className="mx-1 text-[#98a2b3]">/</span>
                  来源 <span className="font-semibold text-[#1677ff]">{selectedSummary.sourceLabels.join("、") || "-"}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(170px,1.1fr)_minmax(210px,1.2fr)_minmax(120px,0.75fr)_minmax(130px,0.8fr)_84px_84px]">
            <FilterTextField
              label="文件名 / 来源模块"
              value={draftFilters.keyword}
              placeholder="请输入文件名或来源模块"
              onChange={(keyword) => setDraftFilters((current) => ({ ...current, keyword }))}
              onEnter={handleSearch}
            />
            <FilterDateRange
              label="删除时间"
              startDate={draftFilters.startDate}
              endDate={draftFilters.endDate}
              onStartChange={(startDate) => setDraftFilters((current) => ({ ...current, startDate }))}
              onEndChange={(endDate) => setDraftFilters((current) => ({ ...current, endDate }))}
            />
            <FilterSelect
              label="文件类型"
              value={draftFilters.fileType}
              options={fileTypeOptions}
              onChange={(fileType) => setDraftFilters((current) => ({ ...current, fileType }))}
            />
            <FilterSelect
              label="删除人"
              value={draftFilters.deletedBy}
              options={deletedByOptions}
              onChange={(deletedBy) => setDraftFilters((current) => ({ ...current, deletedBy }))}
            />
            <button
              type="button"
              onClick={handleSearch}
              className="mt-auto inline-flex h-10 items-center justify-center rounded-[4px] bg-[#0b63f6] px-4 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(11,99,246,0.22)] transition hover:bg-[#0958d9]"
            >
              搜索
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="mt-auto inline-flex h-10 items-center justify-center rounded-[4px] border border-[#d0d5dd] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#1677ff] hover:text-[#1677ff]"
            >
              重置
            </button>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-[#e4e7ec]">
            {filteredRecords.length === 0 ? (
              <AdminEmptyState message={listQuery.isLoading ? "正在加载回收站..." : "暂无回收站文件"} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead className="bg-[#f8fafc] text-[13px] font-semibold text-[#1f2937]">
                    <tr>
                      <th className="w-[52px] px-5 py-3">
                        <AdminBulkCheckbox checked={bulk.allVisibleSelected} onChange={bulk.toggleAllVisible} label="全选本页回收站记录" />
                      </th>
                      <th className="px-3 py-3">文件</th>
                      <th className="px-3 py-3">来源</th>
                      <th className="px-3 py-3">大小</th>
                      <th className="px-3 py-3">删除人</th>
                      <th className="px-3 py-3">剩余保留</th>
                      <th className="px-3 py-3">状态</th>
                      <th className="px-3 py-3 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e4e7ec] bg-white">
                    {filteredRecords.map((item) => {
                      const status = getRecycleStatus(item);
                      const retentionDays = getRecycleRetentionDays(item);
                      return (
                        <tr key={item.id} className="align-middle text-[#111827] transition hover:bg-[#f8fbff]">
                          <td className="px-5 py-3">
                            <AdminBulkCheckbox checked={bulk.isSelected(item.id)} onChange={() => bulk.toggleOne(item.id)} label={`选择回收站记录 ${item.id}`} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <RecycleFileIcon extension={getRecycleFileExtension(item)} />
                              <div className="min-w-0">
                                <div className="truncate font-medium text-[#101828]" title={getRecycleFileName(item)}>
                                  {getRecycleFileName(item)}
                                </div>
                                <div className="mt-0.5 truncate text-xs text-[#98a2b3]" title={item.originalFileUrl || ""}>
                                  {item.originalFileUrl || "原始路径未提供"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[#344054]">{getRecycleSourceLabel(item.resourceType)}</td>
                          <td className="px-3 py-3 text-[#344054]">{getRecycleFileSizeLabel(item)}</td>
                          <td className="px-3 py-3 text-[#344054]">{getDeletedByDisplay(item)}</td>
                          <td className="px-3 py-3 text-[#344054]">{formatRetentionText(retentionDays)}</td>
                          <td className="px-3 py-3">
                            <RecycleStatusBadge label={status.label} tone={status.tone} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-center gap-4">
                              <button
                                type="button"
                                onClick={() => setRestoreIntent({ mode: "single", items: [item] })}
                                disabled={actionDisabled}
                                className="font-semibold text-[#0b63f6] transition hover:text-[#004ec2] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                恢复
                              </button>
                              <button
                                type="button"
                                onClick={() => openPurgeDialog({ mode: "single", items: [item] })}
                                disabled={actionDisabled}
                                className="font-semibold text-[#ff1f2f] transition hover:text-[#c70f1d] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                永久删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <RecyclePagination current={page} pages={pages} total={total} onChange={setPage} />
        </section>

        <DeleteProtectionPanel
          cleanupSummary={cleanupSummary}
          onViewDetails={() => openPurgeDialog({ mode: "expired", items: expiredItems, summary: cleanupSummary, sourceBreakdown: cleanupSourceBreakdown })}
        />
      </div>

      {restoreIntent ? (
        <RestoreConfirmDialog
          intent={restoreIntent}
          processing={restoreMutation.isPending || bulkRestoreMutation.isPending}
          onCancel={() => setRestoreIntent(null)}
          onConfirm={confirmRestore}
        />
      ) : null}

      {purgeIntent ? (
        <PermanentDeleteDialog
          intent={purgeIntent}
          value={permanentText}
          processing={purgeMutation.isPending || purgeBatchMutation.isPending || purgeExpiredMutation.isPending}
          onChange={setPermanentText}
          onCancel={() => {
            setPurgeIntent(null);
            setPermanentText("");
          }}
          onConfirm={confirmPurge}
        />
      ) : null}
    </AdminPageShell>
  );
}

function RecycleStatCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof Folder;
  tone: "blue" | "green" | "orange" | "red";
  label: string;
  value: number;
  hint: React.ReactNode;
}) {
  const toneClassName = {
    blue: "bg-[#eaf2ff] text-[#0b63f6]",
    green: "bg-[#dcf8e7] text-[#12a150]",
    orange: "bg-[#fff0d9] text-[#ff7a00]",
    red: "bg-[#ffe1e3] text-[#e5484d]",
  }[tone];

  return (
    <div className="rounded-[8px] border border-[#dfe5ef] bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-5">
        <div className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full ${toneClassName}`}>
          <Icon size={34} strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <div className="text-[16px] font-semibold text-[#344054]">{label}</div>
          <div className="mt-2 text-[32px] font-semibold leading-none text-[#101828]">{value}</div>
          <div className="mt-2 text-[16px] leading-5 text-[#475467]">{hint}</div>
        </div>
      </div>
    </div>
  );
}

function FilterTextField({
  label,
  value,
  placeholder,
  onChange,
  onEnter,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-semibold text-[#344054]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter();
        }}
        placeholder={placeholder}
        className={recycleInputClassName}
      />
    </label>
  );
}

function FilterDateRange({
  label,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  label: string;
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-semibold text-[#344054]">{label}</span>
      <div className="grid h-10 grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center rounded-[4px] border border-[#d8dee9] bg-white px-3 text-sm text-[#667085] transition focus-within:border-[#1677ff] focus-within:ring-2 focus-within:ring-[#1677ff]/10">
        <DateInput value={startDate} placeholder="开始日期" onChange={onStartChange} />
        <span className="text-center text-[#98a2b3]">~</span>
        <DateInput value={endDate} placeholder="结束日期" onChange={onEndChange} />
      </div>
    </label>
  );
}

function DateInput({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <CalendarDays size={14} className="shrink-0 text-[#98a2b3]" />
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
        className="h-9 min-w-0 flex-1 bg-transparent text-sm text-[#344054] outline-none"
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-semibold text-[#344054]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${recycleInputClassName} appearance-none pr-9`}
        >
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#667085]" />
      </div>
    </label>
  );
}

function RecycleFileIcon({ extension }: { extension: string }) {
  const isExcel = ["xls", "xlsx", "csv"].includes(extension);
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(extension);
  const className = isExcel
    ? "bg-[#12a150] text-white"
    : isImage
      ? "bg-[#1687f7] text-white"
      : "bg-[#eef2f6] text-[#475467]";
  const Icon = isExcel ? FileSpreadsheet : isImage ? FileImage : File;

  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] ${className}`}>
      <Icon size={18} />
    </span>
  );
}

function RecycleStatusBadge({ label, tone }: { label: string; tone: "success" | "warning" | "danger" | "neutral" }) {
  const className = {
    success: "border-[#b7ebc6] bg-[#e9fbf0] text-[#0f9f52]",
    warning: "border-[#ffd7a3] bg-[#fff4e5] text-[#ff7a00]",
    danger: "border-[#ffccc7] bg-[#fff1f0] text-[#e5484d]",
    neutral: "border-[#d8dee9] bg-[#f8fafc] text-[#475467]",
  }[tone];

  return (
    <span className={`inline-flex h-7 min-w-[72px] items-center justify-center rounded-[4px] border px-3 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function RecyclePagination({
  current,
  pages,
  total,
  onChange,
}: {
  current: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pageNumbers = buildPageNumbers(current, pages);
  return (
    <div className="mt-5 flex flex-col gap-3 text-sm text-[#344054] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <span>共 {total} 条</span>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-3 rounded-[4px] border border-[#d8dee9] bg-white px-4 text-[#344054]"
        >
          {PAGE_SIZE} 条/页
          <ChevronDown size={15} />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PageButton disabled={current <= 1} onClick={() => onChange(Math.max(1, current - 1))}>
          <ChevronLeft size={17} />
        </PageButton>
        {pageNumbers.map((pageNumber) => (
          <PageButton
            key={pageNumber}
            active={current === pageNumber}
            onClick={() => onChange(pageNumber)}
          >
            {pageNumber}
          </PageButton>
        ))}
        <PageButton disabled={current >= pages} onClick={() => onChange(Math.min(pages, current + 1))}>
          <ChevronRight size={17} />
        </PageButton>
      </div>
      <label className="flex items-center gap-2">
        <span>前往</span>
        <input
          type="number"
          min={1}
          max={pages}
          value={current}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) onChange(Math.min(pages, Math.max(1, Math.round(value))));
          }}
          className="h-10 w-16 rounded-[4px] border border-[#d8dee9] bg-white text-center text-sm outline-none focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10"
        />
        <span>页</span>
      </label>
    </div>
  );
}

function PageButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-[4px] border px-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? "border-[#0b63f6] bg-[#0b63f6] text-white shadow-[0_4px_10px_rgba(11,99,246,0.2)]"
          : "border-[#d8dee9] bg-white text-[#344054] hover:border-[#1677ff] hover:text-[#1677ff]"
      }`}
    >
      {children}
    </button>
  );
}

function DeleteProtectionPanel({
  cleanupSummary,
  onViewDetails,
}: {
  cleanupSummary: RecycleRiskSummary;
  onViewDetails: () => void;
}) {
  return (
    <aside className="space-y-5 rounded-[8px] border border-[#ffd8d2] bg-[#fffaf8] p-5 shadow-[0_2px_12px_rgba(255,77,79,0.05)]">
      <h2 className="text-[20px] font-semibold text-[#101828]">删除保护</h2>
      <div className="space-y-2">
        <ProtectionNotice icon={ShieldAlert} tone="red">
          永久删除前必须列出文件数量、总大小、来源模块。
        </ProtectionNotice>
        <ProtectionNotice icon={AlertCircle} tone="orange">
          清理过期前需要二次确认。
        </ProtectionNotice>
        <ProtectionNotice icon={ShieldCheck} tone="green">
          默认优先恢复，不鼓励直接永久删除。
        </ProtectionNotice>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-[#ffd8d2] bg-white">
        <div className="flex items-center gap-2 bg-[#fff1f0] px-4 py-3 font-semibold text-[#101828]">
          <AlertTriangle size={18} className="text-[#e5484d]" />
          风险影响范围
        </div>
        <div className="divide-y divide-[#eef2f6] px-4 text-[15px]">
          <RiskRow label="文件数量" value={`${cleanupSummary.fileCount} 个`} danger />
          <RiskRow label="预计释放" value={cleanupSummary.releaseSizeLabel} danger={cleanupSummary.releaseSizeLabel !== "未提供"} />
          <RiskRow label="涉及模块" value={cleanupSummary.sourceLabels.join("、") || "-"} />
        </div>
        <div className="px-4 py-4">
          <button
            type="button"
            onClick={onViewDetails}
            disabled={cleanupSummary.fileCount === 0}
            className="inline-flex h-11 w-full items-center justify-center rounded-[4px] border border-[#9bbcff] bg-white text-[16px] font-semibold text-[#0b63f6] transition hover:border-[#1677ff] hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            查看清理明细
          </button>
        </div>
      </div>
    </aside>
  );
}

function ProtectionNotice({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof ShieldAlert;
  tone: "red" | "orange" | "green";
  children: React.ReactNode;
}) {
  const toneClassName = {
    red: "text-[#e5484d]",
    orange: "text-[#ff7a00]",
    green: "text-[#12a150]",
  }[tone];
  return (
    <div className="flex items-start gap-4 rounded-[8px] border border-[#ffd8d2] bg-[#fff4f1] px-4 py-4 text-[15px] font-semibold leading-6 text-[#344054]">
      <Icon size={22} className={`mt-0.5 shrink-0 ${toneClassName}`} />
      <span>{children}</span>
    </div>
  );
}

function RiskRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="shrink-0 text-[#344054]">{label}</span>
      <span className={`min-w-0 text-right font-semibold ${danger ? "text-[#ff1f2f]" : "text-[#101828]"}`}>{value}</span>
    </div>
  );
}

function RestoreConfirmDialog({
  intent,
  processing,
  onCancel,
  onConfirm,
}: {
  intent: RestoreIntent;
  processing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const item = intent.items[0];
  const isBulk = intent.mode === "bulk";
  const summary = buildRecycleRiskSummary(intent.items);
  return (
    <DialogFrame title={isBulk ? "确认批量恢复文件" : "确认恢复文件"} onClose={onCancel}>
      <div className="space-y-3 text-[15px] text-[#101828]">
        {isBulk ? (
          <>
            <DetailRow label="文件数量：" value={`${summary.fileCount} 个`} />
            <DetailRow label="来源模块：" value={summary.sourceLabels.join("、") || "-"} />
            <DetailRow label="恢复位置：" value="将恢复到原始位置" />
          </>
        ) : (
          <>
            <DetailRow label="文件名：" value={getRecycleFileName(item)} />
            <DetailRow label="来源模块：" value={getRecycleSourceLabel(item.resourceType)} />
            <DetailRow label="文件大小：" value={getRecycleFileSizeLabel(item)} />
            <DetailRow label="删除人：" value={getDeletedByDisplay(item)} />
            <DetailRow label="删除时间：" value={formatDateTime(item.deletedAt)} />
            <DetailRow label="恢复位置：" value="将恢复到原始位置" />
          </>
        )}
      </div>
      <div className="mt-6 flex items-start gap-3 rounded-[4px] border border-[#b7d3ff] bg-[#f4f8ff] px-4 py-3 text-sm leading-5 text-[#475467]">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#0b63f6]" />
        <span>提示：如果原位置已有同名文件，将自动追加恢复版本后缀。</span>
      </div>
      <div className="mt-8 flex justify-end gap-3">
        <DialogButton onClick={onCancel}>取消</DialogButton>
        <DialogButton primary onClick={onConfirm} disabled={processing}>
          {processing ? "恢复中..." : "确认恢复"}
        </DialogButton>
      </div>
    </DialogFrame>
  );
}

function PermanentDeleteDialog({
  intent,
  value,
  processing,
  onChange,
  onCancel,
  onConfirm,
}: {
  intent: PurgeIntent;
  value: string;
  processing: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const summary = intent.summary ?? buildRecycleRiskSummary(intent.items);
  const sourceBreakdown = intent.sourceBreakdown ?? buildRecycleSourceBreakdown(intent.items);
  const title = intent.mode === "single" ? "确认永久删除文件" : intent.mode === "bulk" ? "确认批量永久删除文件" : "确认清理过期文件";
  const canConfirm = value === PERMANENT_DELETE_CONFIRM_TEXT;
  return (
    <DialogFrame title={title} widthClassName="max-w-[640px]" onClose={onCancel}>
      <div className="flex gap-6">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#ffe1e3] text-[#ff1f2f]">
          <AlertTriangle size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <ul className="space-y-2 text-[16px] leading-6 text-[#101828]">
            <li>· 将删除文件数量： <span className="font-semibold text-[#ff1f2f]">{summary.fileCount}</span></li>
            <li>· 总大小： <span className="font-semibold text-[#ff1f2f]">{summary.releaseSizeLabel}</span></li>
            <li>
              · 来源模块：
              {sourceBreakdown.length > 0 ? sourceBreakdown.map((item) => (
                <span key={item.label}> {item.label} <span className="font-semibold text-[#ff1f2f]">{item.count}</span></span>
              )) : " -"}
            </li>
            <li className="font-semibold text-[#ff1f2f]">· 删除后无法恢复</li>
            <li>· 建议先确认不再需要这些文件</li>
          </ul>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="mb-2 block text-[15px] font-semibold text-[#101828]">请输入“永久删除”继续</span>
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="永久删除"
          className="h-11 w-full rounded-[4px] border border-[#ff6b6b] bg-white px-4 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:ring-2 focus:ring-[#ff4d4f]/15"
        />
      </label>

      <div className="mt-4 flex items-center gap-3 rounded-[4px] border border-[#ffc4c4] bg-[#fff1f0] px-4 py-3 text-[15px] font-semibold text-[#e5484d]">
        <AlertCircle size={19} className="shrink-0" />
        <span>风险提示：此操作将永久删除所选文件，且无法恢复，请谨慎操作。</span>
      </div>

      <div className="mt-7 flex justify-end gap-3">
        <DialogButton onClick={onCancel}>取消</DialogButton>
        <DialogButton danger onClick={onConfirm} disabled={!canConfirm || processing}>
          {processing ? "删除中..." : "确认永久删除"}
        </DialogButton>
      </div>
    </DialogFrame>
  );
}

function DialogFrame({
  title,
  widthClassName = "max-w-[590px]",
  onClose,
  children,
}: {
  title: string;
  widthClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 px-4 py-6" onMouseDown={onClose}>
      <div
        className={`w-full ${widthClassName} rounded-[10px] bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.32)]`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-[24px] font-semibold leading-tight text-[#101828]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭弹窗"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#344054] transition hover:bg-[#f2f4f7] hover:text-[#101828]"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-5">
      <span className="font-semibold text-[#667085]">{label}</span>
      <span className="min-w-0 break-words text-[#101828]">{value}</span>
    </div>
  );
}

function DialogButton({
  primary,
  danger,
  disabled,
  onClick,
  children,
}: {
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const className = danger
    ? "bg-[#ff1728] text-white shadow-[0_6px_14px_rgba(255,23,40,0.22)] hover:bg-[#d90f1d]"
    : primary
      ? "bg-[#0b63f6] text-white shadow-[0_6px_14px_rgba(11,99,246,0.22)] hover:bg-[#0958d9]"
      : "border border-[#d8dee9] bg-white text-[#344054] hover:border-[#1677ff] hover:text-[#1677ff]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 min-w-[112px] items-center justify-center rounded-[4px] px-5 text-[16px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
    >
      {children}
    </button>
  );
}

function normalizeRecycleStats(stats: FileRecycleStats | undefined, records: FileRecycleItem[], total: number) {
  const fallback = buildRecycleStats(records, total);
  return {
    totalRecords: normalizeNumber(stats?.totalRecords, fallback.totalRecords),
    currentPageRecords: normalizeNumber(stats?.currentPageRecords, fallback.currentPageRecords),
    recoverableRecords: normalizeNumber(stats?.recoverableRecords, fallback.recoverableRecords),
    expiringSoonRecords: normalizeNumber(stats?.expiringSoonRecords, fallback.expiringSoonRecords),
    todayDeletedRecords: normalizeNumber(stats?.todayDeletedRecords, fallback.todayDeletedRecords),
    expiredRecords: normalizeNumber(stats?.expiredRecords, fallback.expiredRecords),
    totalFileCount: normalizeNumber(stats?.totalFileCount, fallback.totalFileCount),
    totalSizeBytes: normalizeNumber(stats?.totalSizeBytes, fallback.totalSizeBytes),
    totalSizeLabel: stats?.totalSizeLabel?.trim() || fallback.totalSizeLabel || "未提供",
    hasUnknownSize: stats?.hasUnknownSize ?? fallback.hasUnknownSize,
    sourceModules: stats?.sourceModules ?? fallback.sourceModules,
    expiredFileCount: normalizeNumber(stats?.expiredFileCount, fallback.expiredFileCount),
    expiredSizeBytes: normalizeNumber(stats?.expiredSizeBytes, fallback.expiredSizeBytes),
    expiredSizeLabel: stats?.expiredSizeLabel?.trim() || fallback.expiredSizeLabel || "未提供",
    hasUnknownExpiredSize: stats?.hasUnknownExpiredSize ?? fallback.hasUnknownExpiredSize,
    expiredSourceModules: stats?.expiredSourceModules ?? fallback.expiredSourceModules,
    expiredSourceModuleCounts: stats?.expiredSourceModuleCounts ?? fallback.expiredSourceModuleCounts,
  };
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getDeletedByDisplay(item: FileRecycleItem) {
  return item.deletedByName?.trim() || getRecycleDeletedByLabel(item.deletedBy);
}

function buildExpiredCleanupSummary(stats: ReturnType<typeof normalizeRecycleStats>): RecycleRiskSummary {
  return {
    fileCount: stats.expiredFileCount,
    releaseSizeLabel: stats.expiredSizeLabel,
    sourceLabels: stats.expiredSourceModules,
  };
}

function buildExpiredSourceBreakdown(stats: ReturnType<typeof normalizeRecycleStats>) {
  return stats.expiredSourceModuleCounts
    .filter((item) => item.label && item.count > 0)
    .map((item) => ({ label: item.label, count: item.count }));
}

function normalizeDeletedByOptions(serverOptions: DeletedByOption[] | undefined, records: FileRecycleItem[]) {
  const normalizedOptions = (serverOptions ?? [])
    .filter((option) => option.value !== null && option.value !== undefined && option.value !== "")
    .map((option) => ({ value: String(option.value), label: option.label || String(option.value) }));
  if (normalizedOptions.length > 0) {
    return [{ value: "all", label: "全部" }, ...normalizedOptions];
  }
  const options = [{ value: "all", label: "全部" }];
  const values = Array.from(new Set(records.map((item) => item.deletedBy).filter((value) => value !== null && value !== undefined && value !== "")));
  values.forEach((value) => {
    const record = records.find((item) => String(item.deletedBy ?? "") === String(value));
    options.push({ value: String(value), label: record?.deletedByName?.trim() || getRecycleDeletedByLabel(value) });
  });
  return options;
}

function buildPageNumbers(current: number, pages: number) {
  const count = Math.min(4, pages);
  const start = Math.min(Math.max(1, current - 1), Math.max(1, pages - count + 1));
  return Array.from({ length: count }, (_, index) => start + index);
}

const recycleInputClassName = "h-10 w-full rounded-[4px] border border-[#d8dee9] bg-white px-3 text-sm text-[#344054] outline-none transition placeholder:text-[#98a2b3] focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10";
