import { formatQaFeedbackReason } from "../lib/qa";
import type { QaCaseAnswer, QaCaseHelp, QaSolutionShare } from "../lib/qa";

export type AdminQaTabKey = "cases" | "answers" | "shares" | "feedback";
export type AdminQaRowSource = "case" | "answer" | "share" | "feedback";
export type AdminQaStatusTone = "warning" | "success" | "info" | "danger" | "neutral";
export type AdminQaActionMode = "assign" | "review" | "view";

export type AdminQaStatsInput = {
  cases?: number;
  pendingCases?: number;
  answers?: number;
  pendingAnswers?: number;
  solutionShares?: number;
  featuredShares?: number;
  feedback?: number;
  unreadFeedback?: number;
};

export type AdminQaFeedbackRecord = {
  id: number;
  caseId?: number;
  reason?: string | null;
  detail?: string | null;
  status?: string | null;
  handledBy?: number | null;
  handledAt?: string | null;
  handleNote?: string | null;
  createTime?: string | null;
  author?: { username?: string | null } | null;
};

export type AdminQaStatCard = {
  key: "cases" | "answers" | "shares" | "feedback";
  label: string;
  value: number;
  hintLabel: string;
  hintValue: number;
  tone: "green" | "orange" | "blue" | "red";
};

export type AdminQaRow = {
  id: number;
  source: AdminQaRowSource;
  title: string;
  user: string;
  typeLabel: string;
  statusLabel: string;
  statusTone: AdminQaStatusTone;
  submittedAt?: string | null;
  actionMode: AdminQaActionMode;
  original: QaCaseHelp | QaCaseAnswer | QaSolutionShare | AdminQaFeedbackRecord;
};

export function buildAdminQaStatCards(stats: AdminQaStatsInput = {}): AdminQaStatCard[] {
  return [
    { key: "cases", label: "案例求助", value: stats.cases ?? 0, hintLabel: "待处理", hintValue: stats.pendingCases ?? 0, tone: "green" },
    { key: "answers", label: "答疑提交", value: stats.answers ?? 0, hintLabel: "待审核", hintValue: stats.pendingAnswers ?? 0, tone: "orange" },
    { key: "shares", label: "解题分享", value: stats.solutionShares ?? 0, hintLabel: "精选", hintValue: stats.featuredShares ?? 0, tone: "blue" },
    { key: "feedback", label: "反馈", value: stats.feedback ?? 0, hintLabel: "未读", hintValue: stats.unreadFeedback ?? 0, tone: "red" },
  ];
}

export function buildAdminQaRows({
  tab,
  cases = [],
  answers = [],
  shares = [],
  feedback = [],
  keyword = "",
  status = "all",
}: {
  tab: AdminQaTabKey;
  cases?: readonly QaCaseHelp[];
  answers?: readonly QaCaseAnswer[];
  shares?: readonly QaSolutionShare[];
  feedback?: readonly AdminQaFeedbackRecord[];
  keyword?: string;
  status?: string;
}) {
  const rows = getRowsForTab(tab, cases, answers, shares, feedback);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const normalizedStatus = status.trim().toLowerCase();

  return rows.filter((row) => {
    const matchesKeyword = !normalizedKeyword
      || [row.title, row.user, row.typeLabel, row.statusLabel].some((value) => value.toLowerCase().includes(normalizedKeyword));
    const matchesStatus = normalizedStatus === "" || normalizedStatus === "all"
      || row.statusLabel.toLowerCase() === normalizedStatus
      || getRawStatus(row).toLowerCase() === normalizedStatus;
    return matchesKeyword && matchesStatus;
  });
}

export function getAdminQaStatusLabel(source: AdminQaRowSource, value?: string | null) {
  const normalized = String(value ?? "").toLowerCase();
  if (source === "case") {
    const map: Record<string, string> = {
      open: "待处理",
      answered: "已回复",
      accepted: "已沉淀",
      closed: "已关闭",
      deleted: "已删除",
      pending_review: "待审核",
    };
    return map[normalized] || "待处理";
  }
  if (source === "answer") {
    const map: Record<string, string> = {
      active: "待审核",
      approved: "已通过",
      accepted: "已通过",
      deleted: "已删除",
      rejected: "已驳回",
    };
    return map[normalized] || "待审核";
  }
  if (source === "share") {
    const map: Record<string, string> = {
      published: "已沉淀",
      unpublished: "待审核",
      deleted: "已下架",
      rejected: "已驳回",
    };
    return map[normalized] || "待审核";
  }
  if (source === "feedback") {
    const map: Record<string, string> = {
      active: "未读",
      pending: "未读",
      handled: "已处理",
      ignored: "已忽略",
    };
    return map[normalized] || formatQaFeedbackReason(value);
  }
  return formatQaFeedbackReason(value);
}

