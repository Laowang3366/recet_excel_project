import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileImage,
  FileSpreadsheet,
  ListChecks,
  Mail,
  MessageSquareText,
  Search,
  Send,
  Star,
  UserRoundPlus,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";

import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { QaCaseAnswer, QaCaseHelp, QaPageResponse, QaSolutionShare } from "../lib/qa";
import { adminKeys } from "../lib/query-keys";
import {
  AdminBulkCheckbox,
  AdminPageShell,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "../admin/shared";
import { runSequentialAdminBulkAction, useAdminBulkSelection } from "../admin/bulk-selection";
import {
  buildAdminQaRows,
  buildAdminQaStatCards,
  type AdminQaFeedbackRecord,
  type AdminQaRow,
  type AdminQaTabKey,
} from "../admin/admin-qa-view-model";
import { adminRequest, openAdminConfirm, openAdminPrompt, showAdminError, showAdminSuccess, useAdminRole } from "./AdminConsoleShared";

type AdminQaStats = {
  cases?: number;
  pendingCases?: number;
  answeredCases?: number;
  answers?: number;
  pendingAnswers?: number;
  solutionShares?: number;
  featuredShares?: number;
  feedback?: number;
  unreadFeedback?: number;
};

const QA_TABS: Array<{ key: AdminQaTabKey; label: string }> = [
  { key: "cases", label: "案例求助" },
  { key: "answers", label: "答疑提交" },
  { key: "shares", label: "解题分享" },
  { key: "feedback", label: "答疑者反馈" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "open", label: "待处理" },
  { value: "answered", label: "已回复" },
  { value: "active", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已驳回" },
  { value: "accepted", label: "已沉淀" },
  { value: "handled", label: "已处理" },
  { value: "closed", label: "已关闭" },
];

export function AdminQa() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminQaTabKey>("cases");
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("该问题可沉淀为函数案例，建议补充标准解法与错误原因说明。");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const listParams = { page, size: pageSize };
  const caseStatusParam = activeTab === "cases" && ["open", "answered", "accepted", "closed"].includes(statusFilter)
    ? `&status=${encodeURIComponent(statusFilter)}`
    : "";

  const statsQuery = useQuery({
    queryKey: adminKeys.qaStats(),
    queryFn: async () => adminRequest<AdminQaStats>(api.get("/api/admin/qa/stats", { silent: true }), navigate, role),
  });
  const casesQuery = useQuery({
    queryKey: adminKeys.qaCases({ ...listParams, status: caseStatusParam || "all" }),
    queryFn: async () => adminRequest<QaPageResponse<QaCaseHelp>>(
      api.get(`/api/admin/qa/cases?page=${page}&size=${pageSize}${caseStatusParam}`, { silent: true }),
      navigate,
      role,
    ),
  });
  const answersQuery = useQuery({
    queryKey: adminKeys.qaAnswers(listParams),
    queryFn: async () => adminRequest<QaPageResponse<QaCaseAnswer>>(
      api.get(`/api/admin/qa/answers?page=${page}&size=${pageSize}`, { silent: true }),
      navigate,
      role,
    ),
  });
  const sharesQuery = useQuery({
    queryKey: adminKeys.qaSolutionShares(listParams),
    queryFn: async () => adminRequest<QaPageResponse<QaSolutionShare>>(
      api.get(`/api/admin/qa/solution-shares?page=${page}&size=${pageSize}`, { silent: true }),
      navigate,
      role,
    ),
  });
  const feedbackQuery = useQuery({
    queryKey: adminKeys.qaFeedback(listParams),
    queryFn: async () => adminRequest<QaPageResponse<AdminQaFeedbackRecord>>(
      api.get(`/api/admin/qa/feedback?page=${page}&size=${pageSize}`, { silent: true }),
      navigate,
      role,
    ),
  });

  const refreshAdminQa = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "qa"] });
  };

  const updateCaseMutation = useMutation({
    mutationFn: ({ item, status }: { item: QaCaseHelp; status: string }) => adminRequest(api.put(`/api/admin/qa/cases/${item.id}`, buildCaseUpdatePayload(item, status), { silent: true }), navigate, role, "更新求助状态"),
    onSuccess: async (result) => {
      if (!result) return;
      await refreshAdminQa();
      showAdminSuccess("求助状态已更新");
    },
  });

  const assignCaseMutation = useMutation({
    mutationFn: ({ caseId, nextAssigneeUserId, note }: { caseId: number; nextAssigneeUserId: number; note?: string }) => adminRequest(
      api.put(`/api/admin/qa/cases/${caseId}/assign`, { assigneeUserId: nextAssigneeUserId, note }, { silent: true }),
      navigate,
      role,
      "分配答疑者",
    ),
    onSuccess: async (result) => {
      if (!result) return;
      await refreshAdminQa();
      showAdminSuccess("答疑者已分配");
    },
  });

  const reviewAnswerMutation = useMutation({
    mutationFn: ({ answerId, action, note }: { answerId: number; action: "approve" | "reject"; note?: string }) => adminRequest(
      api.put(`/api/admin/qa/answers/${answerId}/review`, { action, note }, { silent: true }),
      navigate,
      role,
      action === "approve" ? "审核通过" : "审核驳回",
    ),
    onSuccess: async (result) => {
      if (!result) return;
      await refreshAdminQa();
      showAdminSuccess("答疑审核状态已更新");
    },
  });

  const createFeaturedMutation = useMutation({
    mutationFn: ({ item, answer, note }: { item: QaCaseHelp; answer?: QaCaseAnswer | null; note: string }) => adminRequest(
      api.post("/api/admin/qa/featured-shares", {
        caseId: item.id,
        answerId: answer?.id,
        title: item.title || `案例求助 #${item.id}`,
        thoughtText: note || item.description || "已沉淀为精选案例。",
      }, { silent: true }),
      navigate,
      role,
      "转为精选案例",
    ),
    onSuccess: async (result) => {
      if (!result) return;
      await refreshAdminQa();
      showAdminSuccess("已转为精选案例");
    },
  });

  const batchReviewMutation = useMutation({
    mutationFn: ({ ids, action, note }: { ids: number[]; action: "approve" | "reject"; note?: string }) => adminRequest<{ successCount?: number; failedCount?: number }>(
      api.post("/api/admin/qa/answers/batch-review", { ids, action, note }, { silent: true }),
      navigate,
      role,
      action === "approve" ? "批量通过" : "批量驳回",
    ),
    onSuccess: async (result) => {
      if (!result) return;
      await refreshAdminQa();
      rowSelection.clear();
      setBatchOpen(false);
      const failed = result.failedCount ?? 0;
      if (failed > 0) {
        showAdminError(`批量审核完成 ${result.successCount ?? 0} 条，失败 ${failed} 条`);
        return;
      }
      showAdminSuccess(`批量审核完成 ${result.successCount ?? 0} 条`);
    },
  });

  const batchAssignMutation = useMutation({
    mutationFn: ({ ids, nextAssigneeUserId, note }: { ids: number[]; nextAssigneeUserId: number; note?: string }) => adminRequest<{ successCount?: number; failedCount?: number }>(
      api.post("/api/admin/qa/cases/batch-assign", { ids, assigneeUserId: nextAssigneeUserId, note }, { silent: true }),
      navigate,
      role,
      "批量分配答疑者",
    ),
    onSuccess: async (result) => {
      if (!result) return;
      await refreshAdminQa();
      rowSelection.clear();
      setBatchOpen(false);
      showAdminSuccess(`已分配 ${result.successCount ?? 0} 条案例`);
    },
  });

  const cases = casesQuery.data?.records || [];
  const answers = answersQuery.data?.records || [];
  const shares = sharesQuery.data?.records || [];
  const feedback = feedbackQuery.data?.records || [];
  const stats = statsQuery.data || {};
  const selectedCase = cases.find((item) => item.id === selectedCaseId) || cases[0] || null;
  const selectedCaseAnswers = selectedCase ? answers.filter((item) => item.caseId === selectedCase.id) : [];
  const selectedReviewAnswer = selectedCaseAnswers.find((item) => item.status === "active") || selectedCaseAnswers[0] || null;
  const statCards = useMemo(() => buildAdminQaStatCards({
    ...stats,
    pendingAnswers: stats.pendingAnswers ?? answers.filter((item) => item.status === "active").length,
    feedback: feedbackQuery.data?.total ?? feedback.length,
    unreadFeedback: stats.unreadFeedback ?? feedback.filter((item) => !item.status || item.status === "active" || item.status === "pending").length,
  }), [answers, feedback, feedbackQuery.data?.total, stats]);
  const rows = useMemo(() => buildAdminQaRows({
    tab: activeTab,
    cases,
    answers,
    shares,
    feedback,
    keyword: appliedKeyword,
    status: statusFilter,
  }), [activeTab, appliedKeyword, answers, cases, feedback, shares, statusFilter]);
  const rowSelection = useAdminBulkSelection(rows, (item) => `${item.source}-${item.id}`);
  const activeTotal = resolveActiveTotal(activeTab, casesQuery.data?.total, answersQuery.data?.total, sharesQuery.data?.total, feedbackQuery.data?.total);
  const pageCount = Math.max(1, Math.ceil(activeTotal / Math.max(pageSize, 1)));
  const batchRows = rowSelection.selectedItems;

  const submitSearch = () => {
    setAppliedKeyword(keyword.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setKeyword("");
    setAppliedKeyword("");
    setPage(1);
  };

  const openDrawerForRow = (row?: AdminQaRow) => {
    if (row?.source === "case") {
      setSelectedCaseId(row.id);
      const original = row.original as QaCaseHelp;
      setAssigneeUserId(original.assignedUserId ? String(original.assignedUserId) : "");
    } else {
      const caseId = getRowCaseId(row);
      if (caseId) setSelectedCaseId(caseId);
    }
    setDrawerOpen(true);
  };

  const openBatchDialog = () => {
    if (rowSelection.selectedCount === 0) {
      showAdminError("请先勾选需要批量处理的记录");
      return;
    }
    setBatchOpen(true);
  };

  const approveSelectedCase = () => {
    if (!selectedCase || isReviewProcessing(updateCaseMutation.isPending, reviewAnswerMutation.isPending)) return;
    if (selectedReviewAnswer) {
      reviewAnswerMutation.mutate({ answerId: selectedReviewAnswer.id, action: "approve", note: reviewNote });
      return;
    }
    updateCaseMutation.mutate({ item: selectedCase, status: "accepted" });
  };

  const rejectSelectedCase = async () => {
    if (!selectedCase || isReviewProcessing(updateCaseMutation.isPending, reviewAnswerMutation.isPending)) return;
    const confirmed = await openAdminConfirm({
      title: selectedReviewAnswer ? "驳回答疑" : "驳回并关闭求助",
      message: selectedReviewAnswer ? "驳回后该答疑不会进入前台展示，答疑者可重新提交。" : "当前求助会被关闭并从待处理流程移出。",
      confirmLabel: selectedReviewAnswer ? "确认驳回" : "确认关闭",
      destructive: true,
    });
    if (!confirmed) return;
    if (selectedReviewAnswer) {
      reviewAnswerMutation.mutate({ answerId: selectedReviewAnswer.id, action: "reject", note: reviewNote });
      return;
    }
    updateCaseMutation.mutate({ item: selectedCase, status: "closed" });
  };

  const assignSelectedCase = async () => {
    if (!selectedCase || assignCaseMutation.isPending) return;
    const nextAssigneeUserId = await resolveAssigneeUserId(assigneeUserId, selectedCase.assignedUserId);
    if (!nextAssigneeUserId) return;
    setAssigneeUserId(String(nextAssigneeUserId));
    assignCaseMutation.mutate({ caseId: selectedCase.id, nextAssigneeUserId, note: reviewNote });
  };

  const assignRowCase = async (row: AdminQaRow) => {
    const caseId = getRowCaseId(row);
    if (!caseId || assignCaseMutation.isPending) return;
    const original = row.original as { assignedUserId?: number | null };
    const nextAssigneeUserId = await resolveAssigneeUserId(assigneeUserId, original.assignedUserId);
    if (!nextAssigneeUserId) return;
    setAssigneeUserId(String(nextAssigneeUserId));
    assignCaseMutation.mutate({ caseId, nextAssigneeUserId, note: reviewNote });
  };

  const createFeaturedCase = () => {
    if (!selectedCase || createFeaturedMutation.isPending) return;
    createFeaturedMutation.mutate({ item: selectedCase, answer: selectedReviewAnswer, note: reviewNote });
  };

  const batchAssignCases = async () => {
    const caseRows = batchRows.filter((row) => row.source === "case");
    if (!caseRows.length || batchAssignMutation.isPending) {
      showAdminError("请选择需要分配的案例求助记录");
      return;
    }
    const nextAssigneeUserId = await resolveAssigneeUserId(assigneeUserId);
    if (!nextAssigneeUserId) return;
    setAssigneeUserId(String(nextAssigneeUserId));
    batchAssignMutation.mutate({
      ids: caseRows.map((row) => row.id),
      nextAssigneeUserId,
      note: reviewNote,
    });
  };

  const reviewBatchRows = async (action: "approve" | "reject") => {
    if (batchProcessing || batchReviewMutation.isPending) return;
    const answerRows = batchRows.filter((row) => row.source === "answer");
    const caseRows = batchRows.filter((row) => row.source === "case");
    if (!answerRows.length && !caseRows.length) {
      showAdminError("请选择案例求助或答疑提交记录");
      return;
    }

    if (answerRows.length && !caseRows.length) {
      batchReviewMutation.mutate({ ids: answerRows.map((row) => row.id), action, note: reviewNote });
      return;
    }

    setBatchProcessing(true);
    const caseResult = await runSequentialAdminBulkAction(caseRows, (row) => {
      const item = row.original as QaCaseHelp;
      return api.put(`/api/admin/qa/cases/${item.id}`, buildCaseUpdatePayload(item, action === "approve" ? "accepted" : "closed"), { silent: true });
    });
    const answerResult = answerRows.length
      ? await adminRequest<{ successCount?: number; failedCount?: number }>(
        api.post("/api/admin/qa/answers/batch-review", { ids: answerRows.map((row) => row.id), action, note: reviewNote }, { silent: true }),
        navigate,
        role,
        action === "approve" ? "批量通过" : "批量驳回",
      )
      : null;
    setBatchProcessing(false);
    await refreshAdminQa();
    const failedCount = caseResult.failedCount + (answerResult?.failedCount ?? 0);
    const successCount = caseResult.successCount + (answerResult?.successCount ?? 0);
    if (failedCount > 0) {
      showAdminError(`批量处理完成 ${successCount} 条，失败 ${failedCount} 条`);
      return;
    }
    rowSelection.clear();
    setBatchOpen(false);
    showAdminSuccess(`批量处理完成 ${successCount} 条`);
  };

  const markSelectedCasesHandled = async () => {
    const actionableRows = batchRows.filter((row) => row.source === "case" || row.source === "feedback");
    if (!actionableRows.length || batchProcessing) {
      showAdminError("请选择案例求助或反馈记录");
      return;
    }
    setBatchProcessing(true);
    const result = await runSequentialAdminBulkAction(actionableRows, (row) => {
      if (row.source === "feedback") {
        return api.put(`/api/admin/qa/feedback/${row.id}/handle`, { status: "handled", note: reviewNote }, { silent: true });
      }
      const item = row.original as QaCaseHelp;
      return api.put(`/api/admin/qa/cases/${item.id}`, buildCaseUpdatePayload(item, "closed"), { silent: true });
    });
    setBatchProcessing(false);
    await refreshAdminQa();
    if (result.failedCount > 0) {
      showAdminError(`批量标记完成 ${result.successCount} 条，失败 ${result.failedCount} 条`);
      return;
    }
    rowSelection.clear();
    setBatchOpen(false);
    showAdminSuccess(`已标记 ${result.successCount} 条为已处理`);
  };

  return (
    <AdminPageShell
      actions={(
        <>
          <button type="button" onClick={() => void assignSelectedCase()} disabled={!selectedCase || assignCaseMutation.isPending} className={secondaryButtonClassName()}>
            <UserRoundPlus size={16} />
            分配答疑者
          </button>
          <button type="button" onClick={() => openDrawerForRow(rows.find((row) => row.actionMode !== "view") || rows[0])} className={primaryButtonClassName()}>
            处理待审核
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-4">
          {statCards.map((card) => <QaStatCard key={card.key} card={card} />)}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
          <div className="min-w-0 space-y-4">
            <QaTabBar activeTab={activeTab} onChange={(tab) => {
              setActiveTab(tab);
              setPage(1);
              rowSelection.clear();
            }} />

            <section className="rounded-[8px] border border-[#e5e7eb] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="border-b border-[#edf0f5] px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <h2 className="text-[18px] font-semibold text-[#101828]">{QA_TABS.find((item) => item.key === activeTab)?.label}列表</h2>
                  <button type="button" onClick={openBatchDialog} className={secondaryButtonClassName()}>
                    <ListChecks size={16} />
                    批量处理待审核
                  </button>
                </div>
                <div className="mt-4 rounded-[8px] border border-[#e5e7eb] bg-[#fbfcfe] p-3">
                  <div className="grid gap-3 lg:grid-cols-[150px_150px_minmax(220px,1fr)_auto_auto]">
                    <FilterSelect label="问题类型" value="all" onChange={() => undefined} options={[{ value: "all", label: "全部" }]} />
                    <FilterSelect label="状态" value={statusFilter} onChange={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }} options={STATUS_OPTIONS} />
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#344054]">关键词</span>
                      <div className="relative">
                        <input
                          value={keyword}
                          onChange={(event) => setKeyword(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") submitSearch();
                          }}
                          placeholder="请输入标题或用户"
                          className={`${inputClassName()} pr-9`}
                        />
                        <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" />
                      </div>
                    </label>
                    <button type="button" onClick={submitSearch} className={`${primaryButtonClassName()} mt-[30px]`}>搜索</button>
                    <button type="button" onClick={resetFilters} className={`${secondaryButtonClassName()} mt-[30px]`}>重置</button>
                  </div>
                </div>
              </div>

              <QaRowsTable
                rows={rows}
                selectedCount={rowSelection.selectedCount}
                allSelected={rowSelection.allVisibleSelected}
                isSelected={(row) => rowSelection.isSelected(`${row.source}-${row.id}`)}
                onToggleRow={(row) => rowSelection.toggleOne(`${row.source}-${row.id}`)}
                onToggleAll={rowSelection.toggleAllVisible}
                onRowOpen={(row) => {
                  if (row.source === "case") setSelectedCaseId(row.id);
                  openDrawerForRow(row);
                }}
                onAssign={(row) => {
                  if (row.actionMode === "review") {
                    openDrawerForRow(row);
                    return;
                  }
                  if (row.source === "case") setSelectedCaseId(row.id);
                  void assignRowCase(row);
                }}
              />

              <QaPagination
                total={activeTotal}
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </section>
          </div>

          <ReviewDetailPanel
            qaCase={selectedCase}
            answers={selectedCaseAnswers}
            note={reviewNote}
            onNoteChange={setReviewNote}
            onApprove={approveSelectedCase}
            onReject={() => void rejectSelectedCase()}
            onFeatured={createFeaturedCase}
            processing={isReviewProcessing(updateCaseMutation.isPending, reviewAnswerMutation.isPending, createFeaturedMutation.isPending)}
          />
        </div>
      </div>

      <ReviewDrawer
        open={drawerOpen}
        qaCase={selectedCase}
        answers={selectedCaseAnswers}
        note={reviewNote}
        assigneeUserId={assigneeUserId}
        onNoteChange={setReviewNote}
        onAssigneeUserIdChange={setAssigneeUserId}
        onClose={() => setDrawerOpen(false)}
        onApprove={approveSelectedCase}
        onReject={() => void rejectSelectedCase()}
        onAssign={() => void assignSelectedCase()}
        onFeatured={createFeaturedCase}
        processing={isReviewProcessing(updateCaseMutation.isPending, reviewAnswerMutation.isPending, createFeaturedMutation.isPending, assignCaseMutation.isPending)}
      />

      <BatchReviewModal
        open={batchOpen}
        rows={batchRows}
        selectedCount={rowSelection.selectedCount}
        isSelected={(row) => rowSelection.isSelected(`${row.source}-${row.id}`)}
        onToggleRow={(row) => rowSelection.toggleOne(`${row.source}-${row.id}`)}
        onClear={rowSelection.clear}
        onClose={() => setBatchOpen(false)}
        onMarkHandled={() => void markSelectedCasesHandled()}
        onAssign={() => void batchAssignCases()}
        onReview={(action) => void reviewBatchRows(action)}
        processing={batchProcessing || batchAssignMutation.isPending || batchReviewMutation.isPending}
      />
    </AdminPageShell>
  );
}

function QaStatCard({ card }: { card: ReturnType<typeof buildAdminQaStatCards>[number] }) {
  const tone = {
    green: { bg: "bg-[#10b981]", soft: "bg-[#ecfdf3]", icon: CircleHelp },
    orange: { bg: "bg-[#f79009]", soft: "bg-[#fff7e6]", icon: Send },
    blue: { bg: "bg-[#1677ff]", soft: "bg-[#eff6ff]", icon: Star },
    red: { bg: "bg-[#f04438]", soft: "bg-[#fff1f3]", icon: Mail },
  }[card.tone];
  const Icon = tone.icon;

  return (
    <div className="rounded-[8px] border border-[#e5e7eb] bg-white px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-5">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px] ${tone.bg} text-white shadow-[0_10px_18px_rgba(15,23,42,0.16)]`}>
          <Icon size={32} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-[#475467]">{card.label}</div>
          <div className="mt-1 text-[30px] font-semibold leading-none text-[#101828]">{card.value}</div>
          <div className="mt-2 text-[14px] text-[#344054]">
            {card.hintLabel}
            <span className={`ml-2 font-semibold ${card.tone === "red" ? "text-[#f04438]" : card.tone === "orange" ? "text-[#f79009]" : "text-[#1677ff]"}`}>
              {card.hintValue}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QaTabBar({ activeTab, onChange }: { activeTab: AdminQaTabKey; onChange: (tab: AdminQaTabKey) => void }) {
  return (
    <div className="flex overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
      {QA_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`relative h-12 min-w-[120px] px-6 text-[15px] font-medium transition ${activeTab === tab.key ? "text-[#1677ff]" : "text-[#475467] hover:text-[#1677ff]"}`}
        >
          {tab.label}
          {activeTab === tab.key ? <span className="absolute inset-x-5 bottom-0 h-[2px] rounded-full bg-[#1677ff]" /> : null}
        </button>
      ))}
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
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[#344054]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName()}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function QaRowsTable({
  rows,
  selectedCount,
  allSelected,
  isSelected,
  onToggleRow,
  onToggleAll,
  onRowOpen,
  onAssign,
}: {
  rows: AdminQaRow[];
  selectedCount: number;
  allSelected: boolean;
  isSelected: (row: AdminQaRow) => boolean;
  onToggleRow: (row: AdminQaRow) => void;
  onToggleAll: () => void;
  onRowOpen: (row: AdminQaRow) => void;
  onAssign: (row: AdminQaRow) => void;
}) {
  return (
    <div className="px-5 py-3">
      <div className="overflow-hidden rounded-[8px] border border-[#e5e7eb]">
        <table className="min-w-full table-fixed text-left text-sm">
          <thead className="bg-[#f8fafc] text-[13px] font-medium text-[#475467]">
            <tr>
              <th className="w-10 px-3 py-3">
                <AdminBulkCheckbox checked={allSelected} onChange={onToggleAll} label="选择本页记录" />
              </th>
              <th className="w-[28%] px-3 py-3">标题</th>
              <th className="w-[14%] px-3 py-3">用户</th>
              <th className="w-[14%] px-3 py-3">类型</th>
              <th className="w-[13%] px-3 py-3">状态</th>
              <th className="w-[17%] px-3 py-3">提交时间</th>
              <th className="w-[14%] px-3 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] bg-white">
            {rows.map((row, index) => (
              <tr key={`${row.source}-${row.id}`} className={`${index === 0 ? "bg-[#eff6ff]" : "hover:bg-[#f8fafc]"}`}>
                <td className="px-3 py-3">
                  <AdminBulkCheckbox checked={isSelected(row)} onChange={() => onToggleRow(row)} label={`选择${row.title}`} />
                </td>
                <td className="truncate px-3 py-3 font-medium text-[#344054]" title={row.title}>{row.title}</td>
                <td className="truncate px-3 py-3 text-[#475467]">{row.user}</td>
                <td className="truncate px-3 py-3 text-[#475467]">{row.typeLabel}</td>
                <td className="px-3 py-3"><QaStatusBadge tone={row.statusTone}>{row.statusLabel}</QaStatusBadge></td>
                <td className="truncate px-3 py-3 text-[#475467]">{formatAdminQaTime(row.submittedAt)}</td>
                <td className="px-3 py-3">
                  <div className="flex min-w-[82px] items-center gap-1.5 whitespace-nowrap font-semibold text-[#1677ff]">
                    <button type="button" onClick={() => onRowOpen(row)} className="whitespace-nowrap hover:text-[#0958d9]">查看</button>
                    {row.actionMode !== "view" ? (
                      <>
                        <span className="text-[#d0d5dd]">/</span>
                        <button type="button" onClick={() => onAssign(row)} className="whitespace-nowrap hover:text-[#0958d9]">
                          {row.actionMode === "assign" ? "分配" : "审核"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <div className="px-6 py-12 text-center text-sm text-[#98a2b3]">暂无符合条件的记录</div> : null}
      </div>
      {selectedCount > 0 ? <div className="mt-2 text-xs text-[#667085]">已选择 {selectedCount} 条，可打开批量处理待审核。</div> : null}
    </div>
  );
}

function QaPagination({
  total,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const pages = Array.from({ length: Math.min(pageCount, 5) }, (_, index) => index + 1);
  return (
    <div className="flex flex-col gap-3 border-t border-[#edf0f5] px-5 py-4 text-sm text-[#475467] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <span>共 {total} 条</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-[4px] border border-[#d0d5dd] bg-white px-3">
          <option value={10}>10 条/页</option>
          <option value={20}>20 条/页</option>
          <option value={50}>50 条/页</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#d0d5dd] disabled:opacity-50">
          <ChevronLeft size={16} />
        </button>
        {pages.map((item) => (
          <button key={item} type="button" onClick={() => onPageChange(item)} className={`h-8 min-w-8 rounded-[4px] border px-2 ${page === item ? "border-[#1677ff] bg-[#1677ff] text-white" : "border-[#d0d5dd] bg-white text-[#475467]"}`}>
            {item}
          </button>
        ))}
        <button type="button" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#d0d5dd] disabled:opacity-50">
          <ChevronRight size={16} />
        </button>
        <span className="ml-4">前往</span>
        <input value={page} onChange={(event) => onPageChange(clampPage(Number(event.target.value), pageCount))} className="h-8 w-14 rounded-[4px] border border-[#d0d5dd] px-2 text-center" />
        <span>页</span>
      </div>
    </div>
  );
}

function ReviewDetailPanel({
  qaCase,
  answers,
  note,
  processing,
  onNoteChange,
  onApprove,
  onReject,
  onFeatured,
}: {
  qaCase: QaCaseHelp | null;
  answers: QaCaseAnswer[];
  note: string;
  processing: boolean;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onFeatured: () => void;
}) {
  return (
    <section className="min-w-0 rounded-[8px] border border-[#e5e7eb] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-[#edf0f5] px-5 py-3">
        <h2 className="text-[17px] font-semibold text-[#101828]">审核详情</h2>
        <div className="flex min-w-0 items-center gap-2 rounded-[4px] bg-[#fff7e6] px-3 py-1.5 text-xs font-medium text-[#ad6800]">
          <AlertTriangle size={14} />
          <span className="truncate">审核重点：是否可复现、答案是否准确、是否适合沉淀为案例</span>
        </div>
        <button type="button" className="text-[#344054]" aria-label="关闭审核详情"><X size={18} /></button>
      </div>
      <div className="max-h-[430px] overflow-y-auto px-5 py-4">
        {qaCase ? (
          <ReviewContent
            qaCase={qaCase}
            answers={answers}
            note={note}
            onNoteChange={onNoteChange}
            compact={false}
          />
        ) : (
          <div className="rounded-[8px] border border-dashed border-[#d0d5dd] px-6 py-16 text-center text-sm text-[#667085]">暂无可审核记录</div>
        )}
      </div>
      <div className="border-t border-[#edf0f5] px-5 pb-4">
        <WorkflowStepper />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button type="button" onClick={onApprove} disabled={!qaCase || processing} className={primaryButtonClassName()}>
            {processing ? "处理中..." : "通过"}
          </button>
          <button type="button" onClick={onReject} disabled={!qaCase || processing} className={`${secondaryButtonClassName()} !border-[#ff4d4f] !text-[#ff4d4f] hover:!border-[#ff7875] hover:!text-[#ff4d4f]`}>驳回</button>
          <button type="button" onClick={onFeatured} disabled={!qaCase || processing} className={secondaryButtonClassName()}>转为精选案例</button>
        </div>
      </div>
    </section>
  );
}

function ReviewDrawer({
  open,
  qaCase,
  answers,
  note,
  assigneeUserId,
  processing,
  onNoteChange,
  onAssigneeUserIdChange,
  onClose,
  onApprove,
  onReject,
  onAssign,
  onFeatured,
}: {
  open: boolean;
  qaCase: QaCaseHelp | null;
  answers: QaCaseAnswer[];
  note: string;
  assigneeUserId: string;
  processing: boolean;
  onNoteChange: (value: string) => void;
  onAssigneeUserIdChange: (value: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onAssign: () => void;
  onFeatured: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/20" aria-label="关闭审核面板" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-[min(720px,100vw)] flex-col bg-white shadow-[-16px_0_36px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-[#edf0f5] px-7 py-5">
          <h2 className="text-[20px] font-semibold text-[#101828]">审核详情</h2>
          <button type="button" onClick={onClose} className="text-[#344054]" aria-label="关闭"><X size={22} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          {qaCase ? (
            <>
              <h3 className="mb-3 text-[15px] font-semibold text-[#101828]">基本信息</h3>
              <ReviewContent qaCase={qaCase} answers={answers} note={note} onNoteChange={onNoteChange} compact />
              <div className="mt-5">
                <label className="block text-[15px] font-semibold text-[#101828]">分配答疑者</label>
                <input
                  value={assigneeUserId}
                  onChange={(event) => onAssigneeUserIdChange(event.target.value)}
                  inputMode="numeric"
                  placeholder={qaCase.assignedUserId ? String(qaCase.assignedUserId) : "请输入答疑者用户 ID"}
                  className={`${inputClassName()} mt-2 w-full max-w-[420px]`}
                />
              </div>
            </>
          ) : <div className="rounded-[8px] border border-dashed border-[#d0d5dd] px-6 py-16 text-center text-sm text-[#667085]">暂无可审核记录</div>}
        </div>
        <div className="border-t border-[#edf0f5] px-7 py-5">
          <WorkflowStepper />
          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <button type="button" onClick={onReject} disabled={!qaCase || processing} className={`${secondaryButtonClassName()} !border-[#ff4d4f] !text-[#ff4d4f]`}>驳回</button>
            <button type="button" onClick={onAssign} disabled={!qaCase || processing} className={secondaryButtonClassName()}>分配答疑者</button>
            <button type="button" onClick={onApprove} disabled={!qaCase || processing} className={primaryButtonClassName()}>{processing ? "处理中..." : "通过并发布"}</button>
            <button type="button" onClick={onFeatured} disabled={!qaCase || processing} className={secondaryButtonClassName()}>转为精选案例</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ReviewContent({
  qaCase,
  answers,
  note,
  compact,
  onNoteChange,
}: {
  qaCase: QaCaseHelp;
  answers: QaCaseAnswer[];
  note: string;
  compact: boolean;
  onNoteChange: (value: string) => void;
}) {
  const answer = answers[0];
  return (
    <div className="space-y-4">
      <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-[18px] font-semibold text-[#101828]">{qaCase.title || `案例求助 #${qaCase.id}`}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px] text-[#667085]">
              <MetaItem icon={<UserRoundPlus size={14} />} label="提问用户" value={qaCase.author?.username || fallbackUserName(qaCase.userId)} />
              <MetaItem icon={<Clock3 size={14} />} label="提交时间" value={formatDateTime(qaCase.createTime)} />
              <MetaItem icon={<MessageSquareText size={14} />} label="答疑数" value={`${qaCase.answerCount ?? answers.length} 条`} />
            </div>
          </div>
          <QaStatusBadge tone={qaCase.status === "accepted" ? "success" : qaCase.status === "closed" ? "neutral" : "warning"}>
            {qaCase.status === "accepted" ? "已沉淀" : qaCase.status === "closed" ? "已关闭" : "待处理"}
          </QaStatusBadge>
        </div>
      </div>

      <DetailBlock title="用户问题正文">
        <p className="whitespace-pre-wrap text-[14px] leading-7 text-[#344054]">{qaCase.description || "暂无问题正文。"}</p>
      </DetailBlock>

      <DetailBlock title="附件列表">
        <div className="flex flex-wrap gap-3">
          {qaCase.templateFileUrl ? <AttachmentPill icon={<FileSpreadsheet size={24} />} name="练习文件.xlsx" size="Excel 模板" /> : null}
          {answer?.answerFileUrl ? <AttachmentPill icon={<FileImage size={24} />} name="答疑文件.xlsx" size="答疑附件" /> : null}
          {!qaCase.templateFileUrl && !answer?.answerFileUrl ? <div className="text-sm text-[#98a2b3]">暂无附件</div> : null}
        </div>
      </DetailBlock>

      <DetailBlock title={compact ? "已有回答" : "已有回答"}>
        <div className="rounded-[6px] border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-[14px] leading-6 text-[#344054]">
          {answer ? `答疑者 ${answer.author?.username || fallbackUserName(answer.userId)} 已提交答疑文件，状态：${answer.status || "active"}。` : "建议先拆分条件并检查日期列格式，必要时使用辅助列验证。"}
        </div>
      </DetailBlock>

      <DetailBlock title="审核备注">
        <div className="relative">
          <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} maxLength={500} className={`${textareaClassName()} min-h-[88px] pb-7`} />
          <span className="absolute bottom-2 right-3 text-xs text-[#667085]">{note.length} / 500</span>
        </div>
      </DetailBlock>
    </div>
  );
}

function BatchReviewModal({
  open,
  rows,
  selectedCount,
  processing,
  isSelected,
  onToggleRow,
  onClear,
  onClose,
  onMarkHandled,
  onAssign,
  onReview,
}: {
  open: boolean;
  rows: AdminQaRow[];
  selectedCount: number;
  processing: boolean;
  isSelected: (row: AdminQaRow) => boolean;
  onToggleRow: (row: AdminQaRow) => void;
  onClear: () => void;
  onClose: () => void;
  onMarkHandled: () => void;
  onAssign: () => void;
  onReview: (action: "approve" | "reject") => void;
}) {
  const preview = rows[0] || null;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="flex max-h-[88vh] w-[min(1080px,100%)] flex-col overflow-hidden rounded-[8px] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf0f5] px-6 py-4">
          <h2 className="text-[20px] font-semibold text-[#101828]">批量处理待审核</h2>
          <button type="button" onClick={onClose} className="text-[#344054]" aria-label="关闭批量处理"><X size={22} /></button>
        </div>
        <div className="min-h-0 grid flex-1 gap-4 overflow-y-auto p-6 lg:grid-cols-[1fr_0.95fr]">
          <section className="min-w-0 rounded-[8px] border border-[#e5e7eb]">
            <div className="flex items-center justify-between border-b border-[#edf0f5] px-4 py-3">
              <div className="font-semibold text-[#101828]">待审核列表 <span className="ml-3 text-sm font-normal text-[#667085]">已选择 {selectedCount} 项</span></div>
              <button type="button" onClick={onClear} className="text-sm font-semibold text-[#1677ff]">清空</button>
            </div>
            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#f8fafc] text-xs font-medium text-[#475467]">
                  <tr>
                    <th className="w-10 px-3 py-2"> </th>
                    <th className="px-3 py-2">标题</th>
                    <th className="px-3 py-2">提交用户</th>
                    <th className="px-3 py-2">类型</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">提交时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {rows.map((row) => (
                    <tr key={`${row.source}-${row.id}`} className="hover:bg-[#f8fafc]">
                      <td className="px-3 py-2"><AdminBulkCheckbox checked={isSelected(row)} onChange={() => onToggleRow(row)} label={`选择${row.title}`} /></td>
                      <td className="max-w-[180px] truncate px-3 py-2 font-medium text-[#344054]">{row.title}</td>
                      <td className="px-3 py-2 text-[#475467]">{row.user}</td>
                      <td className="px-3 py-2 text-[#475467]">{row.typeLabel}</td>
                      <td className="px-3 py-2"><QaStatusBadge tone={row.statusTone}>{row.statusLabel}</QaStatusBadge></td>
                      <td className="px-3 py-2 text-[#475467]">{formatAdminQaTime(row.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 ? <div className="px-6 py-12 text-center text-sm text-[#98a2b3]">暂无已选择项目</div> : null}
            </div>
          </section>
          <section className="min-w-0 rounded-[8px] border border-[#e5e7eb] p-4">
            <h3 className="text-[15px] font-semibold text-[#101828]">当前选中项详情预览（共 {rows.length} 项）</h3>
            {preview ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-[8px] border border-[#e5e7eb] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-[18px] font-semibold text-[#101828]">{preview.title}</h4>
                      <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-[#667085]">
                        <span>提交用户：{preview.user}</span>
                        <span>类型：{preview.typeLabel}</span>
                        <span>提交时间：{formatDateTime(preview.submittedAt)}</span>
                      </div>
                    </div>
                    <QaStatusBadge tone={preview.statusTone}>{preview.statusLabel}</QaStatusBadge>
                  </div>
                </div>
                <DetailBlock title="问题描述">
                  <p className="line-clamp-4 text-[14px] leading-7 text-[#344054]">{getPreviewDescription(preview)}</p>
                </DetailBlock>
                <DetailBlock title="已有回答（预览）">
                  <div className="rounded-[6px] border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2 text-sm text-[#344054]">建议先核查数据范围与日期格式，再确认是否可发布。</div>
                </DetailBlock>
              </div>
            ) : <div className="mt-8 text-center text-sm text-[#98a2b3]">请选择左侧待审核项</div>}
          </section>
        </div>
        <div className="border-t border-[#edf0f5] px-6 py-4">
          <div className="flex flex-col gap-3 rounded-[8px] border border-[#ffe1a6] bg-[#fff7e6] px-4 py-3 text-sm text-[#ad6800] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2"><AlertTriangle size={17} />批量操作会影响前台展示，请确认处理结果后再提交。</div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onAssign} disabled={processing || rows.length === 0} className={secondaryButtonClassName()}>分配答疑者</button>
              <button type="button" onClick={onMarkHandled} disabled={processing || rows.length === 0} className={secondaryButtonClassName()}>{processing ? "处理中..." : "标记已处理"}</button>
              <button type="button" onClick={() => onReview("approve")} disabled={processing || rows.length === 0} className={`${secondaryButtonClassName()} !border-[#1677ff] !text-[#1677ff]`}>批量通过</button>
              <button type="button" onClick={() => onReview("reject")} disabled={processing || rows.length === 0} className={`${secondaryButtonClassName()} !border-[#ff4d4f] !text-[#ff4d4f]`}>批量驳回</button>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className={secondaryButtonClassName()}>取消</button>
            <button type="button" onClick={onMarkHandled} disabled={processing || rows.length === 0} className={primaryButtonClassName()}>{processing ? "处理中..." : "确认处理"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowStepper() {
  const steps = [
    { label: "接单", state: "done" },
    { label: "回答", state: "done" },
    { label: "审核", state: "active" },
    { label: "沉淀案例", state: "todo" },
  ];
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-[#344054]">
      {steps.map((step, index) => (
        <div key={step.label} className="flex flex-1 items-center gap-2">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.state === "done" ? "bg-[#12b76a] text-white" : step.state === "active" ? "bg-[#1677ff] text-white" : "bg-[#d0d5dd] text-white"}`}>
            {step.state === "done" ? <Check size={14} /> : index + 1}
          </div>
          <span className="whitespace-nowrap font-medium">{step.label}</span>
          {index < steps.length - 1 ? <span className={`h-[2px] flex-1 rounded-full ${step.state === "done" ? "bg-[#12b76a]" : step.state === "active" ? "bg-[#1677ff]" : "bg-[#d0d5dd]"}`} /> : null}
        </div>
      ))}
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[15px] font-semibold text-[#101828]">{title}</h4>
      {children}
    </div>
  );
}

function AttachmentPill({ icon, name, size }: { icon: ReactNode; name: string; size: string }) {
  return (
    <div className="flex min-w-[180px] items-center gap-3 rounded-[6px] border border-[#d0d5dd] bg-white px-3 py-2">
      <div className="text-[#1677ff]">{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[#344054]">{name}</div>
        <div className="text-xs text-[#98a2b3]">{size}</div>
      </div>
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <span className="flex items-center gap-1.5">{icon}<span>{label}</span><span>{value}</span></span>;
}

function QaStatusBadge({ tone, children }: { tone: string; children: ReactNode }) {
  const classes: Record<string, string> = {
    warning: "bg-[#fff7e6] text-[#fa8c16] border-[#ffd591]",
    success: "bg-[#ecfdf3] text-[#039855] border-[#abefc6]",
    info: "bg-[#eff6ff] text-[#1677ff] border-[#bfdbfe]",
    danger: "bg-[#fff1f3] text-[#f04438] border-[#fecdd3]",
    neutral: "bg-[#f2f4f7] text-[#667085] border-[#d0d5dd]",
  };
  return <span className={`inline-flex h-7 items-center whitespace-nowrap rounded-[4px] border px-2.5 text-xs font-semibold ${classes[tone] || classes.neutral}`}>{children}</span>;
}

function isReviewProcessing(...values: boolean[]) {
  return values.some(Boolean);
}

async function resolveAssigneeUserId(currentValue: string, fallback?: number | null) {
  const parsed = parsePositiveInteger(currentValue);
  if (parsed) return parsed;
  const value = await openAdminPrompt({
    title: "分配答疑者",
    message: "请输入要分配的答疑者用户 ID。",
    label: "答疑者用户 ID",
    placeholder: "例如 88",
    defaultValue: fallback ? String(fallback) : "",
    confirmLabel: "确认分配",
    required: true,
  });
  return parsePositiveInteger(value || "");
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveActiveTotal(tab: AdminQaTabKey, cases = 0, answers = 0, shares = 0, feedback = 0) {
  if (tab === "answers") return answers;
  if (tab === "shares") return shares;
  if (tab === "feedback") return feedback;
  return cases;
}

function buildCaseUpdatePayload(item: QaCaseHelp, status: string) {
  return {
    title: item.title || "案例求助",
    description: item.description || "暂无问题描述",
    answerSheet: item.answerSheet || "",
    answerRange: item.answerRange || "",
    status,
  };
}

function getRowCaseId(row?: AdminQaRow) {
  if (!row) return null;
  if (row.source === "case") return row.id;
  const original = row.original as { caseId?: number };
  return original.caseId || null;
}

function getPreviewDescription(row: AdminQaRow) {
  const original = row.original as { description?: string | null; detail?: string | null; thoughtText?: string | null };
  return original.description || original.detail || original.thoughtText || "暂无详细描述。";
}

function fallbackUserName(userId?: number | string | null) {
  return userId == null ? "用户" : `user_${userId}`;
}

function formatAdminQaTime(value?: string | null) {
  if (!value) return "-";
  return formatDateTime(value);
}

function clampPage(value: number, pageCount: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(pageCount, Math.max(1, Math.floor(value)));
}
