import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Edit3, Globe, LoaderCircle, Mail, MapPin, Shield, Sparkles, TrendingUp, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LitePageFrame, LitePanel } from "../components/LiteSurface";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { api } from "../lib/api";
import { formatNumber } from "../lib/format";
import { normalizeAvatarUrl } from "../lib/mappers";
import {
  getProfileEntryCards,
  getProfileIdentityLayoutClassName,
  shouldRenderProfileHeaderDescription,
} from "../lib/profile-display";
import { pointsKeys, practiceKeys, profileKeys } from "../lib/query-keys";
import { useSession } from "../lib/session";

function resolveProgressPercent(current: number, total: number) {
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-sm font-bold text-slate-600">{children}</div>;
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:bg-white ${props.className || ""}`.trim()}
    />
  );
}

type ProfileOverviewUser = {
  id?: number | null;
  username?: string | null;
  email?: string | null;
  bio?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  website?: string | null;
  avatar?: string | null;
  points?: number;
  exp?: number;
  level?: number;
};

type ExperienceProgress = {
  currentInLevel?: number;
  totalInLevel?: number;
  remainingExp?: number;
  level?: number;
  levelName?: string | null;
};

type ProfileOverviewResponse = {
  user?: ProfileOverviewUser | null;
  expProgress?: ExperienceProgress;
};

type CampaignOverviewResponse = {
  summary?: {
    clearedLevels?: number;
    totalStars?: number;
    currentStreak?: number;
  };
};

type CampaignChapter = {
  totalLevels?: number;
  completed?: boolean;
};

type CampaignChaptersResponse = {
  chapters?: CampaignChapter[];
};

export function ProfileCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, refreshUser, logout } = useSession();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isGrowthOpen, setIsGrowthOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    id: null as number | null,
    username: "",
    bio: "",
    jobTitle: "",
    location: "",
    website: "",
    avatar: "",
  });
  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    password: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
  });

  const profileQuery = useQuery({
    queryKey: profileKeys.overview(),
    enabled: isAuthenticated,
    queryFn: () => api.get<ProfileOverviewResponse>("/api/users/center/overview", { silent: true }),
  });
  const pointsQuery = useQuery({
    queryKey: pointsKeys.overview(),
    enabled: isAuthenticated,
    queryFn: () => api.get<ProfileOverviewResponse>("/api/points/overview", { silent: true }),
  });
  const campaignOverviewQuery = useQuery({
    queryKey: practiceKeys.campaignOverview(),
    enabled: isAuthenticated,
    queryFn: () => api.get<CampaignOverviewResponse>("/api/practice/campaign/overview", { silent: true }),
  });
  const campaignChaptersQuery = useQuery({
    queryKey: practiceKeys.campaignChapters(),
    enabled: isAuthenticated,
    queryFn: () => api.get<CampaignChaptersResponse>("/api/practice/campaign/chapters", { silent: true }),
  });

  const user = profileQuery.data?.user || pointsQuery.data?.user || {};
  const expProgress = pointsQuery.data?.expProgress || profileQuery.data?.expProgress || {};
  const campaignSummary = campaignOverviewQuery.data?.summary || {};
  const chapters = campaignChaptersQuery.data?.chapters || [];

  useEffect(() => {
    if (!user?.id) return;
    setForm({
      id: user.id,
      username: user.username || "",
      bio: user.bio || "",
      jobTitle: user.jobTitle || "",
      location: user.location || "",
      website: user.website || "",
      avatar: user.avatar || "",
    });
    setEmailForm((prev) => ({
      ...prev,
      newEmail: user.email || "",
    }));
  }, [user]);

  const invalidateOverview = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: profileKeys.overview() }),
      queryClient.invalidateQueries({ queryKey: pointsKeys.overview() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignOverview() }),
      queryClient.invalidateQueries({ queryKey: practiceKeys.campaignChapters() }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.put(`/api/users/${payload.id}`, {
        username: payload.username,
        bio: payload.bio,
        jobTitle: payload.jobTitle,
        location: payload.location,
        website: payload.website,
        avatar: payload.avatar,
      }),
    onSuccess: async () => {
      await refreshUser();
      await invalidateOverview();
      toast.success("资料已更新");
      setIsEditOpen(false);
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: () =>
      api.put("/api/auth/email", {
        newEmail: emailForm.newEmail.trim(),
        password: emailForm.password,
      }),
    onSuccess: async () => {
      await refreshUser();
      await invalidateOverview();
      toast.success("邮箱修改成功");
      setEmailForm((prev) => ({ ...prev, password: "" }));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      api.put("/api/auth/password", {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      }),
    onSuccess: async () => {
      setPasswordForm({ oldPassword: "", newPassword: "" });
      setIsAccountOpen(false);
      await logout();
      toast.success("密码已修改，请重新登录");
      navigate("/auth", { replace: true });
    },
  });

  const totalLevels = useMemo(
    () => chapters.reduce((sum, chapter) => sum + Number(chapter?.totalLevels || 0), 0),
    [chapters]
  );
  const clearedLevels = Number(campaignSummary.clearedLevels || 0);
  const completedChapters = chapters.filter((chapter) => chapter.completed).length;
  const totalChapters = chapters.length;
  const totalStars = Number(campaignSummary.totalStars || 0);
  const levelProgressPercent = resolveProgressPercent(
    Number(expProgress.currentInLevel || 0),
    Number(expProgress.totalInLevel || 0)
  );
  const campaignProgressPercent = totalLevels > 0 ? Math.round((clearedLevels / totalLevels) * 100) : 0;
  const profileEntryCards = getProfileEntryCards();

  const handleAvatarUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.post<{ url: string }>("/api/upload", formData);
      setForm((prev) => ({ ...prev, avatar: result.url }));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <LitePageFrame>
        <LitePanel className="py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-teal-50 text-teal-600">
            <Sparkles size={28} />
          </div>
          <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900">个人中心</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">登录后查看资料、等级成长和闯关进度。</p>
        </LitePanel>
      </LitePageFrame>
    );
  }

  return (
    <LitePageFrame className="max-w-[1200px]">
      <div className="space-y-5">
        <LitePanel className="overflow-hidden p-0">
          <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f6fbfb_0%,#eef8f5_100%)] px-6 py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.2em] text-teal-600/90">个人资料</div>
                <h1 className="mt-2 text-[30px] font-black tracking-tight text-slate-900">头像资料信息</h1>
                {shouldRenderProfileHeaderDescription() ? (
                  <p className="mt-2 text-sm leading-6 text-slate-500">保留个人头像、身份信息和资料编辑，账户操作独立收口。</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
                >
                  <Edit3 size={16} />
                  编辑资料
                </button>
                <button
                  type="button"
                  onClick={() => setIsAccountOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  <Shield size={16} />
                  账号管理
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className={`${getProfileIdentityLayoutClassName()} min-w-0`}>
              <img
                src={normalizeAvatarUrl(user.avatar, user.username)}
                alt={user.username || "用户头像"}
                className="h-24 w-24 shrink-0 rounded-[28px] border border-slate-200 bg-white object-cover shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:h-28 sm:w-28 sm:rounded-[30px]"
              />

              <div className="min-w-0 flex-1">
                <div className="truncate text-3xl font-black tracking-tight text-slate-900">{user.username || "未命名用户"}</div>
                <div className="mt-2 inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
                  Lv.{expProgress.level || user.level || 1} {expProgress.levelName || "新手"}
                </div>
                <div className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{user.bio || "这个用户还没有填写个人简介。"}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {profileEntryCards.map((item) => {
                const isGrowth = item.key === "growth";
                const Icon = isGrowth ? TrendingUp : Mail;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (isGrowth) {
                        setIsGrowthOpen(true);
                        return;
                      }
                      setIsDetailsOpen(true);
                    }}
                    className="group flex items-center gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4 text-left transition hover:border-teal-200 hover:bg-white"
                  >
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isGrowth ? "bg-amber-50 text-amber-600" : "bg-teal-50 text-teal-600"}`}>
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{item.eyebrow}</span>
                      <span className="mt-1 block text-base font-black text-slate-900">{item.title}</span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">{item.description}</span>
                    </span>
                    <ArrowRight size={18} className="shrink-0 text-slate-300 transition group-hover:text-teal-600" />
                  </button>
                );
              })}
            </div>
          </div>
        </LitePanel>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl rounded-[28px] border border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle className="text-2xl font-black text-slate-900">编辑资料</DialogTitle>
            <DialogDescription>维护头像、简介和基础资料信息。</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <img
                src={normalizeAvatarUrl(form.avatar, form.username)}
                alt={form.username || "用户头像"}
                className="h-24 w-24 rounded-[28px] border border-slate-200 object-cover shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white">
                  {isUploadingAvatar ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                  上传头像
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleAvatarUpload(e.target.files)} />
                </label>
                <FieldInput
                  type="text"
                  value={form.avatar}
                  onChange={(e) => setForm((prev) => ({ ...prev, avatar: e.target.value }))}
                  placeholder="或直接填写头像地址"
                  className="sm:w-[320px]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>用户名</FieldLabel>
                <FieldInput
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>职位</FieldLabel>
                <FieldInput
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>所在地</FieldLabel>
                <FieldInput
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>个人网站</FieldLabel>
                <FieldInput
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel>个人简介</FieldLabel>
                <textarea
                  rows={4}
                  value={form.bio}
                  onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-teal-400 focus:bg-white"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-5">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => form.id && saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.id}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {saveMutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Edit3 size={16} />}
              保存资料
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-h-[calc(100vh-32px)] max-w-2xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle className="text-2xl font-black text-slate-900">查看个人资料</DialogTitle>
            <DialogDescription>注册邮箱、职位、所在地和个人网站集中在这里查看。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="flex items-center gap-2 text-[12px] font-black text-slate-400">
                <Mail size={15} />
                注册邮箱
              </div>
              <div className="mt-3 break-all text-base font-black text-slate-900">{user.email || "未填写"}</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="flex items-center gap-2 text-[12px] font-black text-slate-400">
                <Edit3 size={15} />
                职位信息
              </div>
              <div className="mt-3 text-base font-black text-slate-900">{user.jobTitle || "未填写"}</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="flex items-center gap-2 text-[12px] font-black text-slate-400">
                <MapPin size={15} />
                所在地
              </div>
              <div className="mt-3 text-base font-black text-slate-900">{user.location || "未填写"}</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="flex items-center gap-2 text-[12px] font-black text-slate-400">
                <Globe size={15} />
                个人网站
              </div>
              <div className="mt-3 break-all text-base font-black text-slate-900">{user.website || "未填写"}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGrowthOpen} onOpenChange={setIsGrowthOpen}>
        <DialogContent className="max-h-[calc(100vh-32px)] max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle className="text-2xl font-black text-slate-900">成长进度</DialogTitle>
            <DialogDescription>等级、积分、经验和闯关进度集中在这里查看。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 px-6 py-6 xl:grid-cols-2">
            <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900">等级进度条</div>
                    <div className="mt-1 text-xs text-slate-500">
                      当前等级：Lv.{expProgress.level || user.level || 1} {expProgress.levelName || "新手"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-900">{levelProgressPercent}%</div>
                  <div className="text-xs text-slate-400">
                    {Number(expProgress.currentInLevel || 0)} / {Number(expProgress.totalInLevel || 0)}
                  </div>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#14b8a6_0%,#22c55e_100%)]"
                  style={{ width: `${levelProgressPercent}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-bold text-slate-400">当前积分</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{formatNumber(Number(user.points || 0))}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-bold text-slate-400">当前经验</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{formatNumber(Number(user.exp || 0))}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-bold text-slate-400">剩余经验</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{formatNumber(Number(expProgress.remainingExp || 0))}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf2_100%)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900">闯关进度</div>
                    <div className="mt-1 text-xs text-slate-500">
                      已完成章节 {completedChapters} / {totalChapters || 0}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-900">{campaignProgressPercent}%</div>
                  <div className="text-xs text-slate-400">
                    {clearedLevels} / {totalLevels || 0} 关
                  </div>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#fb7185_100%)]"
                  style={{ width: `${campaignProgressPercent}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/80 px-4 py-3">
                  <div className="text-[11px] font-bold text-slate-400">已通关卡</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{clearedLevels}</div>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-3">
                  <div className="text-[11px] font-bold text-slate-400">总星数</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{totalStars}</div>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-3">
                  <div className="text-[11px] font-bold text-slate-400">连续推进</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{Number(campaignSummary.currentStreak || 0)}</div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAccountOpen} onOpenChange={setIsAccountOpen}>
        <DialogContent className="max-w-3xl rounded-[28px] border border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle className="text-2xl font-black text-slate-900">账号管理</DialogTitle>
            <DialogDescription>支持修改邮箱和密码，密码修改后需要重新登录。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-0 lg:grid-cols-2">
            <div className="space-y-5 border-b border-slate-100 px-6 py-6 lg:border-b-0 lg:border-r">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Mail size={16} className="text-teal-600" />
                  修改邮箱
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-500">当前邮箱：{user.email || "未绑定"}</div>
              </div>

              <label className="block">
                <FieldLabel>新邮箱</FieldLabel>
                <FieldInput
                  type="email"
                  value={emailForm.newEmail}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))}
                  placeholder="请输入新的邮箱地址"
                />
              </label>

              <label className="block">
                <FieldLabel>密码确认</FieldLabel>
                <FieldInput
                  type="password"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="请输入当前密码确认身份"
                />
              </label>

              <button
                type="button"
                onClick={() => changeEmailMutation.mutate()}
                disabled={changeEmailMutation.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                {changeEmailMutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}
                保存邮箱
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Shield size={16} className="text-amber-500" />
                  修改密码
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-500">新密码至少 8 位，且只能包含字母和数字。</div>
              </div>

              <label className="block">
                <FieldLabel>当前密码</FieldLabel>
                <FieldInput
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                  placeholder="请输入当前密码"
                />
              </label>

              <label className="block">
                <FieldLabel>新密码</FieldLabel>
                <FieldInput
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="请输入新密码"
                />
              </label>

              <button
                type="button"
                onClick={() => changePasswordMutation.mutate()}
                disabled={changePasswordMutation.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                {changePasswordMutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Shield size={16} />}
                更新密码
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </LitePageFrame>
  );
}
