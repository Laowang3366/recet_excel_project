import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";

import { useAdminBulkSelection } from "../admin/bulk-selection";
import {
  AdminBulkActions,
  AdminBulkCheckbox,
  AdminEmptyState,
  AdminPageShell,
  AdminPagination,
  AdminSection,
  AdminStatCard,
  AdminStatGrid,
  FilterBar,
  FilterField,
  inputClassName,
  secondaryButtonClassName,
  statusBadgeClassName,
} from "../admin/shared";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { adminKeys } from "../lib/query-keys";
import { adminRequest, openAdminConfirm, showAdminSuccess, useAdminRole } from "./AdminConsoleShared";

type FileRecycleItem = {
  id: number;
  resourceType: string;
  resourceId: number;
  displayName?: string | null;
  originalFileUrl?: string | null;
  recycleFileUrl?: string | null;
  fileCount?: number;
  deletedBy?: number | null;
  deletedAt?: string | null;
  expiresAt?: string | null;
  expired?: boolean;
  status?: string | null;
};

type FileRecyclePage = {
  records?: FileRecycleItem[];
  total?: number;
  page?: number;
  size?: number;
};

const resourceOptions = [
  { value: "all", label: "全部业务" },
  { value: "question", label: "题库题目" },
  { value: "template", label: "模板中心" },
  { value: "qa_case", label: "QA 求助" },
  { value: "qa_answer", label: "QA 答疑" },
];

const expiredOptions = [
  { value: "all", label: "全部状态" },
  { value: "false", label: "未过期" },
  { value: "true", label: "已过期" },
];

