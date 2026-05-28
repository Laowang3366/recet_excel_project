import { type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { hasAdminConsoleAccess, type AdminRole } from "../admin/config";
import { useSession } from "../lib/session";
import { formDialogBodyClassName, formDialogContentClassName, primaryButtonClassName, secondaryButtonClassName } from "../admin/shared";
import type { AdminEditableUserRole, AdminNotificationForm, AdminUserForm, FormDialogProps, QuestionCategoryForm } from "./AdminConsoleTypes";

export function formatAdminEntityMessage(entity: string, value: unknown, suffix: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? `${entity}《${text}》${suffix}` : `${entity}${suffix}`;
}

export function useAdminRole() {
  const { user } = useSession();
  return hasAdminConsoleAccess(user?.role) ? (user?.role as AdminRole) : null;
}

export function DeleteConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认删除",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" onClick={onCancel} className={secondaryButtonClassName()}>
            取消
          </button>
          <button type="button" onClick={onConfirm} className={`${primaryButtonClassName()} !bg-rose-600 hover:!bg-rose-700`}>
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "保存",
  submitDisabled = false,
  contentClassName,
  bodyClassName,
  onSubmit,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={formDialogContentClassName(contentClassName)}>
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={formDialogBodyClassName(bodyClassName)}>
          <div className="space-y-4">{children}</div>
        </div>
        <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4 bg-white">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClassName()}>
            取消
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitDisabled}
            className={`${primaryButtonClassName()} ${submitDisabled ? "pointer-events-none opacity-50" : ""}`}
          >
            {submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-bold text-slate-700">{label}</div>
      {children}
    </label>
  );
}

export function AdminFormSwitch({
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

export function AdminTableSwitch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      <span className={`text-xs font-bold ${checked ? "text-emerald-600" : "text-slate-400"}`}>
        {checked ? "已启用" : "未启用"}
      </span>
    </div>
  );
}

export function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

export function isEditableUserRole(value: unknown): value is AdminEditableUserRole {
  return value === "admin" || value === "moderator" || value === "user";
}

export function defaultUserForm(): AdminUserForm {
  return { username: "", email: "", phone: "", avatar: "", password: "", role: "user", status: 0, isMuted: false, forceChangePassword: true, notifyUser: true };
}

export function defaultNotificationForm(): AdminNotificationForm {
  return {
    title: "",
    content: "",
    type: "system",
    status: "draft",
    targetType: "all",
    targetRoles: "",
    targetUserIds: "",
    attachments: "",
    scheduledTime: null,
    pinned: false,
  };
}

export function defaultQuestionCategoryForm(): QuestionCategoryForm {
  return { name: "", description: "", groupName: "", frontDisplayName: "", iconKey: "folder", recommendedDifficulty: "medium", sortOrder: 0, enabled: true };
}
