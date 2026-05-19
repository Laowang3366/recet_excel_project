import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Eye, PencilLine, Trash2, XCircle } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { formatQaAnswerStatus, formatQaFeedbackReason, formatQaStatus, type QaCaseAnswer, type QaCaseHelp, type QaPageResponse, type QaSolutionShare } from "../lib/qa";
import { adminKeys } from "../lib/query-keys";
import {
  AdminEmptyState,
  AdminPageShell,
  AdminSection,
  AdminStatCard,
  AdminStatGrid,
  inputClassName,
  secondaryButtonClassName,
  statusBadgeClassName,
  textareaClassName,
} from "../admin/shared";
import { Field, FormDialog, adminRequest, openAdminConfirm, showAdminSuccess, useAdminRole } from "./AdminConsoleShared";

type AdminQaStats = {
  cases?: number;
  pendingCases?: number;
  answeredCases?: number;
  answers?: number;
  solutionShares?: number;
};

type QaFeedbackRecord = {
  id: number;
  caseId?: number;
  reason?: string | null;
  detail?: string | null;
  status?: string | null;
  createTime?: string | null;
  author?: { username?: string | null } | null;
};

type CaseFormState = {
  title: string;
  description: string;
  answerSheet: string;
  answerRange: string;
  status: string;
};

type ShareFormState = {
  title: string;
  thoughtText: string;
  status: string;
};

