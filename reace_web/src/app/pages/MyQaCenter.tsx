import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileSpreadsheet, Lightbulb, MessageSquareText, PencilLine, Trash2, UploadCloud, XCircle } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { openGlobalConfirm } from "../components/GlobalConfirmPromptDialog";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { formatQaAnswerStatus, formatQaStatus, type QaCaseAnswer, type QaCaseHelp, type QaMyResponse, type QaSolutionShare } from "../lib/qa";
import { qaKeys } from "../lib/query-keys";

type CaseFormState = {
  title: string;
  description: string;
  answerSheet: string;
  answerRange: string;
};

type ShareFormState = {
  title: string;
  thoughtText: string;
};

export function MyQaCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingCase, setEditingCase] = useState<QaCaseHelp | null>(null);
  const [caseForm, setCaseForm] = useState<CaseFormState>({ title: "", description: "", answerSheet: "", answerRange: "" });
  const [editingShare, setEditingShare] = useState<QaSolutionShare | null>(null);
  const [shareForm, setShareForm] = useState<ShareFormState>({ title: "", thoughtText: "" });

  const myQaQuery = useQuery({
    queryKey: qaKeys.my(),
    queryFn: () => api.get<QaMyResponse>("/api/qa/my?page=1&size=20", { silent: true }),
  });
  const data = myQaQuery.data;

  const refreshMyQa = async () => {
    await queryClient.invalidateQueries({ queryKey: qaKeys.all });
  };

  const updateCaseMutation = useMutation({
    mutationFn: ({ item, payload }: { item: QaCaseHelp; payload: CaseFormState }) => api.put(`/api/qa/cases/${item.id}`, {
      title: payload.title.trim(),
      description: payload.description.trim(),
      answerSheet: payload.answerSheet.trim(),
      answerRange: payload.answerRange.trim().toUpperCase(),
    }, { silent: true }),
    onSuccess: async () => {
      setEditingCase(null);
      await refreshMyQa();
      toast.success("求助已更新");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "更新求助失败"),
  });

  const closeCaseMutation = useMutation({
    mutationFn: (item: QaCaseHelp) => api.post(`/api/qa/cases/${item.id}/close`, {}, { silent: true }),
    onSuccess: async () => {
      await refreshMyQa();
      toast.success("求助已关闭");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "关闭求助失败"),
  });

  const deleteCaseMutation = useMutation({
    mutationFn: (item: QaCaseHelp) => api.delete(`/api/qa/cases/${item.id}`, undefined, { silent: true }),
    onSuccess: async () => {
      await refreshMyQa();
      toast.success("求助已删除");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "删除求助失败"),
  });

  const updateAnswerMutation = useMutation({
    mutationFn: async ({ item, file }: { item: QaCaseAnswer; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scene", "reply_attachment");
      const upload = await api.post<{ url: string }>("/api/upload", formData, { silent: true });
      return api.put(`/api/qa/cases/${item.caseId}/answers/${item.id}`, { answerFileUrl: upload.url }, { silent: true });
    },
    onSuccess: async () => {
      await refreshMyQa();
      toast.success("答疑模板已更新");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "更新答疑失败"),
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: (item: QaCaseAnswer) => api.delete(`/api/qa/cases/${item.caseId}/answers/${item.id}`, undefined, { silent: true }),
    onSuccess: async () => {
      await refreshMyQa();
      toast.success("答疑已删除");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "删除答疑失败"),
  });

  const updateShareMutation = useMutation({
    mutationFn: ({ item, payload }: { item: QaSolutionShare; payload: ShareFormState }) => api.put(`/api/qa/solution-shares/${item.id}`, {
      title: payload.title.trim(),
      thoughtText: payload.thoughtText.trim(),
      thoughtSource: payload.thoughtText.trim() ? "manual" : "empty",
      status: "published",
    }, { silent: true }),
    onSuccess: async () => {
      setEditingShare(null);
      await refreshMyQa();
      toast.success("解题分享已更新");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "更新分享失败"),
  });

  const deleteShareMutation = useMutation({
    mutationFn: (item: QaSolutionShare) => api.delete(`/api/qa/solution-shares/${item.id}`, undefined, { silent: true }),
    onSuccess: async () => {
      await refreshMyQa();
      toast.success("解题分享已取消发布");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "取消发布失败"),
  });

  const openCaseEdit = (item: QaCaseHelp) => {
    setEditingCase(item);
    setCaseForm({
      title: item.title || "",
      description: item.description || "",
      answerSheet: item.answerSheet || "",
      answerRange: item.answerRange || "",
    });
  };

  const openShareEdit = (item: QaSolutionShare) => {
    setEditingShare(item);
    setShareForm({
      title: item.title || "",
      thoughtText: item.thoughtText || "",
    });
  };

  const confirmCloseCase = async (item: QaCaseHelp) => {
    const confirmed = await openGlobalConfirm({
      title: "关闭求助",
      message: "关闭后将停止接收新的答疑。",
      confirmLabel: "关闭",
    });
    if (confirmed) closeCaseMutation.mutate(item);
  };

  const confirmDeleteCase = async (item: QaCaseHelp) => {
    const confirmed = await openGlobalConfirm({
      title: "删除求助",
      message: "删除后将从你的求助列表移除。",
      confirmLabel: "删除",
      destructive: true,
    });
    if (confirmed) deleteCaseMutation.mutate(item);
  };

  const confirmDeleteAnswer = async (item: QaCaseAnswer) => {
    const confirmed = await openGlobalConfirm({
      title: "删除答疑",
      message: "删除后将从你的答疑列表移除。",
      confirmLabel: "删除",
      destructive: true,
    });
    if (confirmed) deleteAnswerMutation.mutate(item);
  };

  const confirmDeleteShare = async (item: QaSolutionShare) => {
    const confirmed = await openGlobalConfirm({
      title: "取消发布",
      message: "取消发布后，该解题分享将不再公开展示。",
      confirmLabel: "取消发布",
      destructive: true,
    });
    if (confirmed) deleteShareMutation.mutate(item);
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/qa")}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        返回求助答疑
      </button>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <MessageSquareText size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">查看答疑</h1>
            <p className="mt-1 text-sm text-slate-500">我的求助、我的答疑和我的解题分享。</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            我发起的求助
          </h2>
          <div className="mt-4 space-y-3">
            {(data?.cases.records || []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <Link to={`/qa/cases/${item.id}`} className="block transition hover:text-emerald-700">
                  <div className="font-bold text-slate-900">{item.title}</div>
                  <div className="mt-2 flex gap-2 text-xs font-bold text-slate-400">
                    <span>{formatQaStatus(item.status)}</span>
                    <span>答疑 {item.answerCount || 0}</span>
                  </div>
                </Link>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openCaseEdit(item)} className={miniButtonClassName()}>
                    <PencilLine size={13} />
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmCloseCase(item)}
                    disabled={item.status === "accepted" || item.status === "closed"}
                    className={miniButtonClassName()}
                  >
                    <XCircle size={13} />
                    关闭
                  </button>
                  <button type="button" onClick={() => void confirmDeleteCase(item)} className={miniDangerButtonClassName()}>
                    <Trash2 size={13} />
                    删除
                  </button>
                </div>
              </div>
            ))}
            {!data?.cases.records?.length ? <EmptyState /> : null}
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <MessageSquareText size={18} className="text-sky-600" />
            我提交的答疑
          </h2>
          <div className="mt-4 space-y-3">
            {(data?.answers.records || []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <Link to={`/qa/cases/${item.caseId}#answers`} className="block transition hover:text-sky-700">
                  <div className="font-bold text-slate-900">答疑模板 #{item.id}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-400">
                    <span>{formatQaAnswerStatus(item.status)}</span>
                    <span>{formatDateTime(item.createTime)}</span>
                  </div>
                </Link>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className={miniButtonClassName("cursor-pointer")}>
                    <UploadCloud size={13} />
                    重新上传
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (file) updateAnswerMutation.mutate({ item, file });
                      }}
                    />
                  </label>
                  <Link to={`/qa/cases/${item.caseId}/answer?answerId=${item.id}`} className={miniButtonClassName()}>
                    <PencilLine size={13} />
                    在线编辑
                  </Link>
                  <button
                    type="button"
                    onClick={() => void confirmDeleteAnswer(item)}
                    disabled={item.status === "accepted"}
                    className={miniDangerButtonClassName()}
                  >
                    <Trash2 size={13} />
                    删除
                  </button>
                </div>
              </div>
            ))}
            {!data?.answers.records?.length ? <EmptyState /> : null}
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <Lightbulb size={18} className="text-amber-600" />
            我的解题分享
          </h2>
          <div className="mt-4 space-y-3">
            {(data?.shares.records || []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <Link to={`/qa/solutions/${item.id}`} className="block transition hover:text-amber-700">
                  <div className="font-bold text-slate-900">{item.title}</div>
                  <div className="mt-2 text-xs font-bold text-slate-400">浏览 {item.viewCount || 0}</div>
                </Link>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openShareEdit(item)} className={miniButtonClassName()}>
                    <PencilLine size={13} />
                    编辑思路
                  </button>
                  <button type="button" onClick={() => void confirmDeleteShare(item)} className={miniDangerButtonClassName()}>
                    <Trash2 size={13} />
                    取消发布
                  </button>
                </div>
              </div>
            ))}
            {!data?.shares.records?.length ? <EmptyState /> : null}
          </div>
        </section>
      </div>

      <CaseEditDialog
        item={editingCase}
        form={caseForm}
        setForm={setCaseForm}
        pending={updateCaseMutation.isPending}
        onClose={() => setEditingCase(null)}
        onSubmit={() => {
          if (!editingCase) return;
          updateCaseMutation.mutate({ item: editingCase, payload: caseForm });
        }}
      />

      <ShareEditDialog
        item={editingShare}
        form={shareForm}
        setForm={setShareForm}
        pending={updateShareMutation.isPending}
        onClose={() => setEditingShare(null)}
        onSubmit={() => {
          if (!editingShare) return;
          updateShareMutation.mutate({ item: editingShare, payload: shareForm });
        }}
      />
    </div>
  );
}