export function AdminFileRecycleBin() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [resourceType, setResourceType] = useState("all");
  const [expired, setExpired] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [bulkPurging, setBulkPurging] = useState(false);

  const params = useMemo(() => ({
    resourceType,
    expired,
    keyword: keyword.trim(),
    page,
    size: 20,
  }), [resourceType, expired, keyword, page]);

  const listQuery = useQuery({
    queryKey: adminKeys.fileRecycleBin(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("size", "20");
      if (resourceType !== "all") searchParams.set("resourceType", resourceType);
      if (expired !== "all") searchParams.set("expired", expired);
      if (keyword.trim()) searchParams.set("keyword", keyword.trim());
      return adminRequest<FileRecyclePage>(api.get(`/api/admin/file-recycle-bin?${searchParams.toString()}`, { silent: true }), navigate, role);
    },
  });

  const records = listQuery.data?.records ?? [];
  const total = listQuery.data?.total ?? 0;
  const bulk = useAdminBulkSelection(records, (item) => item.id);

  const refresh = async () => {
    bulk.clear();
    await queryClient.invalidateQueries({ queryKey: ["admin", "file-recycle-bin"] });
  };

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => adminRequest(api.post(`/api/admin/file-recycle-bin/${id}/restore`), navigate, role, "恢复文件"),
    onSuccess: async (result) => {
      if (!result) return;
      showAdminSuccess("已恢复业务记录和文件");
      await refresh();
    },
  });

  const purgeMutation = useMutation({
    mutationFn: async (id: number) => adminRequest(api.delete(`/api/admin/file-recycle-bin/${id}`), navigate, role, "彻底删除"),
    onSuccess: async (result) => {
      if (!result) return;
      showAdminSuccess("已彻底删除");
      await refresh();
    },
  });

  const purgeExpiredMutation = useMutation({
    mutationFn: async () => adminRequest(api.post("/api/admin/file-recycle-bin/purge-expired"), navigate, role, "清理过期文件"),
    onSuccess: async (result) => {
      if (!result) return;
      showAdminSuccess("已清理过期文件");
      await refresh();
    },
  });

  const handleRestore = async (item: FileRecycleItem) => {
    const confirmed = await openAdminConfirm({
      title: "恢复文件",
      message: "恢复后，业务记录会重新出现在对应模块中，文件会移回可访问目录。",
      confirmLabel: "恢复",
    });
    if (confirmed) restoreMutation.mutate(item.id);
  };

  const handlePurge = async (item: FileRecycleItem) => {
    const confirmed = await openAdminConfirm({
      title: "彻底删除",
      message: "彻底删除会移除回收站文件和业务记录，该 ID 不会复用。",
      confirmLabel: "彻底删除",
      destructive: true,
    });
    if (confirmed) purgeMutation.mutate(item.id);
  };

  const handleBulkPurge = async () => {
    const confirmed = await openAdminConfirm({
      title: "批量彻底删除",
      message: `将彻底删除 ${bulk.selectedCount} 条回收站记录，删除后不能恢复。`,
      confirmLabel: "彻底删除",
      destructive: true,
    });
    if (!confirmed) return;
    setBulkPurging(true);
    try {
      const result = await adminRequest(
        api.delete("/api/admin/file-recycle-bin/batch", { ids: bulk.selectedItems.map((item) => item.id) }),
        navigate,
        role,
        "批量彻底删除",
      );
      if (result) {
        showAdminSuccess("已批量彻底删除");
        await refresh();
      }
    } finally {
      setBulkPurging(false);
    }
  };

  const handlePurgeExpired = async () => {
    const confirmed = await openAdminConfirm({
      title: "清理过期文件",
      message: "将彻底删除已超过保留期的回收站文件和对应业务记录。",
      confirmLabel: "清理",
      destructive: true,
    });
    if (confirmed) purgeExpiredMutation.mutate();
  };

  return (
    <AdminPageShell>
      <AdminStatGrid>
        <AdminStatCard label="回收文件" value={total} hint={`当前页 ${records.length}`} />
        <AdminStatCard label="可恢复" value={records.filter((item) => !item.expired).length} hint="仍在保留期" />
        <AdminStatCard label="当前筛选" value={records.length} hint="本页记录" />
        <AdminStatCard label="过期清理" value={records.filter((item) => item.expired).length} hint="建议确认" />
      </AdminStatGrid>
      <AdminSection
        title="文件回收站"
        actions={(
          <button type="button" onClick={handlePurgeExpired} disabled={purgeExpiredMutation.isPending} className={secondaryButtonClassName()}>
            <Trash2 size={14} />
            {purgeExpiredMutation.isPending ? "清理中..." : "清理过期文件"}
          </button>
        )}
      >
        <FilterBar>
          <FilterField label="业务类型">
            <select value={resourceType} onChange={(event) => { setResourceType(event.target.value); setPage(1); }} className={inputClassName()}>
              {resourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FilterField>
          <FilterField label="过期状态">
            <select value={expired} onChange={(event) => { setExpired(event.target.value); setPage(1); }} className={inputClassName()}>
              {expiredOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FilterField>
          <FilterField label="文件名 / 标题">
            <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} className={inputClassName()} placeholder="搜索标题或文件路径" />
          </FilterField>
        </FilterBar>

        <div className="mt-4">
          <AdminBulkActions
            selectedCount={bulk.selectedCount}
            totalCount={records.length}
            allVisibleSelected={bulk.allVisibleSelected}
            deleteLabel="彻底删除选中"
            processingLabel="删除中..."
            deleting={bulkPurging}
            onToggleAll={bulk.toggleAllVisible}
            onClear={bulk.clear}
            onDeleteSelected={handleBulkPurge}
          />

          {records.length === 0 ? (
            <AdminEmptyState message={listQuery.isLoading ? "正在加载回收站..." : "暂无回收站文件"} />
          ) : (
            <div className="overflow-x-auto rounded-[2px] border border-[#f0f0f0]">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-[#fafafa] text-xs font-bold uppercase tracking-wide text-[#8c8c8c]">
                  <tr>
                    <th className="w-12 px-3 py-3">
                      <AdminBulkCheckbox checked={bulk.allVisibleSelected} onChange={bulk.toggleAllVisible} label="全选本页回收站记录" />
                    </th>
                    <th className="px-3 py-3">业务</th>
                    <th className="px-3 py-3">文件</th>
                    <th className="px-3 py-3">删除时间</th>
                    <th className="px-3 py-3">保留到期</th>
                    <th className="px-3 py-3">状态</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {records.map((item) => (
                    <tr key={item.id} className="bg-white align-top">
                      <td className="px-3 py-3">
                        <AdminBulkCheckbox checked={bulk.isSelected(item.id)} onChange={() => bulk.toggleOne(item.id)} label={`选择回收站记录 ${item.id}`} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-[#262626]">{item.displayName || "未命名记录"}</div>
                        <div className="mt-1 text-xs text-[#8c8c8c]">{formatResourceType(item.resourceType)} · ID {item.resourceId}</div>
                      </td>
                      <td className="max-w-[360px] px-3 py-3">
                        <div className="truncate font-mono text-xs text-[#595959]" title={item.originalFileUrl || ""}>{item.originalFileUrl || "-"}</div>
                        <div className="mt-1 text-xs text-[#8c8c8c]">文件 {item.fileCount ?? 0} 个</div>
                      </td>
                      <td className="px-3 py-3 text-[#595959]">{formatDateTime(item.deletedAt)}</td>
                      <td className="px-3 py-3 text-[#595959]">{formatDateTime(item.expiresAt)}</td>
                      <td className="px-3 py-3">
                        <span className={statusBadgeClassName(item.expired ? "deleted" : "active")}>{item.expired ? "已过期" : "保留中"}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => handleRestore(item)} disabled={restoreMutation.isPending} className={secondaryButtonClassName()}>
                            <ArchiveRestore size={14} />
                            恢复
                          </button>
                          <button type="button" onClick={() => handlePurge(item)} disabled={purgeMutation.isPending} className={`${secondaryButtonClassName()} !border-rose-200 !text-rose-600`}>
                            <Trash2 size={14} />
                            彻底删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4">
            <AdminPagination current={page} size={20} total={total} onChange={setPage} />
          </div>
        </div>
      </AdminSection>
    </AdminPageShell>
  );
}

function formatResourceType(value: string) {
  const map: Record<string, string> = {
    question: "题库题目",
    template: "模板中心",
    qa_case: "QA 求助",
    qa_answer: "QA 答疑",
  };
  return map[value] || value || "-";
}
