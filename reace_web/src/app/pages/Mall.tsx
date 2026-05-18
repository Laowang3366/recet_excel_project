import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Award,
  BookOpenCheck,
  Clock3,
  CreditCard,
  ListChecks,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { LitePageFrame, LitePanel } from "../components/LiteSurface";
import { api } from "../lib/api";
import { formatDateTime, formatNumber } from "../lib/format";
import { pointsKeys } from "../lib/query-keys";

const fallbackPointModel = [
  {
    id: "practice",
    name: "练习闯关",
    description: "完成章节练习后，按后台积分规则写入积分记录。",
    points: null,
    type: "成长",
  },
  {
    id: "daily",
    name: "每日行为",
    description: "签到、练习和互动等每日动作会按规则累计积分。",
    points: null,
    type: "每日",
  },
  {
    id: "spend",
    name: "积分使用",
    description: "积分被使用或扣减时，同步进入使用记录并保留余额。",
    points: null,
    type: "支出",
  },
];

type PointsTask = {
  id?: number | string;
  taskKey?: string | null;
  name?: string | null;
  description?: string | null;
  points?: number | string | null;
  type?: string | null;
};

type PointsOverviewResponse = {
  user?: {
    points?: number;
    exp?: number;
    level?: number;
  };
  expProgress?: {
    level?: number;
    currentInLevel?: number;
    totalInLevel?: number;
  };
  tasks?: PointsTask[];
};

type PointRecord = {
  id: number | string;
  change?: number;
  balance?: number;
  ruleName?: string | null;
  description?: string | null;
  createTime?: string | null;
};

type PointRecordsPage = {
  records?: PointRecord[];
  pages?: number;
};

type PointModelItem = {
  id: number | string;
  name?: string | null;
  description: string;
  points: number | null;
  type: string;
};

function resolveModelTypeLabel(type?: string | null) {
  if (type === "daily") return "每日";
  if (type === "once") return "一次性";
  if (type === "growth") return "成长";
  return type || "规则";
}

function formatChange(value?: number | null) {
  const safeValue = Number(value || 0);
  return `${safeValue > 0 ? "+" : ""}${formatNumber(safeValue)}`;
}

