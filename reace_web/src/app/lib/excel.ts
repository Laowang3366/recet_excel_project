export type ExcelCellSnapshot = {
  value?: unknown;
  formula?: string | null;
  display?: string | null;
  numberFormat?: string | null;
};

export type ExcelSheetSnapshot = {
  name: string;
  rowCount?: number | null;
  columnCount?: number | null;
  cells: Record<string, ExcelCellSnapshot>;
};

export type ExcelWorkbookSnapshot = {
  sheets: ExcelSheetSnapshot[];
};

export type ExcelRangeSelection = {
  sheetName: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

export type ExcelAnswerSnapshot = {
  values: unknown[][];
  formulas: string[][];
  displays?: string[][];
  numberFormats?: string[][];
};

export type FormulaAnswerRegion = {
  sheetName: string;
  rangeRef: string;
  anchorCell: string;
  dynamicSpillRange: string;
  formulaCount: number;
  cellCount: number;
};

export type DynamicArrayHydrationRule = {
  sheet: string;
  anchorCell: string;
  spillRange: string;
};

type BuildWorkbookWithAnswerSnapshotOptions = {
  dynamicArrayRules?: DynamicArrayHydrationRule[];
};

function mapFormulaOutsideStringLiterals(formula: string, mapper: (text: string) => string) {
  let result = "";
  let cursor = 0;
  let literalStart = -1;

  for (let index = 0; index < formula.length; index += 1) {
    if (formula[index] !== "\"") continue;
    if (literalStart >= 0 && formula[index + 1] === "\"") {
      index += 1;
      continue;
    }

    if (literalStart < 0) {
      result += mapper(formula.slice(cursor, index));
      literalStart = index;
    } else {
      result += formula.slice(literalStart, index + 1);
      cursor = index + 1;
      literalStart = -1;
    }
  }

  if (literalStart >= 0) {
    result += formula.slice(literalStart);
  } else if (cursor < formula.length) {
    result += mapper(formula.slice(cursor));
  }

  return result;
}

export function normalizeExcelFormulaText(formula: string | null | undefined) {
  if (typeof formula !== "string") return "";
  const normalized = formula.trim().replace(/^=\s*/, "");
  if (!normalized) return "";
  return mapFormulaOutsideStringLiterals(normalized, (text) =>
    text
      .replace(/_xlfn\./gi, "")
      .replace(/_xlpm\./gi, "")
      .replace(/_xlws\./gi, ""),
  ).trim();
}

export function columnIndexToLabel(index: number) {
  let current = Math.max(1, index);
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

export function columnLabelToIndex(label: string) {
  let result = 0;
  for (const ch of label.toUpperCase()) {
    if (ch < "A" || ch > "Z") return 0;
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result;
}

export function toCellRef(row: number, col: number) {
  return `${columnIndexToLabel(col)}${row}`;
}

export function parseCellRef(ref: string) {
  const normalizedRef = ref.trim().toUpperCase().replace(/\$/g, "");
  const match = normalizedRef.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return {
    row: Number(match[2]),
    col: columnLabelToIndex(match[1]),
  };
}

export function parseRangeRef(range: string) {
  if (!range?.trim()) return null;
  const [startText, endText] = range.trim().toUpperCase().split(":");
  const start = parseCellRef(startText);
  const end = parseCellRef(endText || startText);
  if (!start || !end) return null;
  return {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  };
}

export function selectionToRangeRef(selection: ExcelRangeSelection | null | undefined) {
  if (!selection) return "";
  const start = toCellRef(selection.startRow, selection.startCol);
  const end = toCellRef(selection.endRow, selection.endCol);
  return start === end ? start : `${start}:${end}`;
}

export function cloneWorkbookSnapshot(workbook: ExcelWorkbookSnapshot | null | undefined): ExcelWorkbookSnapshot {
  if (!workbook?.sheets) {
    return { sheets: [] };
  }
  return {
    sheets: workbook.sheets.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rowCount ?? 0,
      columnCount: sheet.columnCount ?? 0,
      cells: Object.fromEntries(
        Object.entries(sheet.cells || {}).map(([key, value]) => {
          const numberFormat = typeof value?.numberFormat === "string" ? value.numberFormat.trim() : "";
          const cell: ExcelCellSnapshot = {
            value: value?.value ?? "",
            formula: normalizeExcelFormulaText(value?.formula) || null,
            display: value?.display ?? null,
          };
          if (numberFormat) {
            cell.numberFormat = numberFormat;
          }
          return [key, cell];
        }),
      ),
    })),
  };
}

export function getSheetSnapshot(workbook: ExcelWorkbookSnapshot | null | undefined, sheetName: string | null | undefined) {
  if (!workbook?.sheets || !sheetName) return null;
  return workbook.sheets.find((sheet) => sheet.name === sheetName) || null;
}

export function getCellSnapshot(sheet: ExcelSheetSnapshot | null | undefined, cellRef: string) {
  if (!sheet) return undefined;
  return sheet.cells?.[cellRef];
}

export function getCellInputValue(cell: ExcelCellSnapshot | undefined) {
  if (!cell) return "";
  const formula = normalizeExcelFormulaText(cell.formula);
  if (formula) return `=${formula}`;
  if (cell.value === null || cell.value === undefined) return "";
  return String(cell.value);
}

