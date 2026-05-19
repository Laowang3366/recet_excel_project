import type { ExcelWorkbookSnapshot } from "./excel";

export type QaAuthor = {
  id?: number | string | null;
  username?: string | null;
  avatar?: string | null;
};

export type QaSolutionShare = {
  id: number;
  userId?: number;
  answerId?: number;
  questionId?: number;
  title?: string | null;
  thoughtText?: string | null;
  thoughtSource?: "manual" | "ai" | "empty" | string;
  status?: "published" | "unpublished" | "deleted" | string;
  viewCount?: number;
  createTime?: string | null;
  updateTime?: string | null;
  author?: QaAuthor | null;
  answer?: QaPracticeAnswer | null;
};

export type QaPracticeAnswer = {
  id?: number | string | null;
  questionId?: number | string | null;
  questionType?: string | null;
  questionTitle?: string | null;
  questionExplanation?: string | null;
  userAnswer?: unknown;
  correctAnswer?: unknown;
  gradingDetail?: unknown;
  isCorrect?: boolean;
  score?: number;
};

export type QaCaseHelp = {
  id: number;
  userId?: number;
  title?: string | null;
  description?: string | null;
  status?: "open" | "answered" | "accepted" | "closed" | "deleted" | string;
  acceptedAnswerId?: number | null;
  acceptedAt?: string | null;
  templateFileUrl?: string | null;
  answerSheet?: string | null;
  answerRange?: string | null;
  idealAnswerSnapshot?: unknown;
  viewCount?: number;
  answerCount?: number;
  createTime?: string | null;
  updateTime?: string | null;
  author?: QaAuthor | null;
  answers?: QaCaseAnswer[];
};

export type QaCaseAnswer = {
  id: number;
  caseId?: number;
  userId?: number;
  answerFileUrl?: string | null;
  status?: "active" | "accepted" | "deleted" | string;
  upVoteCount?: number;
  downVoteCount?: number;
  rewardPoints?: number;
  acceptedAt?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  author?: QaAuthor | null;
};

export type QaPageResponse<T> = {
  records: T[];
  total: number;
  page?: number;
  size?: number;
};

export type QaMyResponse = {
  cases: QaPageResponse<QaCaseHelp>;
  answers: QaPageResponse<QaCaseAnswer>;
  shares: QaPageResponse<QaSolutionShare>;
};

export type QaTemplateSnapshotResponse = ExcelWorkbookSnapshot;

export function formatQaStatus(status?: string | null) {
  switch (status) {
    case "answered":
      return "待采纳";
    case "accepted":
      return "已答疑";
    case "closed":
      return "已关闭";
    case "deleted":
      return "已删除";
    default:
      return "待答疑";
  }
}

export function formatQaAnswerStatus(status?: string | null) {
  switch (status) {
    case "accepted":
      return "已采纳";
    case "deleted":
      return "已删除";
    default:
      return "待采纳";
  }
}

export function formatQaFeedbackReason(reason?: string | null) {
  switch (reason) {
    case "unclear_requirement":
      return "需求描述不清";
    case "missing_expected_answer":
      return "模板没有预设答案";
    case "bad_source_data":
      return "源数据有问题";
    case "too_hard":
      return "太难了，无法解答";
    case "other":
      return "其它";
    default:
      return reason || "-";
  }
}

export function formatQaValue(value: unknown) {
  if (value === null || value === undefined) return "无";
  if (typeof value === "string") return value || "无";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
