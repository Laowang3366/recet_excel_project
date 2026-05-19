import { describe, expect, it } from "vitest";
import {
  getCampaignResultAnswerReviews,
  getCampaignResultAnswerTextClassName,
  getCampaignResultAnswerSummaryGridClassName,
  getCampaignResultMatrixContainerClassName,
  getCampaignResultMatrixRowClassName,
  getCampaignResultShellClassName,
} from "./practice-campaign-result-ui";

describe("campaign result answer reviews", () => {
  it("keeps explanation and grading details from practice record answers", () => {
    const reviews = getCampaignResultAnswerReviews({
      answers: [
        {
          questionTitle: "季度销售合计",
          questionExplanation: "使用 SUM 汇总每行三个月销量。",
          gradingDetail: {
            ruleResults: [
              { label: "答案区域", passed: false, expected: [[6]], actual: [[5]] },
            ],
          },
          correctAnswer: { rangeValues: { "Sheet1!F3": [[6]] } },
          isCorrect: false,
        },
      ],
    });

    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      title: "季度销售合计",
      explanation: "使用 SUM 汇总每行三个月销量。",
      hasGradingRules: true,
      isCorrect: false,
    });
  });
});

describe("campaign result layout classes", () => {
  it("uses a wider desktop shell for long answer reviews", () => {
    expect(getCampaignResultShellClassName()).toContain("w-full");
    expect(getCampaignResultShellClassName()).toContain("max-w-[1320px]");
  });

  it("keeps long explanations readable inside answer cards", () => {
    const className = getCampaignResultAnswerTextClassName();

    expect(className).toContain("break-words");
    expect(className).toContain("whitespace-pre-wrap");
  });

  it("renders answer matrices with horizontal overflow instead of vertical over-wrapping", () => {
    expect(getCampaignResultMatrixContainerClassName()).toContain("overflow-x-auto");
    expect(getCampaignResultMatrixRowClassName()).toContain("min-w-max");
  });

  it("places standard values and formulas side by side on desktop", () => {
    expect(getCampaignResultAnswerSummaryGridClassName(true)).toContain("lg:grid-cols-2");
    expect(getCampaignResultAnswerSummaryGridClassName(false)).not.toContain("lg:grid-cols-2");
  });
});
