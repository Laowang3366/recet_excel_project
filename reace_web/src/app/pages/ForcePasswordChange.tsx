import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Activity, ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { buildAuthRedirectPath, resolveAuthRedirect } from "../lib/auth-redirect";
import { useSession } from "../lib/session";

export function ForcePasswordChange() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isAuthenticated, login, logout } = useSession();
  const redirectTarget = useMemo(() => resolveAuthRedirect(location.search), [location.search]);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate(buildAuthRedirectPath(`/force-password-change?redirect=${encodeURIComponent(redirectTarget)}`), { replace: true });
      return;
    }
    if (!user?.forceChangePassword) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, redirectTarget, user?.forceChangePassword]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || submitting) return;
    if (!oldPassword.trim()) {
      toast.info("请输入当前密码");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.info("两次输入的新密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      await api.put("/api/auth/password", { oldPassword, newPassword });
      await login(user.username, newPassword, true);
      toast.success("密码已修改");
      navigate(redirectTarget, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !isAuthenticated || !user?.forceChangePassword) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4fff8] px-6 py-10">
      <div className="w-full max-w-[520px] rounded-[28px] border border-[#d9f4e6] bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="mb-8 flex items-center gap-3 text-[#00a14a]">
          <Activity size={28} strokeWidth={2.5} />
          <div>
            <div className="text-xl font-black text-[#00140d]">ExcelCC</div>
            <div className="text-xs font-bold tracking-[0.16em] text-slate-400">PASSWORD REQUIRED</div>
          </div>
        </div>
        <h1 className="text-3xl font-black text-slate-900">请先修改初始密码</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">管理员已要求该账号在继续使用前修改密码。修改完成后会自动回到原页面。</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <PasswordField
            label="当前密码"
            value={oldPassword}
            visible={showPassword}
            onVisibleChange={() => setShowPassword((current) => !current)}
            onChange={setOldPassword}
            placeholder="请输入当前密码"
          />
          <PasswordField
            label="新密码"
            value={newPassword}
            visible={showPassword}
            onVisibleChange={() => setShowPassword((current) => !current)}
            onChange={setNewPassword}
            placeholder="请输入新密码"
          />
          <PasswordField
            label="确认新密码"
            value={confirmPassword}
            visible={showPassword}
            onVisibleChange={() => setShowPassword((current) => !current)}
            onChange={setConfirmPassword}
            placeholder="请再次输入新密码"
          />

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
            密码需为 8-64 位，包含大小写字母、数字和特殊字符。
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00b050] py-3.5 text-sm font-bold text-white shadow-[0_18px_35px_rgba(0,176,80,0.24)] transition hover:bg-[#008f43] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "修改中..." : "修改密码并继续"}
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
          >
            退出当前账号
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  visible,
  onVisibleChange,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  visible: boolean;
  onVisibleChange: () => void;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 ml-1 block text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative block">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type={visible ? "text" : "password"}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 outline-none transition focus:border-[#00b050] focus:bg-white focus:ring-4 focus:ring-[#00b050]/10"
        />
        <button
          type="button"
          onClick={onVisibleChange}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-slate-700"
          aria-label={visible ? "隐藏密码" : "显示密码"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
