import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { CalendarCheck, ShieldAlert, Sparkles, UserCog, Users, type LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { AdminPageShell, AdminSection } from "../admin/shared";
import { AdminStatsPayload, adminRequest, useAdminRole } from "./AdminConsoleShared";

export function AdminOverview() {
  const navigate = useNavigate();
  const role = useAdminRole();
  const statsQuery = useQuery({
    queryKey: adminKeys.stats(),
    enabled: Boolean(role),
    queryFn: async () => {
      const result = await adminRequest(api.get<{ stats: AdminStatsPayload }>("/api/admin/stats", { silent: true }), navigate, role);
      return result?.stats || null;
    },
  });
  const stats = statsQuery.data;
  const overviewStats = stats?.overview || {};
  const userStats = stats?.users || {};
  const moderationStats = stats?.moderation || {};
  const practiceStats = stats?.practice || {};
  const pointsStats = stats?.pointsAndLevels || {};

  const focusMetrics = [
    { label: "在线用户", value: overviewStats.onlineUsers ?? 0, hint: `管理员 ${userStats.admins ?? 0} / 运营 ${userStats.operators ?? userStats.moderators ?? 0}`, icon: Users, tone: "teal" },
    { label: "今日新增用户", value: overviewStats.todayNewUsers ?? 0, hint: `锁定 ${userStats.locked ?? 0} · 禁言 ${userStats.muted ?? 0}`, icon: UserCog, tone: "blue" },
    { label: "今日签到", value: overviewStats.todayCheckins ?? 0, hint: `练习记录 ${practiceStats.practiceRecords ?? 0}`, icon: CalendarCheck, tone: "amber" },
    { label: "待处理事项", value: (moderationStats.pendingFeedback ?? 0) + (moderationStats.pendingPracticeSubmissions ?? 0), hint: `反馈 ${moderationStats.pendingFeedback ?? 0} · 试题投稿 ${moderationStats.pendingPracticeSubmissions ?? 0}`, icon: ShieldAlert, tone: "rose" },
  ] as const;

  return (
    <AdminPageShell title="后台总览" description="集中查看本站核心数据、业务状态和待处理事项。">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#eff6ff,transparent_38%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#f1f5f9_100%)] p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-sky-700">
              <Sparkles size={14} />
              Dashboard
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">学习平台运营总览</h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              按用户、通知、题库、练习、积分和 AI 助手配置相关入口查看核心状态，优先暴露今日变化和待处理事项。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px]">
            {focusMetrics.map((item) => (
              <OverviewMetricCard key={item.label} {...item} />
            ))}
          </div>
        </div>
      </section>

      <AdminSection title="用户与通知概览">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewDataCard label="注册用户" value={userStats.total ?? stats?.userCount ?? 0} hint={`在线 ${userStats.online ?? 0}`} />
          <OverviewDataCard label="管理账号" value={`${userStats.admins ?? 0} / ${userStats.operators ?? userStats.moderators ?? 0}`} hint="管理员 / 运营" />
          <OverviewDataCard label="账号状态" value={`${userStats.locked ?? 0} / ${userStats.muted ?? 0}`} hint="锁定 / 禁言" />
          <OverviewDataCard label="站内通知" value={stats?.notifications?.total ?? 0} hint={`未读 ${stats?.notifications?.unread ?? 0} · 公告 ${stats?.notifications?.siteNotifications ?? 0}`} />
        </div>
      </AdminSection>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminSection title="练习与题库">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OverviewDataCard label="题目总数" value={practiceStats.questions ?? 0} hint={`启用 ${practiceStats.enabledQuestions ?? 0}`} />
            <OverviewDataCard label="题目分类" value={practiceStats.questionCategories ?? 0} hint={`模板 ${practiceStats.questionTemplates ?? 0}`} />
            <OverviewDataCard label="练习记录" value={practiceStats.practiceRecords ?? 0} hint={`答案 ${practiceStats.practiceAnswers ?? 0}`} />
            <OverviewDataCard label="用户投稿" value={practiceStats.submissions ?? 0} hint={`完成 ${practiceStats.completedSubmissions ?? 0} · 驳回 ${practiceStats.rejectedSubmissions ?? 0}`} />
          </div>
        </AdminSection>

        <AdminSection title="审核与待办">
          <div className="space-y-3">
            <OverviewProgressRow label="试题投稿待审核" value={moderationStats.pendingPracticeSubmissions ?? 0} tone="sky" />
            <OverviewProgressRow label="反馈待处理" value={moderationStats.pendingFeedback ?? stats?.pendingFeedback ?? 0} tone="teal" />
            <OverviewProgressRow label="反馈已处理 / 忽略" value={`${moderationStats.handledFeedback ?? 0} / ${moderationStats.ignoredFeedback ?? 0}`} tone="slate" textValue />
          </div>
        </AdminSection>
      </div>

      <AdminSection title="积分与等级">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewDataCard label="积分规则" value={pointsStats.pointsRules ?? 0} hint={`启用 ${pointsStats.enabledPointsRules ?? 0}`} />
          <OverviewDataCard label="积分记录" value={pointsStats.pointsRecords ?? 0} hint={`规则选项 ${pointsStats.pointsOptions ?? 0}`} />
          <OverviewDataCard label="经验规则 / 等级" value={`${pointsStats.expRules ?? 0} / ${pointsStats.levelRules ?? 0}`} hint={`经验日志 ${pointsStats.expLogs ?? 0}`} />
          <OverviewDataCard label="用户权益" value={pointsStats.entitlements ?? 0} />
        </div>
      </AdminSection>
    </AdminPageShell>
  );
}

function OverviewMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone: "teal" | "blue" | "amber" | "rose";
}) {
  const toneMap = {
    teal: "from-teal-500/12 via-white to-teal-50 text-teal-700",
    blue: "from-sky-500/12 via-white to-sky-50 text-sky-700",
    amber: "from-amber-500/12 via-white to-amber-50 text-amber-700",
    rose: "from-rose-500/12 via-white to-rose-50 text-rose-700",
  }[tone];

  return (
    <div className={`rounded-3xl border border-white/70 bg-gradient-to-br px-5 py-4 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.4)] ${toneMap}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</div>
          {hint ? <div className="mt-2 text-xs font-medium text-slate-500">{hint}</div> : null}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function OverviewDataCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-4">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-900">{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function OverviewProgressRow({
  label,
  value,
  tone,
  textValue = false,
}: {
  label: string;
  value: React.ReactNode;
  tone: "amber" | "sky" | "rose" | "teal" | "slate";
  textValue?: boolean;
}) {
  const toneMap = {
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    rose: "bg-rose-500",
    teal: "bg-teal-500",
    slate: "bg-slate-500",
  }[tone];
  const numericValue = typeof value === "number" ? value : 0;
  const width = textValue ? 100 : Math.min(100, Math.max(8, numericValue * 8));
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-black text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${toneMap}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