export function Mall() {
  const pointsOverviewQuery = useQuery({
    queryKey: pointsKeys.overview(),
    queryFn: () => api.get<PointsOverviewResponse>("/api/points/overview", { silent: true }),
  });

  const recordsQuery = useInfiniteQuery({
    queryKey: [...pointsKeys.records(), "mall"] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get<PointRecordsPage>(`/api/points/records?page=${pageParam}&size=12`, { silent: true }),
    getNextPageParam: (lastPage, allPages) =>
      allPages.length < Number(lastPage.pages || 1) ? allPages.length + 1 : undefined,
  });

  const overview = pointsOverviewQuery.data;
  const user = overview?.user || {};
  const expProgress = overview?.expProgress || {};
  const records = recordsQuery.data?.pages.flatMap((page) => page.records || []) || [];
  const pointModel = useMemo(() => {
    const tasks = (overview?.tasks || []).filter((item) => item?.name);
    if (!tasks.length) return fallbackPointModel;
    return tasks.map((item) => ({
      id: item.id || item.taskKey || item.name,
      name: item.name,
      description: item.description || "按平台积分规则入账。",
      points: Number.isFinite(Number(item.points)) ? Number(item.points) : null,
      type: resolveModelTypeLabel(item.type),
    })) satisfies PointModelItem[];
  }, [overview?.tasks]);

  const displayedEarn = records
    .filter((item) => Number(item.change || 0) > 0)
    .reduce((sum, item) => sum + Number(item.change || 0), 0);
  const displayedSpend = records
    .filter((item) => Number(item.change || 0) < 0)
    .reduce((sum, item) => sum + Math.abs(Number(item.change || 0)), 0);
  const levelProgressPercent =
    Number(expProgress.totalInLevel || 0) > 0
      ? Math.max(0, Math.min(100, Math.round((Number(expProgress.currentInLevel || 0) / Number(expProgress.totalInLevel || 0)) * 100)))
      : 0;

  return (
    <LitePageFrame className="pb-16">
      <section className="border-b border-white/10 pb-8 pt-2 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-black text-[#7cffb2]">积分中心</div>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">积分余额</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/66 sm:text-base">
              查看当前积分、积分累计模型和每一笔使用记录。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <div className="rounded-2xl border border-white/12 bg-white/10 px-5 py-4 backdrop-blur">
              <div className="text-xs font-bold text-white/58">当前积分</div>
              <div className="mt-2 text-3xl font-black">{formatNumber(user.points)}</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/10 px-5 py-4 backdrop-blur">
              <div className="text-xs font-bold text-white/58">当前经验</div>
              <div className="mt-2 text-3xl font-black">{formatNumber(user.exp)}</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/10 px-5 py-4 backdrop-blur">
              <div className="text-xs font-bold text-white/58">等级</div>
              <div className="mt-2 text-3xl font-black">Lv.{expProgress.level || user.level || 1}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <LitePanel className="border-emerald-950/10 bg-[#002015] text-white shadow-[0_24px_60px_rgba(0,32,21,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-[#7cffb2]">
                <CreditCard size={17} />
                积分余额
              </div>
              <div className="mt-5 text-6xl font-black tracking-tight">{formatNumber(user.points)}</div>
              <div className="mt-3 text-sm leading-6 text-white/58">余额来自练习、签到和互动等积分记录。</div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/10">
              <Award size={26} />
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-bold text-white/58">
                <TrendingUp size={15} />
                近页获取
              </div>
              <div className="mt-2 text-2xl font-black text-[#7cffb2]">+{formatNumber(displayedEarn)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-bold text-white/58">
                <TrendingDown size={15} />
                近页使用
              </div>
              <div className="mt-2 text-2xl font-black text-white">-{formatNumber(displayedSpend)}</div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
            <div className="flex items-center justify-between text-xs font-bold text-white/58">
              <span>等级进度</span>
              <span>{levelProgressPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-[#00b050]" style={{ width: `${levelProgressPercent}%` }} />
            </div>
          </div>
        </LitePanel>

        <LitePanel className="border-emerald-200/80 bg-[linear-gradient(135deg,#f4fff8_0%,#dcfce7_100%)] shadow-[0_24px_60px_rgba(0,92,48,0.12)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-700">
              <BookOpenCheck size={23} />
            </div>
            <div>
              <div className="text-sm font-black text-emerald-700">积分模型</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950">积分如何入账</h2>
            </div>
          </div>

          <div className="mt-6 divide-y divide-emerald-100/80 overflow-hidden rounded-3xl border border-emerald-200/80 bg-white/70">
            {pointModel.map((item) => (
              <div key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-slate-950">{item.name}</h3>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                      {item.type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                </div>
                <div className="text-left sm:text-right">
                  {item.points === null ? (
                    <span className="text-sm font-black text-slate-400">按规则</span>
                  ) : (
                    <span className="text-xl font-black text-emerald-700">+{formatNumber(item.points)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </LitePanel>
      </section>

      <LitePanel className="border-emerald-200/80 bg-[#f4fff8] shadow-[0_24px_60px_rgba(0,92,48,0.10)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-emerald-700">
              <ListChecks size={17} />
              使用记录
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">积分流水</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">记录积分获取、使用和扣减后的余额。</p>
          </div>
          <div className="text-sm font-bold text-slate-400">{records.length ? `已加载 ${records.length} 条` : "暂无记录"}</div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-200/80">
          <div className="hidden grid-cols-[1fr_120px_120px_180px] border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-xs font-black text-emerald-700/70 sm:grid">
            <span>来源</span>
            <span>变动</span>
            <span>余额</span>
            <span>时间</span>
          </div>
          <div className="divide-y divide-emerald-100/70 bg-white/82">
            {records.map((record) => {
              const change = Number(record.change || 0);
              return (
                <div key={record.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_120px_120px_180px] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                          change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {change >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-slate-950">
                          {record.ruleName || record.description || "积分变动"}
                        </div>
                        {record.description ? (
                          <div className="mt-1 truncate text-xs font-semibold text-slate-400">{record.description}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className={`text-base font-black ${change >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {formatChange(change)}
                  </div>
                  <div className="text-sm font-black text-slate-700">{formatNumber(record.balance)}</div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                    <Clock3 size={14} />
                    {formatDateTime(record.createTime) || "-"}
                  </div>
                </div>
              );
            })}
            {!records.length ? (
              <div className="px-6 py-14 text-center text-sm font-semibold text-slate-400">
                暂无使用记录
              </div>
            ) : null}
          </div>
        </div>

        {recordsQuery.hasNextPage ? (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => void recordsQuery.fetchNextPage()}
              disabled={recordsQuery.isFetchingNextPage}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-60"
            >
              {recordsQuery.isFetchingNextPage ? "加载中..." : "加载更多记录"}
            </button>
          </div>
        ) : null}
      </LitePanel>
    </LitePageFrame>
  );
}
