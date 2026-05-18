import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Edit3, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { AddButton, AdminEmptyState, AdminPageShell, AdminSection, secondaryButtonClassName, inputClassName, textareaClassName } from "../admin/shared";
import { QuestionCategoryForm, QuestionCategoryRecord, adminRequest, showAdminSuccess, runAdminDelete, openAdminConfirm, formatAdminEntityMessage, useAdminRole, FormDialog, Field, AdminFormSwitch, AdminTableSwitch, defaultQuestionCategoryForm } from "./AdminConsoleShared";

export function AdminQuestionCategories() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionCategoryRecord | null>(null);
  const [form, setForm] = useState<QuestionCategoryForm>(defaultQuestionCategoryForm());
  const questionCategoriesQuery = useQuery({
    queryKey: adminKeys.questionCategories(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest<QuestionCategoryRecord[]>(api.get("/api/admin/question-categories", { silent: true }), navigate, role);
      return result || [];
    },
  });
  const records = questionCategoriesQuery.data || [];

  const openCreate = () => {
    setEditing(null);
    setForm(defaultQuestionCategoryForm());
    setOpen(true);
  };

  const openEdit = (item: QuestionCategoryRecord) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      description: item.description || "",
      groupName: item.groupName || "",
      sortOrder: Number(item.sortOrder || 0),
      enabled: item.enabled ?? true,
    });
    setOpen(true);
  };

  const submit = async () => {
    const payload = {
      name: form.name,
      description: form.description,
      groupName: form.groupName,
      sortOrder: Number(form.sortOrder || 0),
      enabled: Boolean(form.enabled),
    };
    if (editing) {
      const result = await adminRequest<QuestionCategoryRecord>(api.put(`/api/admin/question-categories/${editing.id}`, payload), navigate, role, "更新题目分类");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("题目分类", editing.name || result?.name || form.name, "已更新"));
    } else {
      const result = await adminRequest<QuestionCategoryRecord>(api.post("/api/admin/question-categories", payload), navigate, role, "创建题目分类");
      if (!result) return;
      setOpen(false);
      showAdminSuccess(formatAdminEntityMessage("题目分类", result?.name || form.name, "已创建"));
    }
    await queryClient.invalidateQueries({ queryKey: adminKeys.questionCategories() });
  };

  const toggleEnabled = async (item: QuestionCategoryRecord, nextEnabled: boolean) => {
    const result = await adminRequest(
      api.put(`/api/admin/question-categories/${item.id}`, {
        name: item.name,
        description: item.description,
        groupName: item.groupName,
        sortOrder: Number(item.sortOrder || 0),
        enabled: nextEnabled,
      }),
      navigate,
      role,
      nextEnabled ? "启用题目分类" : "停用题目分类",
    );
    if (!result) return;
    showAdminSuccess(formatAdminEntityMessage("题目分类", item.name, nextEnabled ? "已启用" : "已停用"));
    await queryClient.invalidateQueries({ queryKey: adminKeys.questionCategories() });
  };

  const remove = async (item: QuestionCategoryRecord) => {
    const confirmed = await openAdminConfirm({
      title: "删除题目分类",
      message: `确认删除题目分类 ${item.name}？`,
      confirmLabel: "确认删除",
      destructive: true,
    });
    if (!confirmed) return;
    await runAdminDelete({
      request: api.delete(`/api/admin/question-categories/${item.id}`),
      successMessage: formatAdminEntityMessage("题目分类", item.name, "已删除"),
      staleMessage: `题目分类《${item.name}》不存在，列表已刷新`,
      errorLabel: "删除题目分类",
      onRefresh: () => queryClient.invalidateQueries({ queryKey: adminKeys.questionCategories() }).then(() => undefined),
    });
  };

  return (
    <AdminPageShell
      title="题目分类"
      description="维护练习题目分类，同时控制前台章节板块的名称、描述、排序与启用状态。"
    >
      <AdminSection title="分类列表" actions={<AddButton onClick={openCreate}>新增题目分类</AddButton>}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>分组</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>题目数</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                <TableCell>{item.groupName || "-"}</TableCell>
                <TableCell className="max-w-[320px] truncate">{item.description || "-"}</TableCell>
                <TableCell>{item.questionCount ?? 0}</TableCell>
                <TableCell>
                  <AdminTableSwitch
                    checked={Boolean(item.enabled)}
                    onCheckedChange={(next) => void toggleEnabled(item, next)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(item)} className={secondaryButtonClassName()}><Edit3 size={14} />编辑</button>
                    <button type="button" onClick={() => remove(item)} className={secondaryButtonClassName()}><Trash2 size={14} />删除</button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {records.length === 0 && <AdminEmptyState message="暂无题目分类。" />}
      </AdminSection>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "编辑题目分类" : "新增题目分类"}
        description="分类名称、描述、排序和启用状态会同步到前台章节板块。"
        submitLabel={editing ? "保存分类" : "创建分类"}
        onSubmit={submit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="名称"><input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className={inputClassName()} /></Field>
          <Field label="分组"><input value={form.groupName} onChange={(e) => setForm((prev) => ({ ...prev, groupName: e.target.value }))} className={inputClassName()} /></Field>
        </div>
        <Field label="描述"><textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className={textareaClassName()} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="排序"><input type="number" value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))} className={inputClassName()} /></Field>
          <AdminFormSwitch
            label="启用该分类"
            checked={Boolean(form.enabled)}
            onCheckedChange={(next) => setForm((prev) => ({ ...prev, enabled: next }))}
          />
        </div>
      </FormDialog>
    </AdminPageShell>
  );
}