export function getCellDisplayValue(cell: ExcelCellSnapshot | undefined) {
  if (!cell) return "";
  if (cell.display !== null && cell.display !== undefined && String(cell.display).trim()) {
    return String(cell.display);
  }
  const formula = normalizeExcelFormulaText(cell.formula);
  if (formula) return `=${formula}`;
  if (cell.value === null || cell.value === undefined) return "";
  return String(cell.value);
}

const excelDateDisplayPattern = /^(?:\d{4}[-/年]\d{1,2}(?:[-/月]\d{1,2}日?)?|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/;
const excelDateColumnHeaderPattern = /(?:日期|时间|年月|月份|年|月|日|到期|注册|下单|付款|收款|发货|签约|创建|更新|生效|截止|date|time|day|month|year)/i;
const excelSerialEpochMs = Date.UTC(1899, 11, 30);
const dayMs = 24 * 60 * 60 * 1000;

export type ExcelCellErrorInfo = {
  code: string;
  title: string;
  description: string;
};

export type ExcelWorkbookErrorCell = ExcelCellErrorInfo & {
  sheetName: string;
  cellRef: string;
};

const excelErrorInfo: Record<string, ExcelCellErrorInfo> = {
  "#NAME?": {
    code: "#NAME?",
    title: "无效名称",
    description: "函数名、命名区域或外部兼容前缀未被当前编辑器识别。",
  },
  "#VALUE!": {
    code: "#VALUE!",
    title: "值类型错误",
    description: "公式参数类型不匹配，常见于文本、日期、数字混用。",
  },
  "#REF!": {
    code: "#REF!",
    title: "引用无效",
    description: "公式引用了不存在或已被删除的单元格区域。",
  },
  "#DIV/0!": {
    code: "#DIV/0!",
    title: "除数为零",
    description: "公式中存在除以 0 或空值作为除数的情况。",
  },
  "#NUM!": {
    code: "#NUM!",
    title: "数值无效",
    description: "公式计算得到的数字超出范围或参数数值不合法。",
  },
  "#N/A": {
    code: "#N/A",
    title: "未找到匹配",
    description: "查找类公式没有找到匹配值。",
  },
  "#NULL!": {
    code: "#NULL!",
    title: "交叉区域为空",
    description: "公式中两个区域没有交集。",
  },
  "#SPILL!": {
    code: "#SPILL!",
    title: "数组溢出受阻",
    description: "动态数组公式需要向外溢出，但目标区域被内容占用。",
  },
  "#CALC!": {
    code: "#CALC!",
    title: "计算错误",
    description: "动态数组或 Lambda 类公式计算失败。",
  },
};

function toDatePartsFromExcelSerial(serial: number) {
  const date = new Date(excelSerialEpochMs + Math.round(serial) * dayMs);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function formatDateParts(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function excelSerialFromDateParts(year: number, month: number, day: number) {
  const time = Date.UTC(year, month - 1, day);
  if (Number.isNaN(time)) return null;
  const normalized = new Date(time);
  if (
    normalized.getUTCFullYear() !== year
    || normalized.getUTCMonth() + 1 !== month
    || normalized.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.round((time - excelSerialEpochMs) / dayMs);
}

function parseExcelDateText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const yearFirst = trimmed.match(/^(\d{4})[-/年](\d{1,2})(?:[-/月](\d{1,2})日?)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const month = Number(yearFirst[2]);
    const day = Number(yearFirst[3] || "1");
    const serial = excelSerialFromDateParts(year, month, day);
    return serial ? { serial, display: formatDateParts({ year, month, day }) } : null;
  }

  const slashDate = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (slashDate) {
    const month = Number(slashDate[1]);
    const day = Number(slashDate[2]);
    const rawYear = Number(slashDate[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const serial = excelSerialFromDateParts(year, month, day);
    return serial ? { serial, display: formatDateParts({ year, month, day }) } : null;
  }

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= 100000) {
    const parts = toDatePartsFromExcelSerial(asNumber);
    return parts ? { serial: Math.round(asNumber), display: formatDateParts(parts) } : null;
  }

  return null;
}

function parseExcelDateCell(cell: ExcelCellSnapshot | undefined) {
  if (!cell || normalizeExcelFormulaText(cell.formula)) return null;
  if (typeof cell.value === "number" && Number.isFinite(cell.value) && cell.value >= 1 && cell.value <= 100000) {
    const parts = toDatePartsFromExcelSerial(cell.value);
    return parts ? { serial: Math.round(cell.value), display: formatDateParts(parts) } : null;
  }
  const rawText = cell.value === null || cell.value === undefined ? cell.display : cell.value;
  return parseExcelDateText(String(rawText ?? ""));
}

function cellHasExplicitDateDisplay(cell: ExcelCellSnapshot | undefined) {
  const display = cell?.display === null || cell?.display === undefined ? "" : String(cell.display).trim();
  return Boolean(display && excelDateDisplayPattern.test(display));
}

function cellHasDateColumnSignal(cell: ExcelCellSnapshot | undefined) {
  if (!cell) return false;
  if (resolveExcelCellNumberFormat(cell)) return true;
  return cellHasExplicitDateDisplay(cell);
}

function cellLooksLikeDateHeader(cell: ExcelCellSnapshot | undefined) {
  const text = getCellDisplayValue(cell).trim();
  if (!text) return false;
  return excelDateColumnHeaderPattern.test(text);
}

function shouldConvertSelectionColumnToDate(
  sheet: ExcelSheetSnapshot,
  selection: ExcelRangeSelection,
  col: number,
) {
  if (selection.startRow === selection.endRow && selection.startCol === selection.endCol) {
    return Boolean(parseExcelDateCell(sheet.cells[toCellRef(selection.startRow, col)]));
  }

  // Dynamic-array spill cells often lose their own format. Use nearby headers and
  // same-column date samples to identify the column before touching serial numbers.
  for (let row = Math.max(1, selection.startRow - 3); row < selection.startRow; row += 1) {
    if (cellLooksLikeDateHeader(sheet.cells[toCellRef(row, col)])) return true;
  }

  for (let row = selection.startRow; row <= selection.endRow; row += 1) {
    if (cellHasDateColumnSignal(sheet.cells[toCellRef(row, col)])) return true;
  }

  return false;
}

export function resolveExcelCellNumberFormat(cell: ExcelCellSnapshot | null | undefined) {
  const explicit = typeof cell?.numberFormat === "string" ? cell.numberFormat.trim() : "";
  if (explicit) return explicit;
  if (typeof cell?.value !== "number" || !Number.isFinite(cell.value)) return "";
  if (cell.value < 1 || cell.value > 100000) return "";
  const display = cell.display === null || cell.display === undefined ? "" : String(cell.display).trim();
  if (!display || display === String(cell.value)) return "";
  return excelDateDisplayPattern.test(display) ? "yyyy-mm-dd" : "";
}

export function getExcelCellErrorInfo(cell: ExcelCellSnapshot | null | undefined): ExcelCellErrorInfo | null {
  const candidates = [cell?.display, cell?.value]
    .map((value) => (value === null || value === undefined ? "" : String(value).trim().toUpperCase()))
    .filter(Boolean);
  for (const code of Object.keys(excelErrorInfo)) {
    if (candidates.some((value) => value === code || value.startsWith(`${code} `))) {
      return excelErrorInfo[code];
    }
  }
  return null;
}

export function findWorkbookErrorCells(
  workbook: ExcelWorkbookSnapshot | null | undefined,
  limit = 12,
): ExcelWorkbookErrorCell[] {
  const errors: ExcelWorkbookErrorCell[] = [];
  for (const sheet of workbook?.sheets || []) {
    const entries = Object.entries(sheet.cells || {}).sort(([left], [right]) => {
      const leftRef = parseCellRef(left);
      const rightRef = parseCellRef(right);
      if (!leftRef || !rightRef) return left.localeCompare(right);
      return leftRef.row - rightRef.row || leftRef.col - rightRef.col;
    });
    for (const [cellRef, cell] of entries) {
      const error = getExcelCellErrorInfo(cell);
      if (!error) continue;
      errors.push({ ...error, sheetName: sheet.name, cellRef });
      if (errors.length >= limit) return errors;
    }
  }
  return errors;
}

export function convertWorkbookSelectionToDateFormat(
  workbook: ExcelWorkbookSnapshot | null | undefined,
  selection: ExcelRangeSelection | null | undefined,
) {
  const next = cloneWorkbookSnapshot(workbook);
  let changed = 0;
  if (!selection) {
    return { workbook: next, changed };
  }
  const sheet = getSheetSnapshot(next, selection.sheetName);
  if (!sheet) {
    return { workbook: next, changed };
  }

  const dateColumns = new Set<number>();
  for (let col = selection.startCol; col <= selection.endCol; col += 1) {
    if (shouldConvertSelectionColumnToDate(sheet, selection, col)) {
      dateColumns.add(col);
    }
  }

  for (let row = selection.startRow; row <= selection.endRow; row += 1) {
    for (let col = selection.startCol; col <= selection.endCol; col += 1) {
      if (!dateColumns.has(col)) continue;
      const cellRef = toCellRef(row, col);
      const cell = sheet.cells[cellRef];
      const dateValue = parseExcelDateCell(cell);
      if (!dateValue) continue;
      sheet.cells[cellRef] = {
        value: dateValue.serial,
        formula: null,
        display: dateValue.display,
        numberFormat: "yyyy-mm-dd",
      };
      changed += 1;
    }
  }

  return { workbook: next, changed };
}

export function updateWorkbookCell(workbook: ExcelWorkbookSnapshot, sheetName: string, cellRef: string, rawValue: string) {
  const next = cloneWorkbookSnapshot(workbook);
  const sheet = getSheetSnapshot(next, sheetName);
  if (!sheet) return next;
  const value = rawValue ?? "";
  if (!value.trim()) {
    delete sheet.cells[cellRef];
    return next;
  }
  if (value.startsWith("=")) {
    const formula = normalizeExcelFormulaText(value);
    sheet.cells[cellRef] = {
      value,
      formula,
      display: formula ? `=${formula}` : value,
    };
    return next;
  }
  sheet.cells[cellRef] = {
    value,
    formula: null,
    display: value,
  };
  return next;
}

export function clearWorkbookRange(workbook: ExcelWorkbookSnapshot, selection: ExcelRangeSelection | null | undefined) {
  const next = cloneWorkbookSnapshot(workbook);
  if (!selection) return next;
  const sheet = getSheetSnapshot(next, selection.sheetName);
  if (!sheet) return next;
  for (let row = selection.startRow; row <= selection.endRow; row += 1) {
    for (let col = selection.startCol; col <= selection.endCol; col += 1) {
      delete sheet.cells[toCellRef(row, col)];
    }
  }
  return next;
}

function buildDynamicArrayHydrationIndex(options: BuildWorkbookWithAnswerSnapshotOptions) {
  const spillCells = new Map<string, Set<string>>();
  const anchorCells = new Map<string, Set<string>>();

  (options.dynamicArrayRules || []).forEach((rule) => {
    const sheetName = String(rule.sheet || "").trim();
    const anchor = parseCellRef(String(rule.anchorCell || ""));
    const spill = parseRangeRef(String(rule.spillRange || ""));
    if (!sheetName || !anchor || !spill) return;

    const spillSet = spillCells.get(sheetName) || new Set<string>();
    const anchorSet = anchorCells.get(sheetName) || new Set<string>();
    for (let row = spill.startRow; row <= spill.endRow; row += 1) {
      for (let col = spill.startCol; col <= spill.endCol; col += 1) {
        spillSet.add(toCellRef(row, col));
      }
    }
    anchorSet.add(toCellRef(anchor.row, anchor.col));
    spillCells.set(sheetName, spillSet);
    anchorCells.set(sheetName, anchorSet);
  });

  return { spillCells, anchorCells };
}

function isDynamicArraySpillChild(
  index: ReturnType<typeof buildDynamicArrayHydrationIndex>,
  sheetName: string,
  cellRef: string,
) {
  return Boolean(index.spillCells.get(sheetName)?.has(cellRef))
    && !index.anchorCells.get(sheetName)?.has(cellRef);
}

export function clearDynamicArraySpillChildren(
  workbook: ExcelWorkbookSnapshot | null | undefined,
  dynamicArrayRules: DynamicArrayHydrationRule[] | null | undefined,
) {
  const next = cloneWorkbookSnapshot(workbook);
  const dynamicArrayHydrationIndex = buildDynamicArrayHydrationIndex({
    dynamicArrayRules: dynamicArrayRules || [],
  });
  next.sheets.forEach((sheet) => {
    const spillCells = dynamicArrayHydrationIndex.spillCells.get(sheet.name);
    if (!spillCells) return;
    spillCells.forEach((cellRef) => {
      if (!isDynamicArraySpillChild(dynamicArrayHydrationIndex, sheet.name, cellRef)) return;
      delete sheet.cells[cellRef];
    });
  });
  return next;
}

export function buildWorkbookWithAnswerSnapshot(
  templateWorkbook: ExcelWorkbookSnapshot | null | undefined,
  sheetName: string | null | undefined,
  rangeRef: string | null | undefined,
  answerSnapshotJson: string | null | undefined,
  options: BuildWorkbookWithAnswerSnapshotOptions = {},
) {
  const next = clearDynamicArraySpillChildren(templateWorkbook, options.dynamicArrayRules);
  if (!sheetName || !rangeRef || !answerSnapshotJson) {
    return next;
  }
  const sheet = getSheetSnapshot(next, sheetName);
  const range = parseRangeRef(rangeRef);
  if (!sheet || !range) {
    return next;
  }
  let answerSnapshot: ExcelAnswerSnapshot | null = null;
  try {
    answerSnapshot = JSON.parse(answerSnapshotJson) as ExcelAnswerSnapshot;
  } catch {
    return next;
  }
  const dynamicArrayHydrationIndex = buildDynamicArrayHydrationIndex(options);
  for (let rowOffset = 0; rowOffset <= range.endRow - range.startRow; rowOffset += 1) {
    for (let colOffset = 0; colOffset <= range.endCol - range.startCol; colOffset += 1) {
      const cellRef = toCellRef(range.startRow + rowOffset, range.startCol + colOffset);
      if (isDynamicArraySpillChild(dynamicArrayHydrationIndex, sheetName, cellRef)) {
        delete sheet.cells[cellRef];
        continue;
      }
      const formula = normalizeExcelFormulaText(answerSnapshot?.formulas?.[rowOffset]?.[colOffset] || "");
      const value = answerSnapshot?.values?.[rowOffset]?.[colOffset] ?? "";
      const display = answerSnapshot?.displays?.[rowOffset]?.[colOffset];
      const numberFormat = answerSnapshot?.numberFormats?.[rowOffset]?.[colOffset];
      if (!formula && (value === null || value === undefined || String(value).trim() === "")) {
        delete sheet.cells[cellRef];
        continue;
      }
      sheet.cells[cellRef] = formula
        ? { value, formula, display: `=${formula}`, numberFormat: numberFormat || null }
        : {
          value,
          formula: null,
          display: display || (value === null || value === undefined ? "" : String(value)),
          numberFormat: numberFormat || null,
        };
    }
  }
  return next;
}

export function extractRangeAnswerSnapshot(
  workbook: ExcelWorkbookSnapshot | null | undefined,
  sheetName: string | null | undefined,
  rangeRef: string | null | undefined,
): ExcelAnswerSnapshot {
  const sheet = getSheetSnapshot(workbook, sheetName);
  const range = rangeRef ? parseRangeRef(rangeRef) : null;
  if (!sheet || !range) {
    return { values: [], formulas: [] };
  }

  const values: unknown[][] = [];
  const formulas: string[][] = [];
  const displays: string[][] = [];
  const numberFormats: string[][] = [];

  for (let row = range.startRow; row <= range.endRow; row += 1) {
    const valueRow: unknown[] = [];
    const formulaRow: string[] = [];
    const displayRow: string[] = [];
    const numberFormatRow: string[] = [];
    for (let col = range.startCol; col <= range.endCol; col += 1) {
      const cell = getCellSnapshot(sheet, toCellRef(row, col));
      valueRow.push(cell?.value ?? "");
      formulaRow.push(normalizeExcelFormulaText(cell?.formula));
      displayRow.push(cell ? getCellDisplayValue(cell) : "");
      numberFormatRow.push(resolveExcelCellNumberFormat(cell));
    }
    values.push(valueRow);
    formulas.push(formulaRow);
    displays.push(displayRow);
    numberFormats.push(numberFormatRow);
  }

  return { values, formulas, displays, numberFormats };
}

export function extractDateAwareRangeAnswerSnapshot(
  workbook: ExcelWorkbookSnapshot | null | undefined,
  sheetName: string | null | undefined,
  rangeRef: string | null | undefined,
): ExcelAnswerSnapshot {
  const range = parseRangeRef(rangeRef);
  if (!sheetName || !range) {
    return extractRangeAnswerSnapshot(workbook, sheetName, rangeRef);
  }
  const selection = normalizeSelection(
    sheetName,
    range.startRow,
    range.startCol,
    range.endRow,
    range.endCol,
  );
  const normalized = convertWorkbookSelectionToDateFormat(workbook, selection);
  return extractRangeAnswerSnapshot(
    normalized.changed > 0 ? normalized.workbook : workbook,
    sheetName,
    rangeRef,
  );
}

function normalizeAnswerSnapshotRows(snapshot: ExcelAnswerSnapshot): ExcelAnswerSnapshot {
  const rowCount = Math.max(snapshot.values?.length || 0, snapshot.formulas?.length || 0);
  const values: unknown[][] = [];
  const formulas: string[][] = [];
  const displays: string[][] = [];
  const numberFormats: string[][] = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const valueRow = snapshot.values?.[rowIndex] || [];
    const formulaRow = snapshot.formulas?.[rowIndex] || [];
    const displayRow = snapshot.displays?.[rowIndex] || [];
    const numberFormatRow = snapshot.numberFormats?.[rowIndex] || [];
    const colCount = Math.max(valueRow.length, formulaRow.length, displayRow.length, numberFormatRow.length);
    values.push(Array.from({ length: colCount }, (_, colIndex) => valueRow[colIndex] ?? ""));
    formulas.push(Array.from({ length: colCount }, (_, colIndex) => normalizeExcelFormulaText(formulaRow[colIndex])));
    displays.push(Array.from({ length: colCount }, (_, colIndex) => displayRow[colIndex] ?? ""));
    numberFormats.push(Array.from({ length: colCount }, (_, colIndex) => numberFormatRow[colIndex] ?? ""));
  }

  return { values, formulas, displays, numberFormats };
}

export function extractStoredAnswerSnapshot(
  answerSnapshotJson: string | null | undefined,
  sheetName: string | null | undefined,
  rangeRef: string | null | undefined,
): ExcelAnswerSnapshot {
  if (!answerSnapshotJson) return { values: [], formulas: [] };
  try {
    const parsed = JSON.parse(answerSnapshotJson) as ExcelAnswerSnapshot | ExcelWorkbookSnapshot;
    if (parsed && Array.isArray((parsed as ExcelAnswerSnapshot).values)) {
      return normalizeAnswerSnapshotRows(parsed as ExcelAnswerSnapshot);
    }
    if (parsed && Array.isArray((parsed as ExcelWorkbookSnapshot).sheets)) {
      return extractDateAwareRangeAnswerSnapshot(parsed as ExcelWorkbookSnapshot, sheetName, rangeRef);
    }
  } catch {
    return { values: [], formulas: [] };
  }
  return { values: [], formulas: [] };
}

export function formatAnswerPreviewCellDisplay(
  value: unknown,
  formula: string | null | undefined,
  display?: string | null,
) {
  const normalizedFormula = normalizeExcelFormulaText(formula);
  if (normalizedFormula) return `=${normalizedFormula}`;
  if (display !== null && display !== undefined && String(display).trim()) return String(display);
  if (value === null || value === undefined) return "";
  return String(value);
}

export function findMissingFormulaCellRefs(
  answerSnapshot: ExcelAnswerSnapshot | null | undefined,
  rangeRef: string | null | undefined,
) {
  const range = rangeRef ? parseRangeRef(rangeRef) : null;
  if (!answerSnapshot || !range) return [];

  const missingRefs: string[] = [];
  for (let rowOffset = 0; rowOffset <= range.endRow - range.startRow; rowOffset += 1) {
    for (let colOffset = 0; colOffset <= range.endCol - range.startCol; colOffset += 1) {
      const value = answerSnapshot.values?.[rowOffset]?.[colOffset];
      const formula = answerSnapshot.formulas?.[rowOffset]?.[colOffset];
      const hasValue = value !== null && value !== undefined && String(value).trim().length > 0;
      const hasFormulaValue = normalizeExcelFormulaText(formula).length > 0;
      if (hasValue && !hasFormulaValue) {
        missingRefs.push(toCellRef(range.startRow + rowOffset, range.startCol + colOffset));
      }
    }
  }
  return missingRefs;
}

export function isCellInSelection(row: number, col: number, selection: ExcelRangeSelection | null | undefined) {
  return !!selection
    && row >= selection.startRow
    && row <= selection.endRow
    && col >= selection.startCol
    && col <= selection.endCol;
}

export function normalizeSelection(sheetName: string, startRow: number, startCol: number, endRow: number, endCol: number): ExcelRangeSelection {
  return {
    sheetName,
    startRow: Math.min(startRow, endRow),
    startCol: Math.min(startCol, endCol),
    endRow: Math.max(startRow, endRow),
    endCol: Math.max(startCol, endCol),
  };
}

export function resolveSheetBounds(sheet: ExcelSheetSnapshot | null | undefined, selection?: ExcelRangeSelection | null) {
  const cellRefs = Object.keys(sheet?.cells || {}).map((key) => parseCellRef(key)).filter(Boolean) as Array<{ row: number; col: number }>;
  const maxRowFromCells = cellRefs.reduce((max, item) => Math.max(max, item.row), 1);
  const maxColFromCells = cellRefs.reduce((max, item) => Math.max(max, item.col), 1);
  return {
    rowCount: Math.max(sheet?.rowCount || 0, selection?.endRow || 0, maxRowFromCells, 12),
    columnCount: Math.max(sheet?.columnCount || 0, selection?.endCol || 0, maxColFromCells, 8),
  };
}

type ParsedCellSnapshot = {
  ref: string;
  row: number;
  col: number;
  cell: ExcelCellSnapshot;
};

type CellBounds = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

type FormulaAnswerRegionCandidate = FormulaAnswerRegion & {
  sheetIndex: number;
  startRow: number;
  startCol: number;
};

const dynamicArrayFormulaPattern = /\b(?:BYCOL|BYROW|CHOOSECOLS|CHOOSEROWS|DROP|EXPAND|FILTER|HSTACK|MAKEARRAY|MAP|RANDARRAY|REDUCE|SCAN|SEQUENCE|SORT|SORTBY|TAKE|TOCOL|TOROW|UNIQUE|VSTACK|WRAPCOLS|WRAPROWS)\s*\(/i;

function hasFormula(cell: ExcelCellSnapshot | undefined) {
  return normalizeExcelFormulaText(cell?.formula).length > 0;
}

function hasCellContent(cell: ExcelCellSnapshot | undefined) {
  if (!cell) return false;
  if (hasFormula(cell)) return true;
  if (cell.display !== null && cell.display !== undefined && String(cell.display).trim().length > 0) return true;
  if (cell.value === null || cell.value === undefined) return false;
  return String(cell.value).trim().length > 0;
}

function toRangeRefFromBounds(bounds: CellBounds) {
  const start = toCellRef(bounds.startRow, bounds.startCol);
  const end = toCellRef(bounds.endRow, bounds.endCol);
  return start === end ? start : `${start}:${end}`;
}

function getBoundsArea(bounds: CellBounds) {
  return Math.max(0, bounds.endRow - bounds.startRow + 1) * Math.max(0, bounds.endCol - bounds.startCol + 1);
}

function parseSheetCells(sheet: ExcelSheetSnapshot | null | undefined) {
  const cells = new Map<string, ParsedCellSnapshot>();
  Object.entries(sheet?.cells || {}).forEach(([rawRef, cell]) => {
    const parsedRef = parseCellRef(rawRef);
    if (!parsedRef || parsedRef.row < 1 || parsedRef.col < 1) return;
    const ref = toCellRef(parsedRef.row, parsedRef.col);
    cells.set(ref, { ref, row: parsedRef.row, col: parsedRef.col, cell });
  });
  return cells;
}

function expandSingleFormulaSpill(
  cells: Map<string, ParsedCellSnapshot>,
  anchor: ParsedCellSnapshot,
  formulaRefs: Set<string>,
) {
  const anchorRef = toCellRef(anchor.row, anchor.col);
  const occupiedRefs = new Set<string>();
  cells.forEach((item, ref) => {
    if (item.row < anchor.row || item.col < anchor.col) return;
    if (!hasCellContent(item.cell)) return;
    if (formulaRefs.has(ref) && ref !== anchorRef) return;
    occupiedRefs.add(ref);
  });
  if (!occupiedRefs.has(anchorRef)) {
    return {
      startRow: anchor.row,
      startCol: anchor.col,
      endRow: anchor.row,
      endCol: anchor.col,
    };
  }

  const visited = new Set<string>([anchorRef]);
  const stack = [anchor];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let endRow = anchor.row;
  let endCol = anchor.col;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    endRow = Math.max(endRow, current.row);
    endCol = Math.max(endCol, current.col);
    directions.forEach(([rowOffset, colOffset]) => {
      const row = current.row + rowOffset;
      const col = current.col + colOffset;
      if (row < anchor.row || col < anchor.col) return;
      const nextRef = toCellRef(row, col);
      if (visited.has(nextRef) || !occupiedRefs.has(nextRef)) return;
      const next = cells.get(nextRef);
      if (!next) return;
      visited.add(nextRef);
      stack.push(next);
    });
  }

  return {
    startRow: anchor.row,
    startCol: anchor.col,
    endRow,
    endCol,
  };
}

function compareFormulaCandidates(mode: "simple" | "dynamic_array") {
  return (left: FormulaAnswerRegionCandidate, right: FormulaAnswerRegionCandidate) => {
    const scoreDiff = mode === "dynamic_array"
      ? right.cellCount - left.cellCount || right.formulaCount - left.formulaCount
      : right.formulaCount - left.formulaCount || right.cellCount - left.cellCount;
    return scoreDiff
      || left.sheetIndex - right.sheetIndex
      || left.startRow - right.startRow
      || left.startCol - right.startCol;
  };
}

function isDynamicArrayFormula(formula: string | null | undefined) {
  return dynamicArrayFormulaPattern.test(normalizeExcelFormulaText(formula));
}

export function clearInferredDynamicArraySpillChildren(workbook: ExcelWorkbookSnapshot | null | undefined) {
  const next = cloneWorkbookSnapshot(workbook);
  next.sheets.forEach((sheet) => {
    const cells = parseSheetCells(sheet);
    const formulaCells = Array.from(cells.values())
      .filter((item) => hasFormula(item.cell))
      .sort((left, right) => left.row - right.row || left.col - right.col);
    const formulaRefs = new Set(formulaCells.map((item) => item.ref));

    formulaCells.forEach((anchor) => {
      if (!isDynamicArrayFormula(anchor.cell.formula)) return;
      const spillBounds = expandSingleFormulaSpill(cells, anchor, formulaRefs);
      for (let row = spillBounds.startRow; row <= spillBounds.endRow; row += 1) {
        for (let col = spillBounds.startCol; col <= spillBounds.endCol; col += 1) {
          const cellRef = toCellRef(row, col);
          if (cellRef === anchor.ref) continue;
          const cell = sheet.cells[cellRef];
          if (!cell || hasFormula(cell)) continue;
          delete sheet.cells[cellRef];
        }
      }
    });
  });
  return next;
}

export function detectFormulaAnswerRegion(
  workbook: ExcelWorkbookSnapshot | null | undefined,
  options: { mode?: "simple" | "dynamic_array" } = {},
): FormulaAnswerRegion | null {
  const mode = options.mode === "dynamic_array" ? "dynamic_array" : "simple";
  const candidates: FormulaAnswerRegionCandidate[] = [];

  (workbook?.sheets || []).forEach((sheet, sheetIndex) => {
    const cells = parseSheetCells(sheet);
    const formulaCells = Array.from(cells.values())
      .filter((item) => hasFormula(item.cell))
      .sort((left, right) => left.row - right.row || left.col - right.col);
    const formulaRefs = new Set(formulaCells.map((item) => item.ref));
    const visited = new Set<string>();
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    formulaCells.forEach((formulaCell) => {
      if (visited.has(formulaCell.ref)) return;
      const component: ParsedCellSnapshot[] = [];
      const stack = [formulaCell];
      visited.add(formulaCell.ref);

      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;
        component.push(current);
        directions.forEach(([rowOffset, colOffset]) => {
          const nextRef = toCellRef(current.row + rowOffset, current.col + colOffset);
          if (!formulaRefs.has(nextRef) || visited.has(nextRef)) return;
          const next = cells.get(nextRef);
          if (!next) return;
          visited.add(nextRef);
          stack.push(next);
        });
      }

      const bounds = component.reduce<CellBounds>((current, item) => ({
        startRow: Math.min(current.startRow, item.row),
        startCol: Math.min(current.startCol, item.col),
        endRow: Math.max(current.endRow, item.row),
        endCol: Math.max(current.endCol, item.col),
      }), {
        startRow: formulaCell.row,
        startCol: formulaCell.col,
        endRow: formulaCell.row,
        endCol: formulaCell.col,
      });
      const anchor = component.reduce((current, item) =>
        item.row < current.row || (item.row === current.row && item.col < current.col) ? item : current,
      component[0]);
      const dynamicBounds = component.length === 1
        ? expandSingleFormulaSpill(cells, anchor, formulaRefs)
        : bounds;

      candidates.push({
        sheetName: sheet.name,
        rangeRef: toRangeRefFromBounds(bounds),
        anchorCell: toCellRef(anchor.row, anchor.col),
        dynamicSpillRange: toRangeRefFromBounds(dynamicBounds),
        formulaCount: component.length,
        cellCount: getBoundsArea(dynamicBounds),
        sheetIndex,
        startRow: bounds.startRow,
        startCol: bounds.startCol,
      });
    });
  });

  const [best] = candidates.sort(compareFormulaCandidates(mode));
  if (!best) return null;
  const { sheetIndex: _sheetIndex, startRow: _startRow, startCol: _startCol, ...result } = best;
  return result;
}

export function parseSheetAndRange(a1Notation: string) {
  const text = a1Notation.trim();
  const bangIndex = text.lastIndexOf("!");
  if (bangIndex < 0) {
    return { sheetName: "", rangeRef: text };
  }
  const rawSheetName = text.slice(0, bangIndex).replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'");
  return {
    sheetName: rawSheetName,
    rangeRef: text.slice(bangIndex + 1),
  };
}

function normalizeScalarValue(value: unknown) {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "string") return value ?? "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return value;
}

function flattenFormulaArgs(args: unknown[]): unknown[] {
  return args.flatMap((item) => Array.isArray(item) ? flattenFormulaArgs(item) : [item]);
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return 0;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.trim().length > 0 && value.trim().toLowerCase() !== "false" && value !== "0";
  return Boolean(value);
}

function formatEvaluatedValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return String(value);
}

