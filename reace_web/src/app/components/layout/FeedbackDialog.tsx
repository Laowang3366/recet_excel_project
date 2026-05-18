import { useMutation } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { getDialogErrorMessage } from "./dialog-errors";

type FeedbackType = "performance_optimization" | "feature_optimization" | "new_feature" | "other";

type FeedbackForm = {
  type: FeedbackType;
  content: string;
};

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DEFAULT_FEEDBACK_FORM: FeedbackForm = {
  type: "performance_optimization",
  content: "",
};

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>(DEFAULT_FEEDBACK_FORM);

  const feedbackMutation = useMutation({
    mutationFn: () => api.post("/api/feedback", feedbackForm),
    onSuccess: () => {
      toast.success("反馈建议已提交");
      onOpenChange(false);
      setFeedbackForm(DEFAULT_FEEDBACK_FORM);
    },
    onError: (error: unknown) => {
      toast.error(getDialogErrorMessage(error, "反馈提交失败"));
    },
  });

  const submitFeedback = () => {
    const content = feedbackForm.content.trim();
    if (!content) {
      toast.info("请填写反馈内容");
      return;
    }
    if (content.length > 1000) {
      toast.info("反馈内容不能超过1000字");
      return;
    }
    void feedbackMutation.mutateAsync();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>反馈建议</DialogTitle>
          <DialogDescription>欢迎反馈产品问题和改进建议，我们会在后台统一处理与跟进。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block">
            <div className="mb-2 text-sm font-semibold text-slate-700">反馈类型</div>
            <select
              value={feedbackForm.type}
              onChange={(event) => setFeedbackForm((prev) => ({ ...prev, type: event.target.value as FeedbackType }))}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            >
              <option value="performance_optimization">性能优化</option>
              <option value="feature_optimization">功能优化</option>
              <option value="new_feature">新增功能</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label className="block">
            <div className="mb-2 text-sm font-semibold text-slate-700">反馈内容</div>
            <textarea
              value={feedbackForm.content}
              onChange={(event) => setFeedbackForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="请尽量描述清楚问题场景、预期效果或新增需求。"
              className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </label>
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-500" />
              <span>建议描述具体现象、影响范围和你的预期结果。</span>
            </div>
            <span>{feedbackForm.content.trim().length}/1000</span>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitFeedback}
              disabled={feedbackMutation.isPending}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {feedbackMutation.isPending ? "提交中..." : "提交反馈"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
