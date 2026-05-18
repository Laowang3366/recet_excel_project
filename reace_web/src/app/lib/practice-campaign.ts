import { api } from "./api";

type CampaignLevelDetailResponse = {
  question?: { id?: number | null } | null;
};

type CampaignLevelStartResponse = {
  attemptId?: number | string | null;
};

export async function startCampaignLevel(levelId: number | string, questionId?: number | null) {
  const normalizedLevelId = Number(levelId);
  if (!normalizedLevelId) {
    throw new Error("关卡不存在");
  }

  let resolvedQuestionId = questionId ? Number(questionId) : 0;
  if (!resolvedQuestionId) {
    const detail = await api.get<CampaignLevelDetailResponse>(`/api/practice/campaign/levels/${normalizedLevelId}`, { silent: true });
    resolvedQuestionId = Number(detail?.question?.id || 0);
  }

  if (!resolvedQuestionId) {
    throw new Error("当前关卡未绑定题目");
  }

  const result = await api.post<CampaignLevelStartResponse>(`/api/practice/campaign/levels/${normalizedLevelId}/start`, { attemptType: "campaign" }, { silent: true });
  return {
    questionId: resolvedQuestionId,
    attemptId: result?.attemptId,
  };
}