function buildFormulaFunctions() {
  return {
    SUM: (...args: unknown[]) => flattenFormulaArgs(args).reduce<number>((sum, item) => sum + toNumber(item), 0),
    AVERAGE: (...args: unknown[]) => {
      const values = flattenFormulaArgs(args).map(toNumber);
      return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
    },
    MAX: (...args: unknown[]) => {
      const values = flattenFormulaArgs(args).map(toNumber);
      return values.length ? Math.max(...values) : 0;
    },
    MIN: (...args: unknown[]) => {
      const values = flattenFormulaArgs(args).map(toNumber);
      return values.length ? Math.min(...values) : 0;
    },
    COUNT: (...args: unknown[]) => flattenFormulaArgs(args).filter((item) => item !== "" && item !== null && item !== undefined).length,
    ROUND: (value: unknown, digits: unknown = 0) => {
      const factor = Math.pow(10, toNumber(digits));
      return Math.round(toNumber(value) * factor) / factor;
    },
    ABS: (value: unknown) => Math.abs(toNumber(value)),
    IF: (condition: unknown, truthy: unknown, falsy: unknown) => (toBoolean(condition) ? truthy : falsy),
    AND: (...args: unknown[]) => flattenFormulaArgs(args).every(toBoolean),
    OR: (...args: unknown[]) => flattenFormulaArgs(args).some(toBoolean),
    NOT: (value: unknown) => !toBoolean(value),
    CONCAT: (...args: unknown[]) => flattenFormulaArgs(args).map((item) => item ?? "").join(""),
  };
}

