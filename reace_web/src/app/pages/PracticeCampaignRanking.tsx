import { useQuery } from "@tanstack/react-query";
import { Award, ArrowLeft, Crown, Medal, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../lib/api";
import { normalizeAvatarUrl } from "../lib/mappers";
import { practiceKeys } from "../lib/query-keys";

type CampaignRankingRecord = {
  userId: number | string;
  username?: string | null;
  avatar?: string | null;
  rank?: number;
  clearedLevels?: number;
  perfectLevels?: number;
  totalStars?: number;
  totalScore?: number;
};

type CampaignRankingsResponse = {
  records?: CampaignRankingRecord[];
};

export function PracticeCampaignRanking() {
  const navigate = useNavigate();
  const [scope, setScope] = useState("all");
  const rankingQuery = useQuery({
    queryKey: practiceKeys.campaignRankings(scope),
    queryFn: () => api.get<CampaignRankingsResponse>(`/api/practice/campaign/rankings?scope=${scope}`, { silent: true }),
  });

  const records = rankingQuery.data?.records || [];

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-6">
      <button type="button" onClick={() => navigate("/practice")} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft size={16} />
        返回闯关大厅
      </button>

      <div className="rounded-[34px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <Trophy size={22} />
          </div>
          <div>
            <div className="text-[13px] font-black uppercase tracking-[0.18em] text-slate-400">RANKING</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">闯关排行榜</h1>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { value: "daily", label: "日榜" },
            { value: "weekly", label: "周榜" },
            { value: "all", label: "总榜" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setScope(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                scope === item.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {records.map((item, index) => (
            <motion.div
              key={item.userId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-5"
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-black ${
                  item.rank === 1 ? "bg-amber-100 text-amber-700" : item.rank === 2 ? "bg-slate-200 text-slate-700" : item.rank === 3 ? "bg-orange-100 text-orange-700" : "bg-white text-slate-500"
                }`}>
                  {item.rank === 1 ? <Crown size={24} /> : item.rank === 2 ? <Trophy size={22} /> : item.rank === 3 ? <Medal size={22} /> : `#${item.rank}`}
                </div>
                <img
                  src={normalizeAvatarUrl(item.avatar, item.username)}
                  alt={item.username}
                  className="h-12 w-12 rounded-full object-cover border border-slate-200"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-black text-slate-900">{item.username}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-bold text-slate-400">
                    <span className="rounded-full bg-white px-3 py-1">通关 {item.clearedLevels}</span>
                    <span className="rounded-full bg-white px-3 py-1">满星 {item.perfectLevels}</span>
                    <span className="rounded-full bg-white px-3 py-1">总星数 {item.totalStars}</span>
                    <span className="rounded-full bg-white px-3 py-1">总得分 {item.totalScore}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-600">
                  <Award size={15} />
                  TOP {item.rank}
                </div>
              </div>
            </motion.div>
          ))}

          {records.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
              <div className="text-sm font-bold text-slate-600">当前还没有排行榜数据</div>
              <div className="mt-2 text-xs text-slate-400">用户完成闯关后，这里会自动累计排行。</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
