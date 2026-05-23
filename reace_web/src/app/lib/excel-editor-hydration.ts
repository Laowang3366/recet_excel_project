import {
  cloneWorkbookSnapshot,
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

const EXCEL_ERROR_VALUES = new Set([
  "#DIV/0!",
  "#N/A",
  "#NAME?",
  "#NULL!",
  "#NUM!",
  "#REF!",
  "#SPILL!",
  "#VALUE!",
]);

function normalizeErrorValue(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function isExcelErrorValue(value: unknown) {
  return EXCEL_ERROR_VALUES.has(normalizeErrorValue(value));
}

function hasUsableCachedValue(cell: ExcelCellSnapshot | null | undefined) {
  const value = cell?.value;
  const display = cell?.display;
  const valueText = String(value ?? "").trim();
  const displayText = String(display ?? "").trim();
  return Boolean(
    (valueText && !valueText.startsWith("=") && !isExcelErrorValue(valueText))
    || (displayText && !displayText.startsWith("=") && !isExcelErrorValue(displayText)),
  );
}

function isCapturedFormulaError(cell: ExcelCellSnapshot | null | undefined) {
  return isExcelErrorValue(cell?.value) || isExcelErrorValue(cell?.display);
}

function normalizeComparableCellValue(value: unknown) {
  return String(value ?? "").trim();
}

function matchesCachedDisplay(
  previousCell: ExcelCellSnapshot | null | undefined,
  capturedCell: ExcelCellSnapshot | null | undefined,
) {
  const previousDisplay = normalizeComparableCellValue(previousCell?.display || previousCell?.value);
  const capturedDisplay = normalizeComparableCellValue(capturedCell?.display || capturedCell?.value);
  return Boolean(previousDisplay) && previousDisplay === capturedDisplay;
}

export function preserveImportedFormulaCachedValues(
  previous: ExcelWorkbookSnapshot | null | undefined,
  captured: ExcelWorkbookSnapshot | null | undefined,
): ExcelWorkbookSnapshot {
  const next = cloneWorkbookSnapshot(captured);
  const previousSheets = new Map((previous?.sheets || []).map((sheet) => [sheet.name, sheet]));

  next.sheets.forEach((sheet) => {
    const previousSheet = previousSheets.get(sheet.name);
    if (!previousSheet) return;

    Object.entries(sheet.cells || {}).forEach(([cellRef, capturedCell]) => {
      const previousCell = previousSheet.cells?.[cellRef];
      const previousFormula = normalizeExcelFormulaText(previousCell?.formula);
      const capturedFormula = normalizeExcelFormulaText(capturedCell?.formula);
      if (!previousFormula || !hasUsableCachedValue(previousCell)) return;
      const shouldRecoverFormulaError = capturedFormula === previousFormula && isCapturedFormulaError(capturedCell);
      const shouldRecoverCachedHydration = !capturedFormula && matchesCachedDisplay(previousCell, capturedCell);
      if (!shouldRecoverFormulaError && !shouldRecoverCachedHydration) return;

      // Univer may not support every Excel 365 dynamic-array function. When it
      // reports a recalculation error for an unchanged imported formula, keep
      // Excel's cached result so admin preview/save does not corrupt templates.
      sheet.cells[cellRef] = {
        ...capturedCell,
        formula: previousFormula,
        value: previousCell?.value ?? "",
        display: previousCell?.display ?? null,
        numberFormat: previousCell?.numberFormat ?? capturedCell.numberFormat,
      };
    });
  });

  return next;
}

export function resolveWorkbookHydrationValue(
  cell: ExcelCellSnapshot | null | undefined,
  _options: WorkbookHydrationValueOptions = {},
): UniverCellValue | null | undefined {
  const normalizedFormula = normalizeExcelFormulaText(cell?.formula);
  const cachedValue = resolveCachedCellValue(cell);

  // Keep the formula in the editor model so admins can inspect and save dynamic
  // array anchors instead of accidentally persisting Excel's cached display value.
  if (normalizedFormula) {
    return `=${normalizedFormula}`;
  }

  const value = cachedValue;
  const numberFormat = resolveExcelCellNumberFormat(cell);
  if (numberFormat) {
    return { v: value, s: { n: { pattern: numberFormat } } };
  }
  return value as UniverCellValue | null | undefined;
}