function miniButtonClassName(extra = "") {
  return `inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${extra}`;
}

function miniDangerButtonClassName() {
  return "inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-100 bg-white px-2.5 text-xs font-black text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50";
}

function dialogInputClassName() {
  return "h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";
}

function dialogTextareaClassName() {
  return "w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";
}

function CaseEditDialog({
  item,
  form,
  setForm,
  pending,
  onClose,
  onSubmit,
}: {
  item: QaCaseHelp | null;
  form: CaseFormState;
  setForm: (value: CaseFormState) => void;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-xl font-black text-slate-900">编辑求助</h3>
        <div className="mt-4 space-y-3">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={dialogInputClassName()} placeholder="求助标题" />
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={dialogTextareaClassName()} rows={5} placeholder="需求描述" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.answerSheet} onChange={(event) => setForm({ ...form, answerSheet: event.target.value })} className={dialogInputClassName()} placeholder="理想答案工作表" />
            <input value={form.answerRange} onChange={(event) => setForm({ ...form, answerRange: event.target.value.toUpperCase() })} className={dialogInputClassName()} placeholder="理想答案区域，例如 K10:P14" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600">取消</button>
          <button type="button" onClick={onSubmit} disabled={pending} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareEditDialog({
  item,
  form,
  setForm,
  pending,
  onClose,
  onSubmit,
}: {
  item: QaSolutionShare | null;
  form: ShareFormState;
  setForm: (value: ShareFormState) => void;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-xl font-black text-slate-900">编辑解题分享</h3>
        <div className="mt-4 space-y-3">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={dialogInputClassName()} placeholder="分享标题" />
          <textarea value={form.thoughtText} onChange={(event) => setForm({ ...form, thoughtText: event.target.value })} className={dialogTextareaClassName()} rows={7} placeholder="解题思路" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600">取消</button>
          <button type="button" onClick={onSubmit} disabled={pending} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
      暂无记录
    </div>
  );
}
