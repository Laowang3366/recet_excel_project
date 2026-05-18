export type CampaignRuleResult = {
  passed?: boolean;
  label?: string | null;
  target?: string | null;
  message?: string | null;
  expected?: unknown;
  actual?: unknown;
};

export type CampaignGradingDetail = {
  ruleResults?: CampaignRuleResult[];
} | null;

type CampaignRecordAnswer = {
  id?: number | string | null;
  questionId?: number | string | null;
  questionTitle?: string | null;
  questionExplanation?: string | null;
  analysis?: string | null;
  isCorrect?: boolean;
  questionType?: string | null;
  correctAnswer?: unknown;
  gradingDetail?: CampaignGradingDetail;
};

export type CampaignRecordDetail = {
  answers?: CampaignRecordAnswer[];
  correctCount?: number;
  questionTitle?: string | null;
  questionCategoryName?: string | null;
  score?: number;
  durationSeconds?: number;
  rewardPoints?: number;
};

export type CampaignResultAnswerReview = {
  id: string;
  title: string;
  explanation: string;
  isCorrect: boolean;
  questionType: string;
  correctAnswer: unknown;
  gradingDetail: CampaignGradingDetail;
  hasGradingRules: boolean;
};

export function getCampaignResultAnswerReviews(record: CampaignRecordDetail | null | undefined): CampaignResultAnswerReview[] {
  const answers = Array.isArray(record?.answers) ? record.answers : [];
  return answers.map((answer, index) => {
    const gradingRules = answer?.gradingDetail?.ruleResults;
    return {
      id: String(answer?.id || answer?.questionId || index),
      title: answer?.questionTitle || `题目 ${index + 1}`,
      explanation: answer?.questionExplanation || answer?.analysis || "",
      isCorrect: Boolean(answer?.isCorrect),
      questionType: answer?.questionType || "",
      correctAnswer: answer?.correctAnswer,
      gradingDetail: answer?.gradingDetail || null,
      hasGradingRules: Array.isArray(gradingRules) && gradingRules.length > 0,
    };
  });
}
