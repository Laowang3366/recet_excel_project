import { normalizeExcelFormulaText, type ExcelWorkbookSnapshot } from "./excel";

type WorkbookCellSnapshot = ExcelWorkbookSnapshot["sheets"][number]["cells"][string];

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
