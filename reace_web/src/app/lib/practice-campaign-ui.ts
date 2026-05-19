type ChapterLike = {
  unlocked?: boolean | null;
};

type SearchableTextLike = {
  name?: string | null;
  description?: string | null;
  title?: string | null;
  summary?: string | null;
};

type SessionLike = {
  id?: number | string | null;
};

export function canExpandChapterQuestions(chapter: ChapterLike | null | undefined) {
  return Boolean(chapter?.unlocked);
}

export function getChapterQuestionToggleLabel({
  isExpanded,
  isUnlocked,
}: {
  isExpanded: boolean;
  isUnlocked: boolean;
}) {
  if (!isUnlocked) {
    return "等待解锁";
  }
  return isExpanded ? "收起题目" : "题目列表";
}

export function getCampaignLevelStatusLabel(status?: string | null) {
  if (status === "locked") {
    return "未解锁";
  }
  if (status === "perfect") {
    return "满星";
  }
  if (status === "cleared") {
    return "已通关";
  }
  return "可挑战";
}

export function getCampaignProgressSessionKey(user?: SessionLike | null, token?: string | null) {
  const normalizedUserId = user?.id === null || user?.id === undefined ? "" : String(user.id).trim();
  if (normalizedUserId) {
    return `user:${normalizedUserId}`;
  }
  return token ? "auth-pending" : "guest";
}

export function campaignChapterMatchesSearch(chapter: SearchableTextLike, searchTerm?: string | null) {
  return searchableTextIncludes([chapter.name, chapter.description], searchTerm);
}

export function filterCampaignLevelsBySearch<T extends SearchableTextLike>(levels: T[], searchTerm?: string | null) {
  const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
  if (!normalizedSearchTerm) return levels;
  return levels.filter((level) => searchableTextIncludes([level.title, level.summary], normalizedSearchTerm));
}

export function getCampaignQuestionListPath(chapterId?: number | string | null) {
  const normalizedChapterId = chapterId === null || chapterId === undefined ? "" : String(chapterId).trim();
  if (!normalizedChapterId) {
    return "/practice";
  }
  return `/practice?chapter=${encodeURIComponent(normalizedChapterId)}`;
}

export function getPracticeDetailEditorKey(questionId?: number | string | null) {
  const normalizedQuestionId = questionId === null || questionId === undefined ? "" : String(questionId).trim();
  return `practice-question-${normalizedQuestionId || "unknown"}`;
}

function normalizeSearchTerm(searchTerm?: string | null) {
  return (searchTerm || "").trim().toLowerCase();
}

function searchableTextIncludes(values: Array<string | null | undefined>, searchTerm?: string | null) {
  const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
  if (!normalizedSearchTerm) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(normalizedSearchTerm));
}
