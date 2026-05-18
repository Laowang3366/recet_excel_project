import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarCheck, CheckCircle2, Gift, Zap, Star, ThumbsUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { api } from "../lib/api";
import { pointsKeys } from "../lib/query-keys";

const iconMap: Record<string, LucideIcon> = {
  daily_checkin: CalendarCheck,
  daily_practice: ThumbsUp,
  first_practice: Star,
};

const activeTaskKeys = new Set(["daily_checkin", "daily_practice", "first_practice"]);

type PointsTask = {
  id: number | string;
  taskKey?: string | null;
  type?: string | null;
  name?: string | null;
  description?: string | null;
  points?: number;
  completed?: boolean;
  statusText?: string | null;
  actionPath?: string | null;
};

type PointsTasksResponse = {
  tasks?: PointsTask[];
};

type PointsOverviewResponse = {
  user?: {
    points?: number;
  };
};

export function TaskCenter() {
  const navigate = useNavigate();
  const tasksQuery = useQuery({
    queryKey: pointsKeys.tasks(),
    queryFn: () => api.get<PointsTasksResponse>("/api/points/tasks", { silent: true }),
  });
  const overviewQuery = useQuery({
    queryKey: pointsKeys.overview(),
    queryFn: () => api.get<PointsOverviewResponse>("/api/points/overview", { silent: true }),
  });
  const tasks = (tasksQuery.data?.tasks || []).filter((item) => activeTaskKeys.has(item.taskKey || ""));
  const overview = overviewQuery.data;

  const groupedTasks = useMemo(() => ({
    novice: tasks.filter((item) => item.type === "once"),
    daily: tasks.filter((item) => item.type === "daily"),
    growth: tasks.filter((item) => !["daily", "once"].includes(item.type)),
  }), [tasks]);

  const renderTaskGroup = (title: string, items: PointsTask[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-10 last:mb-0">
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mb-5 flex items-center gap-2">{title}</h2>
        <div className="space-y-4">
          {items.map((task, idx) => {
            const Icon = iconMap[task.taskKey] || Gift;
            const isCompleted = Boolean(task.completed);
            return (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={task.id} className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-100 transition-all flex flex-col sm:flex-row gap-5 items-start sm:items-center relative overflow-hidden">
                <div className="w-14 h-14 rounded-[20px] flex items-center justify-center shrink-0 border shadow-sm bg-teal-50 border-teal-200">
                  <Icon size={26} className="text-teal-500" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-[17px] font-bold text-slate-800 truncate">{task.name}</h3>
                    <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md text-xs font-bold border border-amber-100">
                      <Zap size={12} fill="currentColor" />+{task.points}
                    </div>
                  </div>
                  <p className="text-[14px] text-slate-500 mb-4 line-clamp-1">{task.description}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? "bg-emerald-500" : "bg-teal-500"}`} style={{ width: `${isCompleted ? 100 : 20}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-400 w-20 text-right">{task.statusText}</span>
                  </div>
                </div>
                <div className="w-full sm:w-auto mt-4 sm:mt-0 flex justify-end">
                  {isCompleted ? (
                    <button disabled className="px-6 py-2.5 rounded-xl font-bold text-sm bg-slate-50 text-slate-400 flex items-center gap-1.5 border border-slate-100 cursor-not-allowed w-full sm:w-auto justify-center">
                      <CheckCircle2 size={16} />已完成
                    </button>
                  ) : (
                    <button onClick={() => navigate(task.actionPath || "/")} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-teal-50 hover:bg-teal-100 text-teal-600 flex items-center gap-1.5 transition-colors w-full sm:w-auto justify-center">
                      去完成
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 pt-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-teal-600 hover:bg-teal-50 hover:shadow-sm transition-all shadow-sm border border-gray-100">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">任务中心</h1>
        </div>

        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 rounded-[32px] p-8 sm:p-10 text-white shadow-xl shadow-teal-500/20 mb-10 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 text-center sm:text-left">
            <h2 className="text-3xl font-black mb-3 tracking-tight">完成任务，赚取丰厚积分</h2>
            <p className="text-teal-50 opacity-90 text-sm sm:text-base leading-relaxed max-w-md">每日参与练习与任务可持续积累积分。积分会同步进入积分经验中心，用于兑换头衔、权益和功能道具。</p>
          </div>
          <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 min-w-[200px] text-center shrink-0">
            <p className="text-teal-50 text-sm font-medium mb-1">我的积分</p>
            <div className="text-4xl font-black tracking-tight mb-3">{overview?.user?.points || 0}</div>
            <button onClick={() => navigate("/mall")} className="w-full bg-white text-teal-600 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:scale-105 transition-transform">
              进入积分经验中心
            </button>
          </div>
        </div>

        {renderTaskGroup("新手任务", groupedTasks.novice)}
        {renderTaskGroup("每日任务", groupedTasks.daily)}
        {renderTaskGroup("成长任务", groupedTasks.growth)}
      </div>
    </div>
  );
}
