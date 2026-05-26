import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Activity, Mail, Lock, User, ArrowRight, CheckCircle2, Circle, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { api } from "../lib/api";
import { buildForcePasswordChangePath, resolveAuthRedirect } from "../lib/auth-redirect";
import { getRememberedAuth, storeRememberedAuth } from "../lib/session-store";
import { useSession } from "../lib/session";

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotForm, setForgotForm] = useState({
    username: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register } = useSession();
  const redirectTarget = useMemo(() => resolveAuthRedirect(location.search), [location.search]);
  const passwordChecks = getPasswordChecks(password);
  const passedPasswordChecks = passwordChecks.filter((item) => item.passed).length;
  const passwordStrength = getPasswordStrength(passedPasswordChecks, password.length > 0);
  const isRegisterPasswordValid = passwordChecks.every((item) => item.passed);

  useEffect(() => {
    const remembered = getRememberedAuth();
    if (!remembered) return;
    setEmail(remembered.username);
    setRememberPassword(true);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      if (isLogin) {
        const loggedInUser = await login(email.trim(), password, rememberPassword);
        storeRememberedAuth(rememberPassword ? { username: email.trim() } : null);
        toast.success("登录成功，正在跳转...");
        navigate(loggedInUser.forceChangePassword ? buildForcePasswordChangePath(redirectTarget) : redirectTarget, { replace: true });
      } else {
        const registeredUser = await register({
          username: username.trim(),
          email: email.trim(),
          password,
        });
        toast.success("注册成功，正在跳转...");
        navigate(registeredUser.forceChangePassword ? buildForcePasswordChangePath(redirectTarget) : redirectTarget, { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotSubmitting) return;
    if (!forgotForm.username.trim()) {
      toast.info("请输入用户名");
      return;
    }
    if (!forgotForm.email.trim()) {
      toast.info("请输入注册邮箱");
      return;
    }
    setForgotSubmitting(true);
    try {
      const result = await api.post<{ message: string }>("/api/auth/forgot-password", {
        username: forgotForm.username.trim(),
        email: forgotForm.email.trim(),
      }, { auth: false });
      toast.success(result.message || "找回申请已提交");
      setForgotOpen(false);
      setIsLogin(true);
      setEmail(forgotForm.username.trim());
      setPassword("");
      setForgotForm({
        username: "",
        email: "",
      });
    } finally {
      setForgotSubmitting(false);
    }
  };

  const formVariants: Variants = {
    hidden: { opacity: 0, x: isLogin ? 50 : -50 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, x: isLogin ? -50 : 50, transition: { duration: 0.3 } }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f4fff8] font-sans">
      <div className="flex flex-1 flex-col justify-center px-6 py-10 md:px-12 lg:px-20">
        <div className="mx-auto mb-10 flex w-full max-w-md items-center gap-2 text-[#00b050]">
          <Activity size={28} strokeWidth={2.5} />
          <span className="text-xl font-bold tracking-tight text-[#00140d]">Excel练习网</span>
        </div>

        <div className="w-full max-w-md mx-auto">
          
          {/* Header */}
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">
              {isLogin ? "欢迎回来" : "创建账号"}
            </h2>
            <p className="text-slate-500">
              {isLogin ? "登录您的账号以继续访问练习网" : "填写信息，开启您的 Excel 进阶之旅"}
            </p>
          </div>

          {/* Form Area */}
          <div className="bg-white p-8 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
            
            {/* Tab Switcher */}
            <div className="flex p-1 bg-gray-50 rounded-2xl mb-8 relative">
              <div 
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out"
                style={{ left: isLogin ? '4px' : 'calc(50% + 4px)' }}
              />
              <button 
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors relative z-10 ${isLogin ? 'text-[#007a39]' : 'text-slate-500'}`}
              >
                登录
              </button>
              <button 
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors relative z-10 ${!isLogin ? 'text-[#007a39]' : 'text-slate-500'}`}
              >
                注册
              </button>
            </div>

            <div className="relative overflow-hidden min-h-[300px]">
              <AnimatePresence mode="wait">
                <motion.form 
                  key={isLogin ? "login" : "register"}
                  variants={formVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onSubmit={handleAuth}
                  className="space-y-4 w-full"
                >
                  
                  {!isLogin && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">昵称</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                          <User size={18} />
                        </div>
                        <input 
                          type="text" 
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="例如：Excel之神"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b050] focus:ring-4 focus:ring-[#00b050]/10 transition-all outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">
                      {isLogin ? "用户名或邮箱" : "邮箱地址"}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        {isLogin ? <User size={18} /> : <Mail size={18} />}
                      </div>
                      <input 
                        type={isLogin ? "text" : "email"} 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={isLogin ? "请输入用户名或邮箱" : "you@example.com"}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b050] focus:ring-4 focus:ring-[#00b050]/10 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 ml-1 mr-1">
                      <label className="block text-sm font-medium text-slate-700">密码</label>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <Lock size={18} />
                      </div>
                      <input 
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        placeholder="请输入密码"
                        className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b050] focus:ring-4 focus:ring-[#00b050]/10 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-slate-700"
                        aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {isLogin && (
                      <div className="mt-3 flex items-center justify-between px-1">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rememberPassword}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setRememberPassword(checked);
                              if (!checked) {
                                storeRememberedAuth(null);
                              }
                            }}
                            className="h-4 w-4 rounded border border-slate-300 text-[#00b050] focus:ring-2 focus:ring-[#00b050]/20"
                          />
                          记住账号
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotForm((prev) => ({ ...prev, username: email.trim() }));
                            setForgotOpen(true);
                          }}
                          className="text-sm font-medium text-[#00a14a] hover:text-[#007a39]"
                        >
                          忘记密码？
                        </button>
                      </div>
                    )}
                    {!isLogin && (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-[#f4fff8]/90 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-1 gap-2">
                            {passwordStrength.bars.map((active, index) => (
                              <div
                                key={index}
                                className={`h-1.5 flex-1 rounded-full ${active ? passwordStrength.color : "bg-slate-200"}`}
                              />
                            ))}
                          </div>
                          <span className={`text-xs font-bold ${passwordStrength.textClassName}`}>{passwordStrength.label}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {passwordChecks.map((item) => (
                            <div key={item.label} className={`flex items-center gap-2 text-xs ${item.passed ? "text-emerald-600" : "text-slate-500"}`}>
                              {item.passed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit"
                    disabled={submitting || (!isLogin && !isRegisterPasswordValid)}
                    className="w-full bg-[#00b050] hover:bg-[#008f43] text-white font-bold py-3.5 rounded-2xl transition-all shadow-[0_18px_35px_rgba(0,176,80,0.24)] flex items-center justify-center gap-2 mt-2"
                  >
                    {submitting ? "提交中..." : isLogin ? "立即登录" : "创建账号"}
                    <ArrowRight size={18} />
                  </button>
                  
                </motion.form>
              </AnimatePresence>
            </div>
          </div>
          
          <p className="text-center text-sm text-slate-500 mt-8">
            继续操作即表示您同意我们的 <a href="#" className="text-[#00a14a] hover:underline">服务条款</a> 和 <a href="#" className="text-[#00a14a] hover:underline">隐私政策</a>
          </p>

        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:!max-w-md">
            <DialogHeader>
              <DialogTitle>找回密码</DialogTitle>
              <DialogDescription>提交账号与注册邮箱后，系统会按安全流程处理重置申请。</DialogDescription>
            </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="mb-1.5 ml-1 block text-sm font-medium text-slate-700">用户名</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={forgotForm.username}
                  onChange={(e) => setForgotForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 outline-none transition-all focus:border-[#00b050] focus:bg-white focus:ring-4 focus:ring-[#00b050]/10"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 ml-1 block text-sm font-medium text-slate-700">注册邮箱</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={forgotForm.email}
                  onChange={(e) => setForgotForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 outline-none transition-all focus:border-[#00b050] focus:bg-white focus:ring-4 focus:ring-[#00b050]/10"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-[#f4fff8]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={forgotSubmitting}
                className="rounded-xl bg-[#00b050] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#008f43] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {forgotSubmitting ? "提交中..." : "提交申请"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getPasswordChecks(password: string) {
  return [
    { label: "至少 8 位字符", passed: password.length >= 8 },
    { label: "包含大写字母", passed: /[A-Z]/.test(password) },
    { label: "包含小写字母", passed: /[a-z]/.test(password) },
    { label: "包含数字", passed: /\d/.test(password) },
    { label: "包含特殊字符", passed: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password) },
    { label: "不含空格且不超过 64 位", passed: password.length > 0 && password.length <= 64 && !/\s/.test(password) },
  ];
}

function getPasswordStrength(passedChecks: number, hasInput: boolean) {
  if (!hasInput) {
    return {
      label: "请输入密码",
      color: "bg-slate-300",
      textClassName: "text-slate-400",
      bars: [false, false, false],
    };
  }
  if (passedChecks <= 2) {
    return {
      label: "强度较弱",
      color: "bg-rose-400",
      textClassName: "text-rose-500",
      bars: [true, false, false],
    };
  }
  if (passedChecks <= 4) {
    return {
      label: "强度中等",
      color: "bg-amber-400",
      textClassName: "text-amber-500",
      bars: [true, true, false],
    };
  }
  return {
    label: "强度较高",
    color: "bg-emerald-500",
    textClassName: "text-emerald-600",
    bars: [true, true, true],
  };
}
