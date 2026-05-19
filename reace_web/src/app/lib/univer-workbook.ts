import type { IWorkbookData } from "@univerjs/core";
import { columnIndexToLabel, columnLabelToIndex, normalizeExcelFormulaText, parseCellRef, toCellRef, type ExcelWorkbookSnapshot } from "./excel";

type UniverCellData = {
  v?: unknown;
  f?: unknown;
  si?: unknown;
};

type SharedFormulaAnchor = {
  row: number;
  col: number;
  formula: string;
};

export type UniverWorkbookSnapshotOptions = {
  moveFormulaRefOffset?: (formula: string, colOffset: number, rowOffset: number) => string;
};

type UniverFacadeRange = {
  getValues?: () => unknown[][];
  getDisplayValues?: () => string[][];
  getFormulas?: () => string[][];
};

type UniverFacadeWorksheet = {
  getSheetName: () => string;
  getLastRow?: () => number;
  getLastColumn?: () => number;
  getRange: (row: number, column: number, numRows: number, numColumns: number) => UniverFacadeRange;
};

export type UniverWorkbookSnapshotSource = {
  save: () => IWorkbookData;
  getSheets?: () => UniverFacadeWorksheet[];
};

function normalizeFormula(formula: unknown) {
  if (typeof formula !== "string") return null;
  const normalized = normalizeExcelFormulaText(formula);
  return normalized ? normalized : null;
}

function normalizeFormulaId(formulaId: unknown) {
  if (typeof formulaId !== "string") return null;
  const normalized = formulaId.trim();
  return normalized ? normalized : null;
}

function normalizeFacadeValue(value: unknown) {
  return value === undefined ? null : value;
}

