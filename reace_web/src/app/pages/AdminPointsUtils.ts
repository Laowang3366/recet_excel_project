import type { AdminOptionChoiceInput, PointsOptionForm, PointsOptionKind, PointsOptionRecord, PointsRuleForm } from "./AdminConsoleTypes";

export function defaultPointsRuleForm(defaultType = "daily"): PointsRuleForm {
  return { name: "", description: "", taskKey: "", points: 0, type: defaultType, enabled: true, userVisible: true, sortOrder: 0 };
}

export function defaultPointsOptionForm(kind: PointsOptionKind): PointsOptionForm {
  return { kind, value: "", label: "", sortOrder: 0 };
}

export function buildAdminOptionChoices(
  source: PointsOptionRecord[] | undefined,
  fallback: AdminOptionChoiceInput[],
  currentValue?: unknown,
) {
  const sourceItems: AdminOptionChoiceInput[] = source && source.length > 0 ? source : fallback;
  const normalizedSource = sourceItems.map((item) => ({
    value: String(item.value ?? item.optionValue ?? "").trim(),
    label: String(item.label ?? item.value ?? item.optionValue ?? "").trim(),
  })).filter((item) => item.value);
  const normalizedCurrent = String(currentValue ?? "").trim();
  if (!normalizedCurrent) return normalizedSource;
  return normalizedSource.some((item) => item.value === normalizedCurrent)
    ? normalizedSource
    : [...normalizedSource, { value: normalizedCurrent, label: normalizedCurrent }];
}

export function buildAdminOptionLabelMap(options: Array<{ value: string; label: string }>) {
  return new Map(options.map((item) => [item.value, item.label]));
}

export function generateMachineIdentifier(label: unknown, prefix: string, existingValues: string[]) {
  const normalizedLabel = String(label || "").trim().toLowerCase();
  const asciiChars = normalizedLabel
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .split("")
    .flatMap((char) => {
      if (/[a-z0-9]/.test(char)) return [char];
      if (char === "_") return ["_"];
      if (/[\u4e00-\u9fa5]/.test(char)) return [`u${char.codePointAt(0)?.toString(16) || ""}`];
      return [];
    })
    .join("_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const base = asciiChars || prefix;
  const safePrefix = prefix.replace(/[^a-z0-9_]/g, "_") || "id";
  const seed = /^[a-z]/.test(base) ? base : `${safePrefix}_${base}`;
  const used = new Set(existingValues.map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (!used.has(seed)) return seed;
  let index = 2;
  while (used.has(`${seed}_${index}`)) {
    index += 1;
  }
  return `${seed}_${index}`;
}
