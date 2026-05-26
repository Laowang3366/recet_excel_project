export type QuestionCategoryViewRecord = {
  id: number;
  name?: string | null;
  description?: string | null;
  groupName?: string | null;
  sortOrder?: number | string | null;
  enabled?: boolean | null;
  questionCount?: number | string | null;
};

export type QuestionCategoryStats = {
  categoryCount: number;
  questionCount: number;
  draftCount: number;
  anomalyCount: number;
};

export type QuestionCategoryCard = {
  id: number;
  name: string;
  description: string;
  groupName: string;
  sortOrder: number;
  enabled: boolean;
  questionCount: number;
  statusLabel: "启用" | "需测试" | "草稿";
};

export type SortableQuestionCategoryRow = {
  id: number;
  name: string;
  questionCount: number;
  enabled: boolean;
  sortOrder: number;
};

export const QUESTION_CATEGORY_UNSUPPORTED_DESIGN_FIELDS = [
  "frontDisplayName",
  "iconKey",
  "recommendedDifficulty",
] as const;

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function bySortOrderThenId(left: Pick<QuestionCategoryViewRecord, "id" | "sortOrder">, right: Pick<QuestionCategoryViewRecord, "id" | "sortOrder">) {
  const sortDiff = toNumber(left.sortOrder) - toNumber(right.sortOrder);
  return sortDiff || toNumber(left.id) - toNumber(right.id);
}

export function normalizeQuestionCategoryCards(records: QuestionCategoryViewRecord[]): QuestionCategoryCard[] {
  return [...records]
    .sort(bySortOrderThenId)
    .map((item) => {
      const enabled = item.enabled !== false;
      const questionCount = toNumber(item.questionCount);
      return {
        id: item.id,
        name: toText(item.name) || `分类 ${item.id}`,
        description: toText(item.description),
        groupName: toText(item.groupName),
        sortOrder: toNumber(item.sortOrder),
        enabled,
        questionCount,
        statusLabel: enabled ? "启用" : questionCount > 0 ? "需测试" : "草稿",
      };
    });
}

export function buildQuestionCategoryStats(records: QuestionCategoryViewRecord[]): QuestionCategoryStats {
  const cards = normalizeQuestionCategoryCards(records);
  const sortOrders = new Set<number>();
  let duplicatedSortCount = 0;
  records.forEach((item) => {
    const sortOrder = toNumber(item.sortOrder);
    if (sortOrders.has(sortOrder)) {
      duplicatedSortCount += 1;
    }
    sortOrders.add(sortOrder);
  });

  return {
    categoryCount: cards.length,
    questionCount: cards.reduce((sum, item) => sum + item.questionCount, 0),
    draftCount: cards.filter((item) => !item.enabled).length,
    anomalyCount: records.filter((item) => !toText(item.name)).length + duplicatedSortCount,
  };
}

export function buildSortableCategoryRows(records: QuestionCategoryViewRecord[]): SortableQuestionCategoryRow[] {
  return normalizeQuestionCategoryCards(records).map((item, index) => ({
    id: item.id,
    name: item.name,
    questionCount: item.questionCount,
    enabled: item.enabled,
    sortOrder: (index + 1) * 10,
  }));
}

export function renumberSortableCategoryRows(rows: SortableQuestionCategoryRow[]) {
  return rows.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 }));
}

export function moveSortableCategoryRow(rows: SortableQuestionCategoryRow[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) {
    return renumberSortableCategoryRows(rows);
  }
  const next = [...rows];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return renumberSortableCategoryRows(next);
}
