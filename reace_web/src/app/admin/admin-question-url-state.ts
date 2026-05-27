export function resolveInitialQuestionCategoryId(search: string) {
  const params = new URLSearchParams(search);
  const value = params.get("questionCategoryId")?.trim() || "";
  return /^\d+$/.test(value) ? value : "";
}
