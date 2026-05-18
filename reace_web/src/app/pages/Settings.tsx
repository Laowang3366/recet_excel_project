import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Shield, Key, Monitor, Moon, Sun, Save, Camera, Globe, Briefcase, MapPin, Hash, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { openGlobalPrompt } from "../components/GlobalConfirmPromptDialog";
import { api } from "../lib/api";
import { profileKeys, settingsKeys } from "../lib/query-keys";
import { normalizeAvatarUrl, normalizeImageUrl } from "../lib/mappers";
import { applyThemePreference } from "../lib/theme";
import { useSession } from "../lib/session";

type SettingsProfile = {
  id?: number;
  username: string;
  bio: string;
  jobTitle: string;
  location: string;
  website: string;
  avatar: string;
  coverImage: string;
  expertise: string;
  themePreference: string;
  notificationEmailEnabled: boolean;
  notificationPushEnabled: boolean;
  email: string;
};

type SettingsOverviewResponse = {
  user?: Partial<SettingsProfile> | null;
};

type PrivacySettings = Record<string, boolean | string | number | null | undefined>;

const defaultProfile: SettingsProfile = {
  username: "",
  bio: "",
  jobTitle: "",
  location: "",
  website: "",
  avatar: "",
  coverImage: "",
  expertise: "",
  themePreference: "light",
  notificationEmailEnabled: true,
  notificationPushEnabled: true,
  email: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("notifications");
  const [isSaving, setIsSaving] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacySettings>({});
  const [profile, setProfile] = useState<SettingsProfile>(defaultProfile);
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const { refreshUser, user, setUser } = useSession();
  const [themeSaving, setThemeSaving] = useState(false);
  const overviewQuery = useQuery({
    queryKey: settingsKeys.overview(),
    queryFn: () => api.get<SettingsOverviewResponse>("/api/users/center/overview", { silent: true }),
  });
  const privacyQuery = useQuery({
    queryKey: settingsKeys.privacy(),
    queryFn: () => api.get<PrivacySettings>("/api/users/privacy", { silent: true }),
  });

  useEffect(() => {
    const user = overviewQuery.data?.user;
    if (!user) return;
    setProfile((prev) => ({
      ...prev,
      ...user,
      themePreference: user.themePreference || "light",
      notificationEmailEnabled: user.notificationEmailEnabled ?? true,
      notificationPushEnabled: user.notificationPushEnabled ?? true,
    }));
    setSkills((user.expertise || "").split(",").map((item: string) => item.trim()).filter(Boolean));
  }, [overviewQuery.data?.user]);

  useEffect(() => {
    if (privacyQuery.data) {
      setPrivacy(privacyQuery.data);
    }
  }, [privacyQuery.data]);

  useEffect(() => {
    applyThemePreference(profile.themePreference || "light");
  }, [profile.themePreference]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put(`/api/users/${profile.id}`, {
        username: profile.username,
        bio: profile.bio,
        jobTitle: profile.jobTitle,
        location: profile.location,
        website: profile.website,
        avatar: profile.avatar,
        coverImage: profile.coverImage,
        expertise: skills,
        notificationEmailEnabled: profile.notificationEmailEnabled,
        notificationPushEnabled: profile.notificationPushEnabled,
        themePreference: profile.themePreference,
      });
      await api.put("/api/users/privacy", privacy);
      await refreshUser();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: settingsKeys.privacy() }),
      ]);
      toast.success("您的资料与设置已成功保存");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newSkill.trim()) {
      e.preventDefault();
      if (skills.includes(newSkill.trim()) || skills.length >= 6) return;
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const inputClass = "w-full px-4 py-3 bg-slate-50/50 border border-slate-200/60 rounded-xl focus:bg-white focus:border-slate-800 focus:ring-4 focus:ring-slate-800/5 transition-all outline-none text-slate-700 font-medium text-[15px] placeholder:text-slate-400 placeholder:font-normal";
  const labelClass = "block text-[13px] font-bold text-slate-500 mb-2 tracking-wide";

  const handleThemePreferenceChange = async (nextTheme: string) => {
    if (!profile.id || profile.themePreference === nextTheme || themeSaving) return;
    const previousTheme = profile.themePreference || "light";

    setProfile((prev) => ({ ...prev, themePreference: nextTheme }));
    if (user) {
      setUser({ ...user, themePreference: nextTheme });
    }
    applyThemePreference(nextTheme);
    setThemeSaving(true);

    try {
      await api.put(`/api/users/${profile.id}`, { themePreference: nextTheme });
      await refreshUser();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
      ]);
      toast.success("主题已更新");
    } catch (error: unknown) {
      setProfile((prev) => ({ ...prev, themePreference: previousTheme }));
      if (user) {
        setUser({ ...user, themePreference: previousTheme });
      }
      applyThemePreference(previousTheme);
      toast.error(getErrorMessage(error, "主题保存失败"));
    } finally {
      setThemeSaving(false);
    }
  };

  const TABS = [
    { id: "notifications", label: "通知偏好", icon: Bell },
    { id: "appearance", label: "外观主题", icon: Monitor },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-32 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md py-4 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">设置</h1>
          <p className="text-[14px] font-medium text-slate-500 mt-1">管理您的通知偏好与系统外观主题</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="flex items-center justify-center gap-2 px-7 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all shadow-md shadow-slate-800/10 active:scale-[0.98] disabled:opacity-70">
          {isSaving ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Save size={18} strokeWidth={2} /></motion.div> : <Save size={18} strokeWidth={2} />}
          保存更改
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-28">
          <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 scrollbar-none">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap lg:whitespace-normal font-bold text-[15px] relative group ${isActive ? "text-slate-900" : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"}`}>
                  {isActive && <motion.div layoutId="active-setting-tab" className="absolute inset-0 bg-white shadow-sm border border-slate-200/60 rounded-xl -z-10" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                  <tab.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-slate-800" : "text-slate-400 group-hover:text-slate-600"} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 w-full min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === "profile" && (
              <motion.div key="profile" initial={{ opacity: 0, y: 15, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -15, filter: "blur(2px)" }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="space-y-8">
                <section className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <div className="h-32 bg-slate-100 relative group cursor-pointer">
                    <img src={normalizeImageUrl(profile.coverImage) || "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"} alt="Banner" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                  </div>
                  <div className="px-8 pb-8 pt-4 relative">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 -mt-16 sm:-mt-20 mb-6">
                      <div className="relative group cursor-pointer inline-block rounded-full border-4 border-white shadow-md bg-white">
                        <img src={normalizeAvatarUrl(profile.avatar, profile.username)} alt="Profile" className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover group-hover:opacity-80 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="text-white" size={28} strokeWidth={1.5} />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="md:col-span-2"><label className={labelClass}>显示名称</label><input type="text" value={profile.username || ""} onChange={(e) => setProfile((prev) => ({ ...prev, username: e.target.value }))} className={inputClass} /></div>
                      <div className="md:col-span-2"><label className={labelClass}>一句话简介</label><textarea rows={3} value={profile.bio || ""} onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))} className={`${inputClass} resize-none leading-relaxed`} /></div>
                      <div><label className={labelClass}>头衔 / 职位</label><div className="relative"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Briefcase size={18} className="text-slate-400" strokeWidth={1.5} /></div><input type="text" value={profile.jobTitle || ""} onChange={(e) => setProfile((prev) => ({ ...prev, jobTitle: e.target.value }))} className={`${inputClass} pl-11`} /></div></div>
                      <div><label className={labelClass}>所在地</label><div className="relative"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><MapPin size={18} className="text-slate-400" strokeWidth={1.5} /></div><input type="text" value={profile.location || ""} onChange={(e) => setProfile((prev) => ({ ...prev, location: e.target.value }))} className={`${inputClass} pl-11`} /></div></div>
                      <div className="md:col-span-2"><label className={labelClass}>个人网站 / 博客</label><div className="relative"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Globe size={18} className="text-slate-400" strokeWidth={1.5} /></div><input type="url" value={profile.website || ""} onChange={(e) => setProfile((prev) => ({ ...prev, website: e.target.value }))} className={`${inputClass} pl-11`} /></div></div>
                      <div className="md:col-span-2"><label className={labelClass}>头像地址</label><input type="text" value={profile.avatar || ""} onChange={(e) => setProfile((prev) => ({ ...prev, avatar: e.target.value }))} className={inputClass} /></div>
                      <div className="md:col-span-2"><label className={labelClass}>封面地址</label><input type="text" value={profile.coverImage || ""} onChange={(e) => setProfile((prev) => ({ ...prev, coverImage: e.target.value }))} className={inputClass} /></div>
                    </div>
                  </div>
                </section>

                <section className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden p-8">
                  <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100"><Hash className="text-slate-800" size={20} strokeWidth={2} /></div><div><h2 className="text-lg font-bold text-slate-800">技能与专长</h2><p className="text-[13px] font-medium text-slate-500 mt-0.5">添加您的技术栈，方便其他同好找到您</p></div></div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <AnimatePresence>
                      {skills.map((skill) => (
                        <motion.div key={skill} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8, width: 0, margin: 0, padding: 0 }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[13px] font-bold shadow-sm">
                          {skill}
                          <button onClick={() => setSkills((prev) => prev.filter((item) => item !== skill))} className="hover:bg-white/20 p-0.5 rounded-full transition-colors"><X size={14} strokeWidth={2.5} /></button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className="relative">
                    <input type="text" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={handleAddSkill} placeholder="输入技能名称后按回车添加..." className={inputClass} disabled={skills.length >= 6} />
                    <div className="absolute inset-y-0 right-2 flex items-center">
                      <button onClick={() => { if (newSkill.trim()) { setSkills((prev) => [...prev, newSkill.trim()]); setNewSkill(""); } }} disabled={!newSkill.trim() || skills.length >= 6} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors disabled:opacity-50">
                        <Plus size={16} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === "account" && (
              <motion.div key="account" initial={{ opacity: 0, y: 15, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -15, filter: "blur(2px)" }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="space-y-8">
                <section className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden p-8">
                  <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100"><Shield className="text-slate-800" size={20} strokeWidth={2} /></div><div><h2 className="text-lg font-bold text-slate-800">账号与安全</h2><p className="text-[13px] font-medium text-slate-500 mt-0.5">管理您的登录凭证与账号状态</p></div></div>
                  <div className="space-y-6">
                    <div><label className={labelClass}>注册邮箱</label><input type="email" value={profile.email || ""} disabled className={`${inputClass} bg-slate-100/50 text-slate-500 cursor-not-allowed font-mono text-[14px]`} /></div>
                    <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-4">
                      <button onClick={async () => {
                        const oldPassword = await openGlobalPrompt({ title: "更新密码", label: "当前密码", placeholder: "请输入当前密码", inputType: "password", required: true });
                        if (!oldPassword) return;
                        const newPassword = await openGlobalPrompt({ title: "更新密码", label: "新密码", placeholder: "请输入新密码", inputType: "password", required: true });
                        if (!newPassword) return;
                        await api.put("/api/auth/password", { oldPassword, newPassword });
                        await queryClient.invalidateQueries({ queryKey: settingsKeys.overview() });
                        toast.success("密码修改成功");
                      }} className="px-5 py-2 bg-white border border-slate-200 hover:border-slate-800 text-slate-800 font-bold rounded-xl transition-colors text-[13px] shadow-sm flex items-center gap-2">
                        <Key size={16} /> 更新密码
                      </button>
                      <button onClick={async () => {
                        const newEmail = await openGlobalPrompt({ title: "修改邮箱", label: "新邮箱地址", placeholder: "请输入新邮箱", required: true });
                        if (!newEmail) return;
                        const password = await openGlobalPrompt({ title: "修改邮箱", label: "密码确认", placeholder: "请输入密码确认", inputType: "password", required: true });
                        if (!password) return;
                        await api.put("/api/auth/email", { newEmail, password });
                        setProfile((prev) => ({ ...prev, email: newEmail }));
                        await Promise.all([
                          queryClient.invalidateQueries({ queryKey: settingsKeys.overview() }),
                          queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
                        ]);
                        toast.success("邮箱修改成功");
                      }} className="px-5 py-2 bg-white border border-slate-200 hover:border-slate-800 text-slate-800 font-bold rounded-xl transition-colors text-[13px] shadow-sm">
                        修改邮箱
                      </button>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === "notifications" && (
              <motion.div key="notifications" initial={{ opacity: 0, y: 15, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -15, filter: "blur(2px)" }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
                <section className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden p-8">
                  <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100"><Bell className="text-slate-800" size={20} strokeWidth={2} /></div><div><h2 className="text-lg font-bold text-slate-800">通知偏好</h2><p className="text-[13px] font-medium text-slate-500 mt-0.5">定制您希望接收消息的方式与类型</p></div></div>
                  <div className="space-y-8">
                    <div className="flex items-center justify-between"><div><h3 className="font-bold text-[15px] text-slate-800">系统推送通知</h3><p className="text-[13px] font-medium text-slate-500 mt-1">在浏览器中接收实时消息推送和互动提醒</p></div><button onClick={() => setProfile((prev) => ({ ...prev, notificationPushEnabled: !prev.notificationPushEnabled }))} className={`w-12 h-6 rounded-full transition-colors relative ${profile.notificationPushEnabled ? "bg-slate-800" : "bg-slate-200"}`}><motion.div layout className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm" initial={false} animate={{ x: profile.notificationPushEnabled ? 24 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} /></button></div>
                    <div className="w-full h-px bg-slate-100"></div>
                    <div className="flex items-center justify-between"><div><h3 className="font-bold text-[15px] text-slate-800">每周动态邮件</h3><p className="text-[13px] font-medium text-slate-500 mt-1">接收学习进度、练习提醒与系统公告汇总</p></div><button onClick={() => setProfile((prev) => ({ ...prev, notificationEmailEnabled: !prev.notificationEmailEnabled }))} className={`w-12 h-6 rounded-full transition-colors relative ${profile.notificationEmailEnabled ? "bg-slate-800" : "bg-slate-200"}`}><motion.div layout className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm" initial={false} animate={{ x: profile.notificationEmailEnabled ? 24 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} /></button></div>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === "appearance" && (
              <motion.div key="appearance" initial={{ opacity: 0, y: 15, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -15, filter: "blur(2px)" }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
                <section className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden p-8">
                  <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100"><Monitor className="text-slate-800" size={20} strokeWidth={2} /></div><div><h2 className="text-lg font-bold text-slate-800">外观主题</h2><p className="text-[13px] font-medium text-slate-500 mt-0.5">选择您最喜欢的主题模式</p></div></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {[{ id: "light", icon: Sun, label: "浅色模式", desc: "纯净清晰的视觉体验" }, { id: "dark", icon: Moon, label: "深色模式", desc: "专为夜间打造" }, { id: "system", icon: Monitor, label: "跟随系统", desc: "自动适配设备状态" }].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          void handleThemePreferenceChange(item.id);
                        }}
                        disabled={themeSaving}
                        className={`flex flex-col items-start text-left gap-4 p-6 rounded-2xl border-2 transition-all relative overflow-hidden group ${profile.themePreference === item.id ? "border-slate-800 bg-slate-800 text-white shadow-md" : "border-slate-100 hover:border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                      >
                        {profile.themePreference === item.id && <motion.div layoutId="active-theme-bg" className="absolute inset-0 bg-slate-800 -z-10" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                        <item.icon size={26} strokeWidth={profile.themePreference === item.id ? 2 : 1.5} className={profile.themePreference === item.id ? "text-white" : "text-slate-500 group-hover:text-slate-800"} />
                        <div><span className={`block text-[15px] font-bold ${profile.themePreference === item.id ? "text-white" : "text-slate-800"}`}>{item.label}</span><span className={`block text-[12px] font-medium mt-1 ${profile.themePreference === item.id ? "text-slate-300" : "text-slate-400"}`}>{item.desc}</span></div>
                      </button>
                    ))}
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