function hasText(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function readMatrixValue<T>(matrix: T[][] | null | undefined, row: number, col: number) {
  if (!matrix || !matrix[row]) return undefined;
  return matrix[row][col];
}

function safeReadMatrix<T>(reader: (() => T[][]) | undefined) {
  if (!reader) return null;
  try {
    return reader();
  } catch {
    return null;
  }
}

function maxBoundsFromCells(cells: ExcelWorkbookSnapshot["sheets"][number]["cells"]) {
  return Object.keys(cells || {}).reduce(
    (bounds, cellRef) => {
      const parsed = parseCellRef(cellRef);
      if (!parsed) return bounds;
      return {
        row: Math.max(bounds.row, parsed.row),
        col: Math.max(bounds.col, parsed.col),
      };
    },
    { row: 0, col: 0 },
  );
}

function normalizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function splitFormulaStringLiterals(formula: string) {
  const chunks: Array<{ text: string; isLiteral: boolean }> = [];
  let cursor = 0;
  let literalStart = -1;

  for (let index = 0; index < formula.length; index += 1) {
    if (formula[index] !== "\"") continue;
    if (literalStart >= 0 && formula[index + 1] === "\"") {
      index += 1;
      continue;
    }

    if (literalStart < 0) {
      if (cursor < index) chunks.push({ text: formula.slice(cursor, index), isLiteral: false });
      literalStart = index;
    } else {
      chunks.push({ text: formula.slice(literalStart, index + 1), isLiteral: true });
      cursor = index + 1;
      literalStart = -1;
    }
  }

  if (literalStart >= 0) {
    chunks.push({ text: formula.slice(literalStart), isLiteral: true });
  } else if (cursor < formula.length) {
    chunks.push({ text: formula.slice(cursor), isLiteral: false });
  }

  return chunks;
}

function offsetFormulaRefsFallback(formula: string, colOffset: number, rowOffset: number) {
  if (colOffset === 0 && rowOffset === 0) return formula;
  const cellReferencePattern = /(^|[^A-Za-z0-9_])((?:'[^']*(?:''[^']*)*'|[A-Za-z_][A-Za-z0-9_.]*)!)?(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]*)(?!\s*\()/g;

  return splitFormulaStringLiterals(formula)
    .map((chunk) => {
      if (chunk.isLiteral) return chunk.text;
      return chunk.text.replace(
        cellReferencePattern,
        (match, prefix: string, sheetPrefix: string = "", absoluteCol: string, colLabel: string, absoluteRow: string, rowText: string) => {
          const col = columnLabelToIndex(colLabel);
          const row = Number(rowText);
          const nextCol = absoluteCol ? col : col + colOffset;
          const nextRow = absoluteRow ? row : row + rowOffset;
          if (nextCol < 1 || nextRow < 1) return match;
          return `${prefix}${sheetPrefix}${absoluteCol}${columnIndexToLabel(nextCol)}${absoluteRow}${nextRow}`;
        },
      );
    })
    .join("");
}

function moveFormulaRefOffset(
  formula: string,
  colOffset: number,
  rowOffset: number,
  options: UniverWorkbookSnapshotOptions,
) {
  const formulaText = formula.startsWith("=") ? formula : `=${formula}`;
  try {
    return options.moveFormulaRefOffset?.(formulaText, colOffset, rowOffset) ?? offsetFormulaRefsFallback(formulaText, colOffset, rowOffset);
  } catch {
    return offsetFormulaRefsFallback(formulaText, colOffset, rowOffset);
  }
}

function collectSharedFormulaAnchors(matrix: Record<string, Record<string, UniverCellData | null | undefined>>) {
  const anchors = new Map<string, SharedFormulaAnchor>();

  Object.entries(matrix).forEach(([rowIndex, cols]) => {
    Object.entries(cols || {}).forEach(([colIndex, cellData]) => {
      const formulaId = normalizeFormulaId(cellData?.si);
      const formula = normalizeFormula(cellData?.f);
      if (!formulaId || !formula) return;

      const row = Number(rowIndex) + 1;
      const col = Number(colIndex) + 1;
      const current = anchors.get(formulaId);
      if (!current || row < current.row || (row === current.row && col < current.col)) {
        anchors.set(formulaId, { row, col, formula });
      }
    });
  });

  return anchors;
}

function getCellFormula(
  cellData: UniverCellData | null | undefined,
  row: number,
  col: number,
  anchors: Map<string, SharedFormulaAnchor>,
  options: UniverWorkbookSnapshotOptions,
) {
  const directFormula = normalizeFormula(cellData?.f);
  if (directFormula) return directFormula;

  const formulaId = normalizeFormulaId(cellData?.si);
  const anchor = formulaId ? anchors.get(formulaId) : null;
  if (!anchor) return null;

  const movedFormula = moveFormulaRefOffset(anchor.formula, col - anchor.col, row - anchor.row, options);
  return normalizeFormula(movedFormula) ?? anchor.formula;
}

export function univerDataToWorkbookSnapshot(
  data: IWorkbookData,
  options: UniverWorkbookSnapshotOptions = {},
): ExcelWorkbookSnapshot {
  return {
    sheets: (data.sheetOrder || []).map((sheetId) => {
      const sheet = data.sheets?.[sheetId];
      const cells: Record<string, { value?: unknown; formula?: string | null; display?: string | null }> = {};
      const matrix = (sheet?.cellData || {}) as Record<string, Record<string, UniverCellData | null | undefined>>;
      const sharedFormulaAnchors = collectSharedFormulaAnchors(matrix);

      Object.entries(matrix).forEach(([rowIndex, cols]) => {
        Object.entries(cols || {}).forEach(([colIndex, cellData]) => {
          const row = Number(rowIndex) + 1;
          const col = Number(colIndex) + 1;
          const cellRef = toCellRef(row, col);
          cells[cellRef] = {
            value: cellData?.v ?? "",
            formula: getCellFormula(cellData, row, col, sharedFormulaAnchors, options),
            display: cellData?.v !== undefined && cellData?.v !== null ? String(cellData.v) : "",
          };
        });
      });

      return {
        name: sheet?.name || sheetId,
        rowCount: sheet?.rowCount || 200,
        columnCount: sheet?.columnCount || 40,
        cells,
      };
    }),
  };
}

export function mergeFacadeValuesIntoWorkbookSnapshot(
  snapshot: ExcelWorkbookSnapshot,
  workbookFacade: Pick<UniverWorkbookSnapshotSource, "getSheets"> | null | undefined,
): ExcelWorkbookSnapshot {
  const next: ExcelWorkbookSnapshot = {
    sheets: (snapshot.sheets || []).map((sheet) => ({
      ...sheet,
      cells: { ...(sheet.cells || {}) },
    })),
  };
  const worksheets = workbookFacade?.getSheets?.();
  if (!worksheets?.length) {
    return next;
  }

  next.sheets.forEach((sheetSnapshot, sheetIndex) => {
    const worksheet = worksheets.find((item) => item.getSheetName() === sheetSnapshot.name) || worksheets[sheetIndex];
    if (!worksheet) return;

    const cellBounds = maxBoundsFromCells(sheetSnapshot.cells);
    const rowCount = Math.max(
      normalizeCount(sheetSnapshot.rowCount),
      normalizeCount(worksheet.getLastRow?.()) + 1,
      cellBounds.row,
      1,
    );
    const columnCount = Math.max(
      normalizeCount(sheetSnapshot.columnCount),
      normalizeCount(worksheet.getLastColumn?.()) + 1,
      cellBounds.col,
      1,
    );

    let range: UniverFacadeRange;
    try {
      range = worksheet.getRange(0, 0, rowCount, columnCount);
    } catch {
      return;
    }

    const values = safeReadMatrix(range.getValues?.bind(range));
    const displayValues = safeReadMatrix(range.getDisplayValues?.bind(range));
    const formulas = safeReadMatrix(range.getFormulas?.bind(range));

    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < columnCount; col += 1) {
        const rawValue = normalizeFacadeValue(readMatrixValue(values, row, col));
        const displayValue = readMatrixValue(displayValues, row, col);
        const formulaValue = readMatrixValue(formulas, row, col);
        const cellRef = toCellRef(row + 1, col + 1);
        const existing = sheetSnapshot.cells[cellRef];
        const hasFacadeContent = hasText(rawValue) || hasText(displayValue);

        if (!existing && !hasFacadeContent) {
          continue;
        }

        const nextCell = {
          ...(existing || {}),
        };

        if (rawValue !== null) {
          nextCell.value = rawValue;
        } else if (!hasText(nextCell.value) && hasText(displayValue)) {
          nextCell.value = displayValue;
        }
        if (displayValue !== undefined) {
          nextCell.display = displayValue == null ? "" : String(displayValue);
        }
        if (existing && hasText(formulaValue)) {
          nextCell.formula = normalizeFormula(formulaValue);
        }

        sheetSnapshot.cells[cellRef] = nextCell;
      }
    }
  });

  return next;
}

export function captureUniverWorkbookSnapshot(
  workbookFacade: UniverWorkbookSnapshotSource,
  options: UniverWorkbookSnapshotOptions = {},
): ExcelWorkbookSnapshot {
  return mergeFacadeValuesIntoWorkbookSnapshot(
    univerDataToWorkbookSnapshot(workbookFacade.save(), options),
    workbookFacade,
  );
}
