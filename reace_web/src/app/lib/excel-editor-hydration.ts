import {
  normalizeExcelFormulaText,
  resolveExcelCellNumberFormat,
  type ExcelCellSnapshot,
  type ExcelWorkbookSnapshot,
} from "./excel";

type WorkbookCellSnapshot = ExcelWorkbookSnapshot["sheets"][number]["cells"][string];
type UniverCellValue = string | number | boolean | { v: unknown; s: { n: { pattern: string } } };

export type WorkbookHydrationValueOptions = {
  hydrateFormulaAsCachedValue?: boolean;
};

export type WorkbookHydrationEntry = {
  cellRef: string;
  cell: WorkbookCellSnapshot;
};

export function orderWorkbookHydrationEntries(
  cells: ExcelWorkbookSnapshot["sheets"][number]["cells"] | null | undefined,
): WorkbookHydrationEntry[] {
  const entries = Object.entries(cells || {}).map(([cellRef, cell]) => ({ cellRef, cell }));
  const sourceValues: WorkbookHydrationEntry[] = [];
  const formulas: WorkbookHydrationEntry[] = [];

  entries.forEach((entry) => {
    if (normalizeExcelFormulaText(entry.cell?.formula)) {
      formulas.push(entry);
      return;
    }
    sourceValues.push(entry);
  });

  return [...sourceValues, ...formulas];
}

function resolveCachedCellValue(cell: ExcelCellSnapshot | null | undefined) {
  if (cell?.value !== null && cell?.value !== undefined) {
    return cell.value;
  }
  const display = cell?.display === null || cell?.display === undefined ? "" : String(cell.display);
  const trimmedDisplay = display.trim();
  if (!trimmedDisplay || trimmedDisplay.startsWith("=")) {
    return undefined;
  }
  return display;
}

export function resolveWorkbookHydrationValue(
  cell: ExcelCellSnapshot | null | undefined,
  options: WorkbookHydrationValueOptions = {},
): UniverCellValue | null | undefined {
  const normalizedFormula = normalizeExcelFormulaText(cell?.formula);
  const cachedValue = resolveCachedCellValue(cell);

  // Imported Excel 365 dynamic-array formulas often have reliable cached results
  // but cannot be fully recalculated by the browser editor. In preserved-spill
  // mode, hydrate those cached results instead of forcing a broken recalculation.
  if (normalizedFormula && !options.hydrateFormulaAsCachedValue) {
    return `=${normalizedFormula}`;
  }
  if (normalizedFormula && cachedValue === undefined) {
    return `=${normalizedFormula}`;
  }

  const value = cachedValue;
  const numberFormat = resolveExcelCellNumberFormat(cell);
  if (numberFormat) {
    return { v: value, s: { n: { pattern: numberFormat } } };
  }
  return value as UniverCellValue | null | undefined;
}
