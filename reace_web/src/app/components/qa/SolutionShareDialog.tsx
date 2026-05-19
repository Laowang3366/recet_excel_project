import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Share2, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import { qaKeys } from "../../lib/query-keys";

type SolutionShareDialogProps = {
  answerId?: number | string | null;
  title?: string | null;
  disabled?: boolean;
};

export function SolutionShareDialog({ answerId, title, disabled }: SolutionShareDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [thoughtText, setThoughtText] = useState("");
  const [thoughtSource, setThoughtSource] = useState<"manual" | "ai" | "empty">("empty");

  const shareMutation = useMutation({
    mutationFn: () =>
      api.post("/api/qa/solution-shares", {
        answerId: Number(answerId),
        thoughtText: thoughtText.trim(),
        thoughtSource,
      }, { silent: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qaKeys.all });
      toast.success("解题答案已分享");
      setOpen(false);
      setThoughtText("");
      setThoughtSource("empty");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "分享失败");
    },
  });

  const aiDraftMutation = useMutation({
    mutationFn: () =>
      api.post<{ thoughtText?: string }>("/api/qa/solution-shares/ai-draft", {
        answerId: Number(answerId),
      }, { silent: true }),
    onSuccess: (result) => {
      setThoughtText(result.thoughtText || "");
      setThoughtSource("ai");
      toast.success("AI 思路草稿已生成");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "AI 生成失败");
    },
  });

  const canShare = Boolean(answerId) && !disabled;

  const handlePublish = () => {
    if (!canShare) {
      toast.error("当前答案不能分享");
      return;
    }
    shareMutation.mutate();
  };

  return (
    <>
      <button
        type="button"
        disabled={!canShare}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Share2 size={16} />
        分享答案/思路
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-lg font-black text-slate-900">分享解题答案</div>
                <div className="mt-1 text-sm text-slate-500">{title || "当前题目"}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                分享后其他登录用户可查看你的答案、标准答案和判题明细。解题思路可手写、AI 生成，也可以留空。
              </div>
              <textarea
                value={thoughtText}
                onChange={(event) => {
                  setThoughtText(event.target.value);
                  setThoughtSource(event.target.value.trim() ? "manual" : "empty");
                }}
                rows={7}
                placeholder="填写解题思路，例如：先用 FILTER 筛选月份和区域，再用 UNIQUE 得到组合，最后用 BYROW + SUMIFS 聚合..."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => aiDraftMutation.mutate()}
                disabled={aiDraftMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-700 transition hover:bg-sky-50 disabled:opacity-60"
              >
                <Sparkles size={16} />
                {aiDraftMutation.isPending ? "生成中..." : "AI 生成思路"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={shareMutation.isPending}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {shareMutation.isPending ? "发布中..." : thoughtText.trim() ? "发布分享" : "不填直接分享"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
