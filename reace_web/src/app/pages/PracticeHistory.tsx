import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Clock,
  Target,
  CheckCircle2,
  XCircle,
  Trophy,
  Filter,
  Calendar,
  ChevronRight,
  TrendingUp,
  Search
} from "lucide-react";
import { motion } from "motion/react";
import { api } from "../lib/api";
import { formatDateTime, formatDuration } from "../lib/format";
import { practiceKeys } from "../lib/query-keys";

type PracticeHistoryRecord = {
  id: number | string;
  accuracy?: number;
  durationSeconds?: number;
  categoryName?: string | null;
  questionCategoryName?: string | null;
  submitTime?: string | null;
  questionTitle?: string | null;
  correctCount?: number;
  questionCount?: number;
  score?: number;
  rewardGranted?: boolean;
  rewardPoints?: number;
};

type PracticeHistoryPage = {
  records?: PracticeHistoryRecord[];
  pages?: number;
};

export function PracticeHistory() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const historyQuery = useInfiniteQuery({
    queryKey: practiceKeys.history(),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get<PracticeHistoryPage>(`/api/practice/history?page=${pageParam}&size=20`, { silent: true }),
    getNextPageParam: (lastPage, allPages) => (allPages.length < (lastPage.pages || 1) ? allPages.length + 1 : undefined),
  });
  const historyRecords = historyQuery.data?.pages.flatMap((page) => page.records || []) || [];
  const hasMore = historyQuery.hasNextPage;

  const totalPractices = historyRecords.length;
  const passedPractices = historyRecords.filter((record) => (record.accuracy || 0) >= 60).length;
  const passRate = totalPractices === 0 ? 0 : Math.round((passedPractices / totalPractices) * 100);

  const filteredRecords = useMemo(() => {
    return historyRecords.filter((record) => {
      const passed = (record.accuracy || 0) >= 60;
      if (activeTab === "passed") return passed;
      if (activeTab === "failed") return !passed;
      return true;
    });
  }, [activeTab, historyRecords]);

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/practice")} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-all shadow-sm border border-gray-100">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[22px] font-extrabold text-slate-800 tracking-tight">练习记录</h1>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="搜索练习题目..." className="w-full bg-white border border-gray-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 rounded-xl py-2 pl-10 pr-4 text-[14px] font-medium outline-none transition-all shadow-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-5 text-white shadow-sm relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4"><Target size={120} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-teal-100 font-bold text-[13px] mb-2"><Target size={16} /> 总练习次数</div>
            <div className="text-4xl font-black tracking-tight">{totalPractices} <span className="text-base font-bold text-teal-100 opacity-80">次</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 opacity-[0.03] translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform duration-500"><Trophy size={120} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-[13px] mb-2"><Trophy size={16} className="text-amber-500" /> 通过率</div>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-black tracking-tight text-slate-800">{passRate}%</div>
              <div className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1"><TrendingUp size={10} /> 当前统计</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 opacity-[0.03] translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform duration-500"><Clock size={120} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-[13px] mb-2"><Clock size={16} className="text-blue-500" /> 累计练习时长</div>
            <div className="text-4xl font-black tracking-tight text-slate-800">{Math.round(historyRecords.reduce((sum, item) => sum + (item.durationSeconds || 0), 0) / 60)} <span className="text-base font-bold text-slate-400 opacity-80">分钟</span></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 p-2 flex items-center justify-between bg-gray-50/50">
          <div className="flex p-1 bg-white rounded-xl shadow-sm border border-gray-100">
            <button onClick={() => setActiveTab("all")} className={`px-4 py-2 rounded-lg text-[14px] font-bold transition-all ${activeTab === "all" ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:text-slate-800 hover:bg-gray-50"}`}>全部记录</button>
            <button onClick={() => setActiveTab("passed")} className={`px-4 py-2 rounded-lg text-[14px] font-bold transition-all ${activeTab === "passed" ? "bg-emerald-500 text-white shadow-md" : "text-slate-500 hover:text-emerald-600 hover:bg-gray-50"}`}>已通过</button>
            <button onClick={() => setActiveTab("failed")} className={`px-4 py-2 rounded-lg text-[14px] font-bold transition-all ${activeTab === "failed" ? "bg-rose-500 text-white shadow-md" : "text-slate-500 hover:text-rose-600 hover:bg-gray-50"}`}>未通过</button>
          </div>

          <button className="px-3 py-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 mr-2">
            <Filter size={16} /> 更多筛选
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredRecords.map((record, index) => {
            const passed = (record.accuracy || 0) >= 60;
            return (
              <motion.div key={record.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} onClick={() => navigate(`/practice/history/${record.id}`)} className="p-5 hover:bg-teal-50/30 transition-colors cursor-pointer group flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                <div className="shrink-0 flex items-center md:justify-center w-auto md:w-20">
                  {passed ? (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={24} strokeWidth={2.5} />
                      </div>
                      <span className="text-[12px] font-black text-emerald-600">通过</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                        <XCircle size={24} strokeWidth={2.5} />
                      </div>
                      <span className="text-[12px] font-black text-rose-500">未通过</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-slate-600 text-[11px] font-bold rounded-md">{record.categoryName || record.questionCategoryName || "全部"}</span>
                    <span className="flex items-center gap-1 text-[12px] text-slate-400 font-medium"><Calendar size={12} /> {formatDateTime(record.submitTime)}</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-slate-800 mb-1 group-hover:text-teal-600 transition-colors truncate">{record.questionTitle || record.questionCategoryName || record.categoryName || "练习记录"}</h3>
                  <div className="text-[13px] text-slate-500 font-medium">答对 {record.correctCount || 0} / {record.questionCount || 0} 题</div>
                </div>

                <div className="flex items-center gap-6 shrink-0 mt-2 md:mt-0">
                  <div className="flex flex-col items-end">
                    <div className="text-[24px] font-black tracking-tight" style={{ color: passed ? "#10b981" : "#f43f5e" }}>
                      {record.score || 0}<span className="text-[14px] font-bold opacity-70">分</span>
                    </div>
                    <div className="flex items-center gap-1 text-[12px] text-slate-400 font-medium"><Clock size={12} /> 用时 {formatDuration(record.durationSeconds)}</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-teal-600 group-hover:shadow-sm border border-transparent group-hover:border-teal-100 transition-all hidden sm:flex">
                    <ChevronRight size={18} />
                    </div>
                    {(record.rewardGranted || (record.rewardPoints || 0) > 0) && (
                      <div className="mt-1 text-[12px] font-bold text-amber-600">奖励 +{record.rewardPoints || 0} 积分</div>
                    )}
                  </div>
              </motion.div>
            );
          })}

          {filteredRecords.length === 0 && (
            <div className="py-16 text-center">
              <Target size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-1">暂无练习记录</h3>
              <p className="text-slate-500 text-sm">该分类下没有找到对应的记录哦~</p>
            </div>
          )}
        </div>
      </div>

      <div className="text-center">
        {hasMore ? (
          <button
            onClick={() => void historyQuery.fetchNextPage()}
            disabled={historyQuery.isFetchingNextPage}
            className="text-sm font-medium text-slate-400 hover:text-teal-600 transition-colors disabled:opacity-60"
          >
            {historyQuery.isFetchingNextPage ? "加载中..." : "加载更多记录..."}
          </button>
        ) : historyRecords.length > 0 ? (
          <span className="text-sm text-slate-400">已经到底了</span>
        ) : null}
      </div>
    </div>
  );
}
