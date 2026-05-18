import { ClipboardList } from "lucide-react";
import { useMemo } from "react";
import {
  getSheetSnapshot,
  selectionToRangeRef,
  toCellRef,
  updateWorkbookCell,
  type ExcelRangeSelection,
  type ExcelWorkbookSnapshot,
} from "../lib/excel";
import { buildFastWorkbookGridRows } from "../lib/fast-workbook-editor";

type FastWorkbookFallbackEditorProps = {
  workbook: ExcelWorkbookSnapshot;
  onWorkbookChange: (next: ExcelWorkbookSnapshot) => void;
  selectedSheetName: string;
  onSelectedSheetNameChange: (sheetName: string) => void;
  editableRange?: ExcelRangeSelection | null;
};

export function FastWorkbookFallbackEditor({
  workbook,
  onWorkbookChange,
  selectedSheetName,
  onSelectedSheetNameChange,
  editableRange = null,
}: FastWorkbookFallbackEditorProps) {
  const activeSheetName = selectedSheetName || workbook.sheets[0]?.name || "";
  const activeSheet = getSheetSnapshot(workbook, activeSheetName);
  const rows = useMemo(
    () => buildFastWorkbookGridRows(workbook, activeSheetName, editableRange),
    [workbook, activeSheetName, editableRange],
  );

  const updateCell = (cellRef: string, value: string) => {
    onWorkbookChange(updateWorkbookCell(workbook, activeSheetName, cellRef, value));
  };

  const pasteCells = (startRow: number, startCol: number, text: string) => {
    const lines = text.replace(/\r/g, "").split("\n").filter((line, index, items) => line || index < items.length - 1);
    if (lines.length === 0) return;
    let next = workbook;
    lines.forEach((line, rowOffset) => {
      line.split("\t").forEach((value, colOffset) => {
        const row = startRow + rowOffset;
        const col = startCol + colOffset;
        if (!isEditableCell(row, col, editableRange)) return;
        next = updateWorkbookCell(next, activeSheetName, toCellRef(row, col), value);
      });
    });
    onWorkbookChange(next);
  };

  if (!activeSheet || rows.length === 0) {
    return (
      <div className="flex h-[640px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        正在加载题目模板...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black text-emerald-900">
          <ClipboardList size={16} />
          快速编辑模式
          <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700">
            完整编辑器加载中
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {workbook.sheets.length > 1 ? (
            <select
              value={activeSheetName}
              onChange={(event) => onSelectedSheetNameChange(event.target.value)}
              className="h-9 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
            >
              {workbook.sheets.map((sheet) => (
                <option key={sheet.name} value={sheet.name}>{sheet.name}</option>
              ))}
            </select>
          ) : (
            <span className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700">{activeSheetName}</span>
          )}
          {editableRange ? (
            <span className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-700">
              可编辑 {editableRange.sheetName} / {selectionToRangeRef(editableRange)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="h-[640px] max-h-[70vh] overflow-auto bg-slate-50 p-3">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-9 w-12 border border-slate-200 bg-slate-100 text-xs font-black text-slate-400" />
              {rows[0].cells.map((cell) => (
                <th key={cell.columnLabel} className="sticky top-0 z-10 h-9 min-w-28 border border-slate-200 bg-emerald-100 px-2 text-xs font-black text-emerald-800">
                  {cell.columnLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row}>
                <th className="sticky left-0 z-10 h-10 border border-slate-200 bg-slate-100 px-2 text-xs font-black text-slate-500">
                  {row.row}
                </th>
                {row.cells.map((cell) => (
                  <td
                    key={cell.ref}
                    className={`h-10 border border-slate-200 bg-white p-0 ${cell.editable ? "ring-1 ring-inset ring-emerald-200" : ""}`}
                  >
                    {cell.editable ? (
                      <input
                        aria-label={cell.ref}
                        value={cell.inputValue}
                        onChange={(event) => updateCell(cell.ref, event.target.value)}
                        onPaste={(event) => {
                          const pasted = event.clipboardData.getData("text/plain");
                          if (!pasted.includes("\t") && !pasted.includes("\n")) return;
                          event.preventDefault();
                          pasteCells(cell.row, cell.col, pasted);
                        }}
                        className="h-10 w-full min-w-28 border-0 bg-emerald-50/70 px-2 font-mono text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-400"
                      />
                    ) : (
                      <div className="h-10 min-w-28 truncate px-2 py-2 text-slate-700" title={cell.displayValue}>
                        {cell.displayValue}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isEditableCell(row: number, col: number, editableRange: ExcelRangeSelection | null | undefined) {
  if (!editableRange) return true;
  return row >= editableRange.startRow
    && row <= editableRange.endRow
    && col >= editableRange.startCol
    && col <= editableRange.endCol;
}