export function AdminQa() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [editingCase, setEditingCase] = useState<QaCaseHelp | null>(null);
  const [caseForm, setCaseForm] = useState<CaseFormState>({ title: "", description: "", answerSheet: "", answerRange: "", status: "open" });
  const [editingShare, setEditingShare] = useState<QaSolutionShare | null>(null);
  const [shareForm, setShareForm] = useState<ShareFormState>({ title: "", thoughtText: "", status: "published" });

  const statsQuery = useQuery({
    queryKey: adminKeys.qaStats(),
    queryFn: async () => adminRequest<AdminQaStats>(api.get("/api/admin/qa/stats", { silent: true }), navigate, role),
  });
  const casesQuery = useQuery({
    queryKey: adminKeys.qaCases({ page: 1, size: 20 }),
    queryFn: async () => adminRequest<QaPageResponse<QaCaseHelp>>(api.get("/api/admin/qa/cases?page=1&size=20", { silent: true }), navigate, role),
  });
  const answersQuery = useQuery({
    queryKey: adminKeys.qaAnswers({ page: 1, size: 20 }),
    queryFn: async () => adminRequest<QaPageResponse<QaCaseAnswer>>(api.get("/api/admin/qa/answers?page=1&size=20", { silent: true }), navigate, role),
  });
  const sharesQuery = useQuery({
    queryKey: adminKeys.qaSolutionShares({ page: 1, size: 20 }),
    queryFn: async () => adminRequest<QaPageResponse<QaSolutionShare>>(api.get("/api/admin/qa/solution-shares?page=1&size=20", { silent: true }), navigate, role),
  });
  const feedbackQuery = useQuery({
    queryKey: adminKeys.qaFeedback({ page: 1, size: 20 }),
    queryFn: async () => adminRequest<QaPageResponse<QaFeedbackRecord>>(api.get("/api/admin/qa/feedback?page=1&size=20", { silent: true }), navigate, role),
  });

  const refreshAdminQa = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.qaStats() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.qaCases({ page: 1, size: 20 }) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.qaAnswers({ page: 1, size: 20 }) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.qaSolutionShares({ page: 1, size: 20 }) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.qaFeedback({ page: 1, size: 20 }) }),
    ]);
  };

  const updateCaseMutation = useMutation({
    mutationFn: ({ item, payload }: { item: QaCaseHelp; payload: CaseFormState }) => adminRequest(api.put(`/api/admin/qa/cases/${item.id}`, {
      title: payload.title.trim(),
      description: payload.description.trim(),
      answerSheet: payload.answerSheet.trim(),
      answerRange: payload.answerRange.trim().toUpperCase(),
      status: payload.status,
    }, { silent: true }), navigate, role, "更新求助"),
    onSuccess: async (result) => {
      if (!result) return;
      setEditingCase(null);
      await refreshAdminQa();
      showAdminSuccess("求助已更新");
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: (item: QaCaseHelp) => adminRequest(api.delete(`/api/admin/qa/cases/${item.id}`, undefined, { silent: true }), navigate, role, "删除求助"),
    onSuccess: async (result) => {
      if (!result) return;
      await refreshAdminQa();
      showAdminSuccess("求助已删除");
    },
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: (item: QaCaseAnswer) => adminRequest(api.delete(`/api/admin/qa/answers/${item.id}`, undefined, { silent: true }), navigate, role, "删除答疑"),
    onSuccess: async (result) => {
      if (!result) return;
      await refreshAdminQa();
      showAdminSuccess("答疑已删除");
    },
  });

  const updateShareMutation = useMutation({
    mutationFn: ({ item, payload }: { item: QaSolutionShare; payload: ShareFormState }) => adminRequest(api.put(`/api/admin/qa/solution-shares/${item.id}`, {
      title: payload.title.trim(),
      thoughtText: payload.thoughtText.trim(),
      thoughtSource: payload.thoughtText.trim() ? "manual" : "empty",
      status: payload.status,
    }, { silent: true }), navigate, role, "更新分享"),
    onSuccess: async (result) => {
      if (!result) return;
      setEditingShare(null);
      await refreshAdminQa();
      showAdminSuccess("解题分享已更新");
    },
  });

  const deleteShareMutation = useMutation({
    mutationFn: (item: QaSolutionShare) => adminRequest(api.delete(`/api/admin/qa/solution-shares/${item.id}`, undefined, { silent: true }), navigate, role, "下架分享"),
    onSuccess: async (result) => {
      if (!result) return;
      await refreshAdminQa();
      showAdminSuccess("解题分享已下架");
    },
  });

  const stats = statsQuery.data || {};
  const cases = casesQuery.data?.records || [];
  const answers = answersQuery.data?.records || [];
  const shares = sharesQuery.data?.records || [];
  const feedback = feedbackQuery.data?.records || [];

  const openCaseEdit = (item: QaCaseHelp) => {
    setEditingCase(item);
    setCaseForm({
      title: item.title || "",
      description: item.description || "",
      answerSheet: item.answerSheet || "",
      answerRange: item.answerRange || "",
      status: item.status || "open",
    });
  };

  const openShareEdit = (item: QaSolutionShare) => {
    setEditingShare(item);
    setShareForm({
      title: item.title || "",
      thoughtText: item.thoughtText || "",
      status: item.status || "published",
    });
  };

  const confirmDeleteCase = async (item: QaCaseHelp) => {
    const confirmed = await openAdminConfirm({
      title: "删除求助",
      message: "删除会隐藏前台列表，但不会物理删除模板文件。",
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (confirmed) deleteCaseMutation.mutate(item);
  };

  const confirmCloseCase = async (item: QaCaseHelp) => {
    const confirmed = await openAdminConfirm({
      title: "关闭求助",
      message: "关闭后前台用户将不能继续提交答疑。",
      confirmLabel: "确认关闭",
    });
    if (!confirmed) return;
    updateCaseMutation.mutate({
      item,
      payload: {
        title: item.title || "",
        description: item.description || "",
        answerSheet: item.answerSheet || "",
        answerRange: item.answerRange || "",
        status: "closed",
      },
    });
  };

  const confirmDeleteAnswer = async (item: QaCaseAnswer) => {
    const confirmed = await openAdminConfirm({
      title: "删除答疑",
      message: "删除后前台不再展示该答疑，文件仍保留用于审计。",
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (confirmed) deleteAnswerMutation.mutate(item);
  };

  const confirmDeleteShare = async (item: QaSolutionShare) => {
    const confirmed = await openAdminConfirm({
      title: "下架分享",
      message: "下架后用户无法继续查看该解题分享。",
      confirmLabel: "确认下架",
      destructive: true,
    });
    if (confirmed) deleteShareMutation.mutate(item);
  };

  return (
    <AdminPageShell>
      <AdminStatGrid>
        <AdminStatCard label="求助数" value={stats.cases ?? 0} />
        <AdminStatCard label="待答疑/待采纳" value={stats.pendingCases ?? 0} />
        <AdminStatCard label="已答疑" value={stats.answeredCases ?? 0} />
        <AdminStatCard label="答疑提交/分享" value={`${stats.answers ?? 0} / ${stats.solutionShares ?? 0}`} />
      </AdminStatGrid>

      <AdminSection title="案例求助监控">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#f0f0f0] text-sm">
            <thead className="bg-[#fafafa] text-left text-xs font-bold text-[#8c8c8c]">
              <tr>
                <th className="px-3 py-2">标题</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">答疑</th>
                <th className="px-3 py-2">创建时间</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {cases.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-medium text-[#262626]">{item.title}</td>
                  <td className="px-3 py-3"><span className={statusBadgeClassName(item.status)}>{formatQaStatus(item.status)}</span></td>
                  <td className="px-3 py-3 text-[#595959]">{item.answerCount || 0}</td>
                  <td className="px-3 py-3 text-[#8c8c8c]">{formatDateTime(item.createTime)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/qa/cases/${item.id}`} className={secondaryButtonClassName()}><Eye size={14} />查看</Link>
                      <button type="button" onClick={() => openCaseEdit(item)} className={secondaryButtonClassName()}><PencilLine size={14} />编辑</button>
                      <button type="button" onClick={() => void confirmCloseCase(item)} className={secondaryButtonClassName()}>
                        <XCircle size={14} />关闭
                      </button>
                      <button type="button" onClick={() => void confirmDeleteCase(item)} className={`${secondaryButtonClassName()} !text-rose-600`}><Trash2 size={14} />删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cases.length ? <AdminEmptyState message="暂无求助记录" /> : null}
        </div>
      </AdminSection>

      <AdminSection title="答疑提交">
        <AdminTableEmptyGuard empty={!answers.length} message="暂无答疑提交">
          {answers.map((item) => (
            <AdminCompactRow key={item.id} title={`答疑 #${item.id}`} meta={`求助 #${item.caseId || "-"} · ${formatQaAnswerStatus(item.status)} · ${formatDateTime(item.createTime)}`}>
              <button type="button" onClick={() => void confirmDeleteAnswer(item)} className={`${secondaryButtonClassName()} !text-rose-600`}><Trash2 size={14} />删除</button>
            </AdminCompactRow>
          ))}
        </AdminTableEmptyGuard>
      </AdminSection>

      <AdminSection title="解题分享">
        <AdminTableEmptyGuard empty={!shares.length} message="暂无解题分享">
          {shares.map((item) => (
            <AdminCompactRow key={item.id} title={item.title || `分享 #${item.id}`} meta={`${item.status || "published"} · 浏览 ${item.viewCount || 0} · ${formatDateTime(item.createTime)}`}>
              <button type="button" onClick={() => openShareEdit(item)} className={secondaryButtonClassName()}><PencilLine size={14} />编辑</button>
              <button type="button" onClick={() => void confirmDeleteShare(item)} className={`${secondaryButtonClassName()} !text-rose-600`}><Trash2 size={14} />下架</button>
            </AdminCompactRow>
          ))}
        </AdminTableEmptyGuard>
      </AdminSection>

      <AdminSection title="答疑者反馈">
        <AdminTableEmptyGuard empty={!feedback.length} message="暂无反馈">
          {feedback.map((item) => (
            <AdminCompactRow
              key={item.id}
              title={`${formatQaFeedbackReason(item.reason)}${item.detail ? `：${item.detail}` : ""}`}
              meta={`求助 #${item.caseId || "-"} · ${item.author?.username || "用户"} · ${formatDateTime(item.createTime)}`}
            />
          ))}
        </AdminTableEmptyGuard>
      </AdminSection>

      <FormDialog
        open={Boolean(editingCase)}
        onOpenChange={(open) => !open && setEditingCase(null)}
        title="编辑案例求助"
        submitLabel="保存"
        onSubmit={() => {
          if (!editingCase) return;
          updateCaseMutation.mutate({ item: editingCase, payload: caseForm });
        }}
      >
        <Field label="标题"><input value={caseForm.title} onChange={(event) => setCaseForm({ ...caseForm, title: event.target.value })} className={inputClassName()} /></Field>
        <Field label="描述"><textarea value={caseForm.description} onChange={(event) => setCaseForm({ ...caseForm, description: event.target.value })} className={textareaClassName()} /></Field>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="工作表"><input value={caseForm.answerSheet} onChange={(event) => setCaseForm({ ...caseForm, answerSheet: event.target.value })} className={inputClassName()} /></Field>
          <Field label="答案区域"><input value={caseForm.answerRange} onChange={(event) => setCaseForm({ ...caseForm, answerRange: event.target.value.toUpperCase() })} className={inputClassName()} /></Field>
          <Field label="状态">
            <select value={caseForm.status} onChange={(event) => setCaseForm({ ...caseForm, status: event.target.value })} className={inputClassName()}>
              <option value="open">待答疑</option>
              <option value="answered">待采纳</option>
              <option value="accepted">已答疑</option>
              <option value="closed">已关闭</option>
            </select>
          </Field>
        </div>
      </FormDialog>

      <FormDialog
        open={Boolean(editingShare)}
        onOpenChange={(open) => !open && setEditingShare(null)}
        title="编辑解题分享"
        submitLabel="保存"
        onSubmit={() => {
          if (!editingShare) return;
          updateShareMutation.mutate({ item: editingShare, payload: shareForm });
        }}
      >
        <Field label="标题"><input value={shareForm.title} onChange={(event) => setShareForm({ ...shareForm, title: event.target.value })} className={inputClassName()} /></Field>
        <Field label="思路"><textarea value={shareForm.thoughtText} onChange={(event) => setShareForm({ ...shareForm, thoughtText: event.target.value })} className={textareaClassName()} /></Field>
        <Field label="状态">
          <select value={shareForm.status} onChange={(event) => setShareForm({ ...shareForm, status: event.target.value })} className={inputClassName()}>
            <option value="published">已发布</option>
            <option value="unpublished">未发布</option>
          </select>
        </Field>
      </FormDialog>
    </AdminPageShell>
  );
}

function AdminCompactRow({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#f0f0f0] px-3 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="font-medium text-[#262626]">{title}</div>
        {meta ? <div className="mt-1 text-xs text-[#8c8c8c]">{meta}</div> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

function AdminTableEmptyGuard({ empty, message, children }: { empty: boolean; message: string; children: ReactNode }) {
  if (empty) return <AdminEmptyState message={message} />;
  return <div className="overflow-hidden rounded-[2px] border border-[#f0f0f0] bg-white">{children}</div>;
}
