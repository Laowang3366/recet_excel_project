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

export type CampaignResultMatrixTone = "emerald" | "slate" | "rose";

export function getCampaignResultShellClassName() {
  return "mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8";
}

export function getCampaignResultPanelClassName(passed: boolean) {
  return `overflow-hidden rounded-[32px] border shadow-sm ${
    passed
      ? "border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_24%)]"
      : "border-rose-200 bg-[linear-gradient(180deg,#fff1f2_0%,#ffffff_24%)]"
  }`;
}

export function getCampaignResultAnswerTextClassName() {
  return "min-w-0 max-w-full whitespace-pre-wrap break-words text-sm leading-7 text-teal-900/80";
}

export function getCampaignResultScalarValueClassName() {
  return "max-w-full overflow-x-auto whitespace-pre text-xs font-mono";
}

export function getCampaignResultMatrixContainerClassName() {
  return "w-full overflow-x-auto pb-1";
}

export function getCampaignResultMatrixInnerClassName() {
  return "space-y-2";
}

export function getCampaignResultMatrixRowClassName() {
  return "grid min-w-max grid-flow-col auto-cols-[minmax(112px,260px)] gap-2";
}

export function getCampaignResultMatrixCellClassName(tone: CampaignResultMatrixTone = "slate") {
  const toneClassName = {
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    rose: "border-rose-200 bg-rose-50/70 text-rose-900",
  }[tone];

  return `min-w-0 overflow-x-auto whitespace-pre rounded-lg border px-2.5 py-2 text-xs font-mono leading-5 shadow-sm ${toneClassName}`;
}

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