function transformFormulaExpression(formula: string) {
  let expression = normalizeExcelFormulaText(formula);
  const stringLiterals: string[] = [];
  expression = expression.replace(/"([^"]*)"/g, (_, content: string) => {
    const token = `__STR_${stringLiterals.length}__`;
    stringLiterals.push(content);
    return token;
  });

  const ranges: string[] = [];
  expression = expression.replace(/\b([A-Z]{1,3}\d+:[A-Z]{1,3}\d+)\b/g, (_, content: string) => {
    const token = `__RANGE_${ranges.length}__`;
    ranges.push(content);
    return token;
  });

  expression = expression.replace(/\b([A-Z]{1,3}\d+)\b/g, (_, ref: string) => `__C("${ref}")`);
  expression = expression.replace(/\b(SUM|AVERAGE|MAX|MIN|COUNT|ROUND|ABS|IF|AND|OR|NOT|CONCAT)\s*\(/gi, (_, fn: string) => `__F.${fn.toUpperCase()}(`);
  expression = expression.replace(/<>/g, "!=");
  expression = expression.replace(/(?<![<>=])=(?!=)/g, "==");

  ranges.forEach((range, index) => {
    expression = expression.replace(`__RANGE_${index}__`, `__R("${range}")`);
  });
  stringLiterals.forEach((literal, index) => {
    expression = expression.replace(`__STR_${index}__`, JSON.stringify(literal));
  });
  return expression;
}

