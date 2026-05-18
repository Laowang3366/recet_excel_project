import {
  columnIndexToLabel,
  getCellDisplayValue,
  getCellInputValue,
  getSheetSnapshot,
  parseCellRef,
  toCellRef,
  type ExcelRangeSelection,
  type ExcelSheetSnapshot,
  type ExcelWorkbookSnapshot,
} from "./excel";

export type FastWorkbookGridCell = {
  ref: string;
  row: number;
  col: number;
  columnLabel: string;
  inputValue: string;
  displayValue: string;
  editable: boolean;
};

export type FastWorkbookGridRow = {
  row: number;
  cells: FastWorkbookGridCell[];
};

export function isCellInSelection(selection: ExcelRangeSelection | null | undefined, row: number, col: number) {
  if (!selection) return true;
  return row >= selection.startRow
    && row <= selection.endRow
    && col >= selection.startCol
    && col <= selection.endCol;
}

export function buildFastWorkbookGridRows(
  workbook: ExcelWorkbookSnapshot,
  sheetName: string,
  editableRange: ExcelRangeSelection | null | undefined,
) {
  const sheet = getSheetSnapshot(workbook, sheetName);
  if (!sheet) return [];
  const bounds = resolveGridBounds(sheet, editableRange);
  const rows: FastWorkbookGridRow[] = [];
  for (let row = 1; row <= bounds.rowCount; row += 1) {
    const cells: FastWorkbookGridCell[] = [];
    for (let col = 1; col <= bounds.columnCount; col += 1) {
      const ref = toCellRef(row, col);
      const cell = sheet.cells?.[ref];
      cells.push({
        ref,
        row,
        col,
        columnLabel: columnIndexToLabel(col),
        inputValue: getCellInputValue(cell),
        displayValue: getCellDisplayValue(cell),
        editable: isCellInSelection(editableRange, row, col),
      });
    }
    rows.push({ row, cells });
  }
  return rows;
}

function resolveGridBounds(sheet: ExcelSheetSnapshot, editableRange: ExcelRangeSelection | null | undefined) {
  let maxRow = Math.max(Number(sheet.rowCount || 0), editableRange?.endRow || 0, 1);
  let maxCol = Math.max(Number(sheet.columnCount || 0), editableRange?.endCol || 0, 1);

  Object.keys(sheet.cells || {}).forEach((cellRef) => {
    const parsed = parseCellRef(cellRef);
    if (!parsed) return;
    maxRow = Math.max(maxRow, parsed.row);
    maxCol = Math.max(maxCol, parsed.col);
  });

  return {
    rowCount: Math.min(maxRow, 120),
    columnCount: Math.min(maxCol, 40),
  };
}
