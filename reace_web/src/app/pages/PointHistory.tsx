import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, Award, Gift, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { api } from "../lib/api";
import { formatDateTime, formatNumber } from "../lib/format";
import { pointsKeys } from "../lib/query-keys";

type PointsOverviewResponse = {
  user?: {
    points?: number;
  };
};

type PointTransaction = {
  id: number | string;
  change?: number;
  ruleName?: string | null;
  description?: string | null;
  createTime?: string | null;
};

type PointRecordsPage = {
  records?: PointTransaction[];
  pages?: number;
};

export function PointHistory() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const overviewQuery = useQuery({
    queryKey: pointsKeys.overview(),
    queryFn: () => api.get<PointsOverviewResponse>("/api/points/overview", { silent: true }),
  });
  const recordsQuery = useInfiniteQuery({
    queryKey: pointsKeys.records(),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get<PointRecordsPage>(`/api/points/records?page=${pageParam}&size=20`, { silent: true }),
    getNextPageParam: (lastPage, allPages) => (allPages.length < (lastPage.pages || 1) ? allPages.length + 1 : undefined),
  });
  const overview = overviewQuery.data;
  const transactions = recordsQuery.data?.pages.flatMap((page) => page.records || []) || [];
  const hasMore = recordsQuery.hasNextPage;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      if (filter === "earn") return (item.change || 0) > 0;
      if (filter === "spend") return (item.change || 0) < 0;
      return true;
    });
  }, [filter, transactions]);

  const monthlyEarn = transactions.filter((item) => (item.change || 0) > 0).reduce((sum, item) => sum + (item.change || 0), 0);
  const monthlySpend = transactions.filter((item) => (item.change || 0) < 0).reduce((sum, item) => sum + Math.abs(item.change || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 pt-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-teal-600 hover:bg-teal-50 hover:shadow-sm transition-all shadow-sm border border-gray-100">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">积分明细</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg shadow-teal-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-teal-100 font-medium text-sm mb-2">当前可用积分</p>
              <div className="text-4xl font-black tracking-tight mb-1">{formatNumber(overview?.user?.points || 0)}</div>
              <p className="text-teal-50/80 text-xs">持续参与社区互动可获得更多积分</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center"><TrendingUp size={16} /></div><p className="text-slate-500 text-sm font-medium">累计获取</p></div>
            <div className="text-2xl font-bold text-slate-800 ml-11">+{formatNumber(monthlyEarn)} <span className="text-sm font-normal text-slate-400">分</span></div>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center"><TrendingDown size={16} /></div><p className="text-slate-500 text-sm font-medium">累计消耗</p></div>
            <div className="text-2xl font-bold text-slate-800 ml-11">-{formatNumber(monthlySpend)} <span className="text-sm font-normal text-slate-400">分</span></div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
            {[{ id: "all", label: "全部记录" }, { id: "earn", label: "获取" }, { id: "spend", label: "消耗" }].map((tab) => (
              <button key={tab.id} onClick={() => setFilter(tab.id)} className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${filter === tab.id ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors"><Filter size={16} />按月份筛选</button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            <AnimatePresence mode="popLayout">
              {filteredTransactions.map((tx, idx) => (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.05 }} key={tx.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-transform group-hover:scale-105 ${(tx.change || 0) >= 0 ? "bg-emerald-50 border-emerald-100 text-emerald-500" : "bg-rose-50 border-rose-100 text-rose-500"}`}>
                      {(tx.change || 0) >= 0 ? <Award size={20} /> : <Gift size={20} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 mb-1">{tx.ruleName || tx.description || "积分变动"}</h4>
                      <p className="text-xs text-slate-400 font-medium">{formatDateTime(tx.createTime)}</p>
                    </div>
                  </div>
                  <div className={`text-lg font-black ${(tx.change || 0) >= 0 ? "text-emerald-500" : "text-slate-800"}`}>
                    {(tx.change || 0) > 0 ? "+" : ""}{tx.change || 0}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredTransactions.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <p>暂无相关记录</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
        {hasMore ? (
          <button
            onClick={() => void recordsQuery.fetchNextPage()}
            disabled={recordsQuery.isFetchingNextPage}
            className="text-sm font-medium text-slate-400 hover:text-teal-600 transition-colors disabled:opacity-60"
          >
            {recordsQuery.isFetchingNextPage ? "加载中..." : "加载更多记录..."}
          </button>
          ) : transactions.length > 0 ? (
            <span className="text-sm text-slate-400">已经到底了</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