export function getAdminQaStatusTone(source: AdminQaRowSource, value?: string | null): AdminQaStatusTone {
  const label = getAdminQaStatusLabel(source, value);
  if (/待|未读|需求|缺|太难/.test(label)) return "warning";
  if (/已回复|已通过|已沉淀|已处理/.test(label)) return "success";
  if (/驳回|删除|下架/.test(label)) return "danger";
  if (/审核/.test(label)) return "info";
  return "neutral";
}

export function getAdminQaMissingCapabilities() {
  return [];
}

function getRowsForTab(
  tab: AdminQaTabKey,
  cases: readonly QaCaseHelp[],
  answers: readonly QaCaseAnswer[],
  shares: readonly QaSolutionShare[],
  feedback: readonly AdminQaFeedbackRecord[],
) {
  if (tab === "answers") return answers.map(toAnswerRow);
  if (tab === "shares") return shares.map(toShareRow);
  if (tab === "feedback") return feedback.map(toFeedbackRow);
  return cases.map(toCaseRow);
}

function toCaseRow(item: QaCaseHelp): AdminQaRow {
  return {
    id: item.id,
    source: "case",
    title: item.title || `案例求助 #${item.id}`,
    user: item.author?.username || fallbackUserName(item.userId),
    typeLabel: inferCaseType(item),
    statusLabel: getAdminQaStatusLabel("case", item.status),
    statusTone: getAdminQaStatusTone("case", item.status),
    submittedAt: item.createTime,
    actionMode: item.status === "open" || item.status === "answered" ? "assign" : "view",
    original: item,
  };
}

function toAnswerRow(item: QaCaseAnswer): AdminQaRow {
  return {
    id: item.id,
    source: "answer",
    title: `答疑提交 #${item.id}`,
    user: item.author?.username || fallbackUserName(item.userId),
    typeLabel: "答疑提交",
    statusLabel: getAdminQaStatusLabel("answer", item.status),
    statusTone: getAdminQaStatusTone("answer", item.status),
    submittedAt: item.createTime,
    actionMode: item.status === "active" ? "review" : "view",
    original: item,
  };
}

function toShareRow(item: QaSolutionShare): AdminQaRow {
  return {
    id: item.id,
    source: "share",
    title: item.title || `解题分享 #${item.id}`,
    user: item.author?.username || fallbackUserName(item.userId),
    typeLabel: "解题分享",
    statusLabel: getAdminQaStatusLabel("share", item.status),
    statusTone: getAdminQaStatusTone("share", item.status),
    submittedAt: item.createTime,
    actionMode: item.status === "published" ? "view" : "review",
    original: item,
  };
}

function toFeedbackRow(item: AdminQaFeedbackRecord): AdminQaRow {
  return {
    id: item.id,
    source: "feedback",
    title: item.detail || formatQaFeedbackReason(item.reason),
    user: item.author?.username || "用户",
    typeLabel: "答疑者反馈",
    statusLabel: getAdminQaStatusLabel("feedback", item.status || "active"),
    statusTone: getAdminQaStatusTone("feedback", item.status || "active"),
    submittedAt: item.createTime,
    actionMode: "view",
    original: item,
  };
}

function inferCaseType(item: QaCaseHelp) {
  const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  if (/vlookup|count|if|公式|函数|文本|拆分/.test(text)) return "函数问题";
  if (/文件|模板|上传|附件|xlsx|excel/.test(text)) return "文件问题";
  if (/数据|power query|动态数组|溢出|透视/.test(text)) return "数据处理";
  if (/图表/.test(text)) return "图表问题";
  return "功能问题";
}

function fallbackUserName(userId?: number | string | null) {
  return userId == null ? "用户" : `user_${userId}`;
}

function getRawStatus(row: AdminQaRow) {
  const original = row.original as { status?: string | null; reason?: string | null };
  return original.status || original.reason || "";
}