export function evaluateWorkbookCell(
  workbook: ExcelWorkbookSnapshot | null | undefined,
  sheetName: string,
  cellRef: string,
  trail: Set<string> = new Set(),
): unknown {
  const key = `${sheetName}!${cellRef}`;
  if (trail.has(key)) return "#CYCLE!";
  const sheet = getSheetSnapshot(workbook, sheetName);
  const cell = getCellSnapshot(sheet, cellRef);
  if (!cell) return "";
  if (!cell.formula) {
    return normalizeScalarValue(cell.value);
  }

  const nextTrail = new Set(trail);
  nextTrail.add(key);
  try {
    const __C = (ref: string) => evaluateWorkbookCell(workbook, sheetName, ref, nextTrail);
    const __R = (rangeRef: string) => {
      const range = parseRangeRef(rangeRef);
      if (!range) return [];
      const values: unknown[] = [];
      for (let row = range.startRow; row <= range.endRow; row += 1) {
        for (let col = range.startCol; col <= range.endCol; col += 1) {
          values.push(evaluateWorkbookCell(workbook, sheetName, toCellRef(row, col), nextTrail));
        }
      }
      return values;
    };
    const __F = buildFormulaFunctions();
    const expression = transformFormulaExpression(cell.formula);
    return Function("__C", "__R", "__F", `return (${expression});`)(__C, __R, __F);
  } catch {
    return "#ERROR!";
  }
}

export function getComputedCellDisplayValue(
  workbook: ExcelWorkbookSnapshot | null | undefined,
  sheetName: string,
  cellRef: string,
) {
  const sheet = getSheetSnapshot(workbook, sheetName);
  const cell = getCellSnapshot(sheet, cellRef);
  if (!cell) return "";
  if (!cell.formula) {
    return getCellDisplayValue(cell);
  }
  return formatEvaluatedValue(evaluateWorkbookCell(workbook, sheetName, cellRef));
}
