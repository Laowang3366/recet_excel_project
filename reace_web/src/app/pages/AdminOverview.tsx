import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  Coins,
  FilePlus2,
  HeartPulse,
  Megaphone,
  MessageCircle,
  Plus,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { adminKeys } from "../lib/query-keys";
import { AdminPageShell, secondaryButtonClassName } from "../admin/shared";
import { AdminStatsPayload, adminRequest, useAdminRole } from "./AdminConsoleShared";

type Tone = "blue" | "green" | "orange" | "red";

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

  const priorityItems = useMemo(
    () => [
      {
        label: "待审核",
        value: moderationStats.pendingPracticeSubmissions ?? 0,
        hint: "待处理",
        icon: ClipboardList,
        tone: "orange" as const,
      },
      {
        label: "异常",
        value: moderationStats.abnormalQuestions ?? 0,
        hint: "需关注",
        icon: ShieldAlert,
        tone: "red" as const,
      },
      {
        label: "用户反馈",
        value: moderationStats.pendingFeedback ?? stats?.pendingFeedback ?? 0,
        hint: "待回复",
        icon: MessageCircle,
        tone: "blue" as const,
      },
      {
        label: "AI 健康",
        value: "正常",
        hint: "运行良好",
        icon: HeartPulse,
        tone: "green" as const,
      },
    ],
    [moderationStats, stats?.pendingFeedback]
  );

  const summaryCards = [
    {
      label: "注册用户",
      value: userStats.total ?? stats?.userCount ?? 0,
      hint: `今日 +${overviewStats.todayNewUsers ?? 0}`,
      icon: Users,
      tone: "blue" as const,
    },
    {
      label: "今日练习",
      value: overviewStats.todayPractice ?? overviewStats.todayCheckins ?? 0,
      hint: `完成率 ${practiceStats.completionRate ?? 0}%`,
      icon: BookOpenCheck,
      tone: "green" as const,
    },
    {
      label: "题库启用",
      value: practiceStats.enabledQuestions ?? practiceStats.questions ?? 0,
      hint: `停用 ${practiceStats.disabledQuestions ?? 0}`,
      icon: FilePlus2,
      tone: "orange" as const,
    },
    {
      label: "待处理",
      value: (moderationStats.pendingFeedback ?? 0) + (moderationStats.pendingPracticeSubmissions ?? 0),
      hint: `反馈 ${moderationStats.pendingFeedback ?? 0} / 投稿 ${moderationStats.pendingPracticeSubmissions ?? 0}`,
      icon: ClipboardList,
      tone: "red" as const,
    },
  ];

  const quickActions = [
    { label: "新建题目", icon: Plus, path: "/admin/questions" },
    { label: "发布通知", icon: Megaphone, path: "/admin/notifications" },
    { label: "手动发积分", icon: Coins, path: "/admin/points" },
    { label: "查看待审核", icon: ClipboardList, path: "/admin/qa" },
  ];

  const queueItems = [
    {
      title: "试题投稿待审核",
      meta: `${moderationStats.pendingPracticeSubmissions ?? 0} 条，最久 18 小时`,
      status: "待处理",
      tone: "orange" as const,
      icon: ClipboardList,
    },
    {
      title: "用户反馈待回复",
      meta: `${moderationStats.pendingFeedback ?? 0} 条，含 1 条性能问题`,
      status: "需回复",
      tone: "red" as const,
      icon: MessageCircle,
    },
    {
      title: "AI 配置健康",
      meta: "主模型正常",
      status: "运行良好",
      tone: "green" as const,
      icon: HeartPulse,
    },
  ];

  return (
    <AdminPageShell
      title="运营总览"
      description="集中查看平台运营、题库状态、待办事项与整体健康情况。"
      actions={
        <>
          <button type="button" className={secondaryButtonClassName()}>
            <ClipboardList size={16} />
            导出日报
          </button>
          <button type="button" onClick={() => navigate("/admin/qa")} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[4px] bg-[#1677ff] px-4 text-sm font-semibold text-white shadow-[0_2px_6px_rgba(22,119,255,0.22)] transition hover:bg-[#0958d9]">
            <ShieldAlert size={16} />
            处理待办
          </button>
        </>
      }
    >
      <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div>
            <h2 className="text-[22px] font-semibold text-[#101828]">今天优先处理 {formatCount((moderationStats.pendingFeedback ?? 0) + (moderationStats.pendingPracticeSubmissions ?? 0))} 个事项</h2>
            <p className="mt-2 text-[15px] leading-6 text-[#667085]">待审核、异常、用户反馈和 AI 健康集中展示，管理员一进来就知道该做什么。</p>
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {priorityItems.map((item) => (
                <PriorityItem key={item.label} {...item} />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="flex h-[112px] flex-col items-center justify-center gap-3 rounded-[8px] border border-[#d0d5dd] bg-[#fbfcfe] text-[#101828] transition hover:border-[#1677ff] hover:text-[#1677ff] hover:shadow-[0_8px_24px_rgba(22,119,255,0.12)]"
                >
                  <Icon size={30} className="text-[#1677ff]" />
                  <span className="text-[16px] font-semibold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <OverviewStatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.86fr)]">
        <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[#101828]">访问与练习趋势</h2>
              <div className="mt-2 flex items-center gap-6 text-sm text-[#667085]">
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#1677ff]" />访问量</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#12b76a]" />练习量</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={secondaryButtonClassName()}>近7天</button>
              <button type="button" className={secondaryButtonClassName()}>2026-05-19 ~ 2026-05-25</button>
            </div>
          </div>
          <TrendChart />
        </section>

        <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <h2 className="text-[18px] font-semibold text-[#101828]">待办队列</h2>
          <div className="mt-4 space-y-3">
            {queueItems.map((item) => (
              <QueueItem key={item.title} {...item} />
            ))}
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function PriorityItem({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  const classes = toneClasses(tone);
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${classes.bg} ${classes.text}`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-sm text-[#475467]">{label}</div>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-[28px] font-semibold leading-none text-[#101828]">{value}</span>
          <span className={`rounded-[4px] px-2 py-1 text-xs font-semibold ${classes.badge}`}>{hint}</span>
        </div>
      </div>
    </div>
  );
}

function OverviewStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  const classes = toneClasses(tone);
  return (
    <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${classes.bg} ${classes.text}`}>
          <Icon size={28} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-[#475467]">{label}</div>
          <div className="mt-2 text-[30px] font-semibold leading-none text-[#101828]">{formatCount(value)}</div>
          <div className="mt-2 text-sm text-[#667085]">{hint}</div>
        </div>
      </div>
    </section>
  );
}

function QueueItem({
  title,
  meta,
  status,
  tone,
  icon: Icon,
}: {
  title: string;
  meta: string;
  status: string;
  tone: Tone;
  icon: LucideIcon;
}) {
  const classes = toneClasses(tone);
  return (
    <button type="button" className="flex w-full items-center gap-4 rounded-[8px] border border-[#e5e7eb] bg-white px-4 py-3 text-left transition hover:border-[#1677ff] hover:bg-[#fbfcfe]">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${classes.bg} ${classes.text}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-[#101828]">{title}</div>
        <div className="mt-1 text-sm text-[#667085]">{meta}</div>
      </div>
      <span className={`shrink-0 rounded-[4px] px-2.5 py-1 text-xs font-semibold ${classes.badge}`}>{status}</span>
      <ChevronRight size={18} className="shrink-0 text-[#98a2b3]" />
    </button>
  );
}

function TrendChart() {
  const accessPath = "M 12 160 L 115 125 L 218 118 L 321 92 L 424 74 L 527 84 L 630 110";
  const practicePath = "M 12 190 L 115 172 L 218 158 L 321 136 L 424 118 L 527 128 L 630 154";
  return (
    <div className="h-[260px] overflow-hidden rounded-[8px] border border-[#edf0f5] bg-[#fbfcfe] px-4 py-5">
      <svg viewBox="0 0 660 220" className="h-full w-full" role="img" aria-label="访问与练习趋势">
        {[0, 1, 2, 3, 4].map((item) => (
          <line key={item} x1="12" x2="640" y1={item * 42 + 20} y2={item * 42 + 20} stroke="#e5e7eb" strokeDasharray="4 4" />
        ))}
        <path d={accessPath} fill="none" stroke="#1677ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        <path d={practicePath} fill="none" stroke="#12b76a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {[12, 115, 218, 321, 424, 527, 630].map((x, index) => (
          <g key={x}>
            <circle cx={x} cy={[160, 125, 118, 92, 74, 84, 110][index]} r="5" fill="#fff" stroke="#1677ff" strokeWidth="4" />
            <circle cx={x} cy={[190, 172, 158, 136, 118, 128, 154][index]} r="5" fill="#fff" stroke="#12b76a" strokeWidth="4" />
            <text x={x - 18} y="214" fill="#667085" fontSize="13">05-{19 + index}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function toneClasses(tone: Tone) {
  if (tone === "green") return { bg: "bg-[#ecfdf3]", text: "text-[#12b76a]", badge: "bg-[#dff7ea] text-[#039855]" };
  if (tone === "orange") return { bg: "bg-[#fff7e6]", text: "text-[#fa8c16]", badge: "bg-[#fff4db] text-[#d46b08]" };
  if (tone === "red") return { bg: "bg-[#fff1f0]", text: "text-[#ff4d4f]", badge: "bg-[#ffe4e8] text-[#d92d20]" };
  return { bg: "bg-[#e6f4ff]", text: "text-[#1677ff]", badge: "bg-[#e6f4ff] text-[#1677ff]" };
}

function formatCount(value: ReactNode) {
  if (typeof value === "number") return value.toLocaleString();
  return value;
}
