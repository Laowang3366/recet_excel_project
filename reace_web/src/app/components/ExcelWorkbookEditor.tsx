import { useEffect, useMemo, useRef, useState } from "react";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import type { IWorkbookData } from "@univerjs/core";
import type { FWorkbook } from "@univerjs/preset-sheets-core";
import "@univerjs/preset-sheets-core/lib/index.css";
import { AlertTriangle, Bot, CalendarDays, Copy, Expand, Minimize2 } from "lucide-react";
import {
  ExcelRangeSelection,
  ExcelWorkbookSnapshot,
  convertWorkbookSelectionToDateFormat,
  clearInferredDynamicArraySpillChildren,
  findWorkbookErrorCells,
  getCellSnapshot,
  getExcelCellErrorInfo,
  getSheetSnapshot,
  normalizeExcelFormulaText,
  normalizeSelection,
  parseRangeRef,
  parseSheetAndRange,
  resolveExcelCellNumberFormat,
  selectionToRangeRef,
  toCellRef,
  type ExcelCellErrorInfo,
  type ExcelWorkbookErrorCell,
} from "../lib/excel";
import { captureUniverWorkbookSnapshot, type UniverWorkbookSnapshotOptions } from "../lib/univer-workbook";
import { getStoredUser } from "../lib/session-store";
import { AssistantWidget } from "./layout/AssistantWidget";

type ExcelWorkbookEditorProps = {
  workbook: ExcelWorkbookSnapshot;
  onWorkbookChange?: (next: ExcelWorkbookSnapshot) => void;
  selectedSheetName: string;
  onSelectedSheetNameChange: (sheetName: string) => void;
  selection?: ExcelRangeSelection | null;
  onSelectionChange?: (selection: ExcelRangeSelection | null) => void;
  editableRange?: ExcelRangeSelection | null;
  restrictEditingToRange?: boolean;
  selectionEnabled?: boolean;
  focusRange?: ExcelRangeSelection | null;
  focusRequestVersion?: number;
  requestFullscreenVersion?: number;
  showConfirmSelectionButton?: boolean;
  confirmSelectionLabel?: string;
  onConfirmSelection?: () => void;
  onSnapshotCaptureReady?: (capture: (() => ExcelWorkbookSnapshot | null) | null) => void;
  className?: string;
  viewportClassName?: string;
};

type UniverBinding = {
  univerAPI: {
    createWorkbook: (data: Partial<IWorkbookData>) => FWorkbook;
    getFormula?: () => {
      moveFormulaRefOffset?: (formula: string, colOffset: number, rowOffset: number) => string;
    };
    dispose: () => void;
  };
  workbook: FWorkbook;
  captureSnapshot: () => ExcelWorkbookSnapshot;
  syncWorkbookSnapshot: () => void;
  disposables: Array<{ dispose: () => void }>;
};

type EditorCellInspector = {
  sheetName: string;
  cellRef: string;
  display: string;
  formula: string;
  error: ExcelCellErrorInfo | null;
  workbookErrors: ExcelWorkbookErrorCell[];
};

function isSameSelection(
  left: ExcelRangeSelection | null | undefined,
  right: ExcelRangeSelection | null | undefined,
) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.sheetName === right.sheetName
    && left.startRow === right.startRow
    && left.startCol === right.startCol
    && left.endRow === right.endRow
    && left.endCol === right.endCol;
}

function createWorkbookId() {
  return "excel-practice-workbook";
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function workbookSnapshotToUniverData(workbook: ExcelWorkbookSnapshot): Partial<IWorkbookData> {
  return {
    id: createWorkbookId(),
    name: "ExcelPractice",
    appVersion: "0.20.0",
    locale: LocaleType.ZH_CN,
    styles: {},
  };
}

function workbookCellSnapshotToUniverValue(cell: ExcelWorkbookSnapshot["sheets"][number]["cells"][string]) {
  const normalizedFormula = normalizeExcelFormulaText(cell?.formula);
  const formula = normalizedFormula ? `=${normalizedFormula}` : "";
  if (formula) return formula;
  const value = cell?.value;
  const numberFormat = resolveExcelCellNumberFormat(cell);
  if (numberFormat && typeof value === "number") {
    return { v: value, s: { n: { pattern: numberFormat } } };
  }
  return value;
}

function resolveEditorCellInspector(
  workbook: ExcelWorkbookSnapshot | null | undefined,
  selection: ExcelRangeSelection | null | undefined,
  fallbackSheetName: string,
): EditorCellInspector {
  const sheetName = selection?.sheetName || fallbackSheetName || workbook?.sheets?.[0]?.name || "";
  const sheet = getSheetSnapshot(workbook, sheetName);
  const cellRef = selection ? toCellRef(selection.startRow, selection.startCol) : "A1";
  const cell = getCellSnapshot(sheet, cellRef);
  const formula = normalizeExcelFormulaText(cell?.formula);
  const display = cell?.display !== null && cell?.display !== undefined
    ? String(cell.display)
    : cell?.value !== null && cell?.value !== undefined
      ? String(cell.value)
      : "";
  return {
    sheetName,
    cellRef,
    display,
    formula,
    error: getExcelCellErrorInfo(cell),
    workbookErrors: findWorkbookErrorCells(workbook, 8),
  };
}

function applyWorkbookSnapshotToUniver(workbookFacade: FWorkbook, snapshot: ExcelWorkbookSnapshot) {
  const hydratedSnapshot = clearInferredDynamicArraySpillChildren(snapshot);
  const targetSheets = hydratedSnapshot.sheets || [];
  if (targetSheets.length === 0) {
    return;
  }

  const existingSheets = workbookFacade.getSheets();
  const primarySheet = existingSheets[0] || workbookFacade.getActiveSheet();
  primarySheet.setName(targetSheets[0].name);

  for (let index = existingSheets.length; index < targetSheets.length; index += 1) {
    const target = targetSheets[index];
    workbookFacade.insertSheet(target.name, {
      sheet: {
        rowCount: Math.max(target.rowCount || 0, 200),
        columnCount: Math.max(target.columnCount || 0, 40),
      },
    });
  }

  const refreshedSheets = workbookFacade.getSheets();
  for (let index = targetSheets.length; index < refreshedSheets.length; index += 1) {
    workbookFacade.deleteSheet(refreshedSheets[index]);
  }

  targetSheets.forEach((sheetSnapshot, index) => {
    const worksheet = workbookFacade.getSheets()[index];
    if (!worksheet) return;
    if (worksheet.getSheetName() !== sheetSnapshot.name) {
      worksheet.setName(sheetSnapshot.name);
    }
    Object.entries(sheetSnapshot.cells || {}).forEach(([cellRef, cell]) => {
      const value = workbookCellSnapshotToUniverValue(cell);
      if (value === null || value === undefined || (typeof value !== "object" && String(value).trim() === "")) {
        return;
      }
      worksheet.getRange(cellRef).setValue(value as string | number | boolean);
    });
  });

  workbookFacade.setActiveSheet(workbookFacade.getSheets()[0]);
}

export function ExcelWorkbookEditor({
  workbook,
  onWorkbookChange,
  selectedSheetName,
  onSelectedSheetNameChange,
  selection = null,
  onSelectionChange,
  editableRange = null,
  restrictEditingToRange = false,
  selectionEnabled = false,
  focusRange = null,
  focusRequestVersion = 0,
  requestFullscreenVersion = 0,
  showConfirmSelectionButton = false,
  confirmSelectionLabel = "确认区域",
  onConfirmSelection,
  onSnapshotCaptureReady,
  className = "",
  viewportClassName,
}: ExcelWorkbookEditorProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bindingRef = useRef<UniverBinding | null>(null);
  const hydratingRef = useRef(false);
  const lastAppliedExternalRef = useRef("");
  const lastInternalSnapshotRef = useRef("");
  const latestSelectionRef = useRef<ExcelRangeSelection | null>(selection);
  const latestSelectedSheetNameRef = useRef(selectedSheetName);
  const latestSelectionEnabledRef = useRef(selectionEnabled);
  const latestOnSelectionChangeRef = useRef(onSelectionChange);
  const latestOnSelectedSheetNameChangeRef = useRef(onSelectedSheetNameChange);
  const latestOnWorkbookChangeRef = useRef(onWorkbookChange);
  const lastFocusedRangeKeyRef = useRef("");
  const latestEditorSnapshotRef = useRef<ExcelWorkbookSnapshot>(workbook);
  const [instanceVersion, setInstanceVersion] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [editorNotice, setEditorNotice] = useState("");
  const [cellInspector, setCellInspector] = useState<EditorCellInspector>(() =>
    resolveEditorCellInspector(workbook, selection, selectedSheetName),
  );

  const workbookKey = useMemo(() => JSON.stringify(workbook), [workbook]);

  const refreshCellInspector = (
    nextWorkbook: ExcelWorkbookSnapshot | null | undefined,
    nextSelection: ExcelRangeSelection | null | undefined = latestSelectionRef.current,
  ) => {
    setCellInspector(resolveEditorCellInspector(
      nextWorkbook,
      nextSelection,
      latestSelectedSheetNameRef.current,
    ));
  };

  useEffect(() => {
    latestSelectionRef.current = selection;
    refreshCellInspector(workbook, selection);
  }, [selection]);

  useEffect(() => {
    latestSelectedSheetNameRef.current = selectedSheetName;
    refreshCellInspector(workbook, latestSelectionRef.current);
  }, [selectedSheetName]);

  useEffect(() => {
    latestSelectionEnabledRef.current = selectionEnabled;
  }, [selectionEnabled]);

  useEffect(() => {
    latestOnSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    latestOnSelectedSheetNameChangeRef.current = onSelectedSheetNameChange;
  }, [onSelectedSheetNameChange]);

  useEffect(() => {
    latestOnWorkbookChangeRef.current = onWorkbookChange;
  }, [onWorkbookChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let disposeBinding: (() => void) | null = null;

    const mountEditor = async () => {
      const { default: UniverPresetSheetsCoreZhCN } = await import("@univerjs/preset-sheets-core/locales/zh-CN");
      if (disposed || !containerRef.current) return;

      const { univerAPI } = createUniver({
        locale: LocaleType.ZH_CN,
        locales: {
          [LocaleType.ZH_CN]: mergeLocales(UniverPresetSheetsCoreZhCN),
        },
        presets: [
          UniverSheetsCorePreset({
            container,
          }),
        ],
      });

      const univerWorkbook = univerAPI.createWorkbook(workbookSnapshotToUniverData(workbook));
      hydratingRef.current = true;
      applyWorkbookSnapshotToUniver(univerWorkbook, workbook);
      hydratingRef.current = false;
      latestEditorSnapshotRef.current = workbook;
      lastAppliedExternalRef.current = workbookKey;
      lastInternalSnapshotRef.current = workbookKey;
      const formulaEngine = univerAPI.getFormula?.();
      const snapshotOptions: UniverWorkbookSnapshotOptions = {
        moveFormulaRefOffset: formulaEngine?.moveFormulaRefOffset?.bind(formulaEngine),
      };
      const captureSnapshot = () => captureUniverWorkbookSnapshot(univerWorkbook, snapshotOptions);
      onSnapshotCaptureReady?.(captureSnapshot);

      const syncWorkbookSnapshot = () => {
        if (hydratingRef.current) return;
        const nextSnapshot = captureUniverWorkbookSnapshot(univerWorkbook, snapshotOptions);
        const nextKey = JSON.stringify(nextSnapshot);
        latestEditorSnapshotRef.current = nextSnapshot;
        lastInternalSnapshotRef.current = nextKey;
        refreshCellInspector(nextSnapshot);
        latestOnWorkbookChangeRef.current?.(nextSnapshot);
      };

      const syncSelectionState = () => {
        if (hydratingRef.current) return;
        const activeSheet = univerWorkbook.getActiveSheet();
        if (activeSheet && activeSheet.getSheetName() !== latestSelectedSheetNameRef.current) {
          latestOnSelectedSheetNameChangeRef.current?.(activeSheet.getSheetName());
        }
        const activeRange = univerWorkbook.getActiveRange();
        let nextSelection: ExcelRangeSelection | null = null;
        if (activeRange) {
          const parsed = parseSheetAndRange(activeRange.getA1Notation(true));
          const range = parseRangeRef(parsed.rangeRef);
          if (range) {
            nextSelection = normalizeSelection(
              parsed.sheetName || activeSheet?.getSheetName() || "",
              range.startRow,
              range.startCol,
              range.endRow,
              range.endCol,
            );
            if (
              latestOnSelectionChangeRef.current
              && latestSelectionEnabledRef.current
              && !isSameSelection(latestSelectionRef.current, nextSelection)
            ) {
              latestOnSelectionChangeRef.current(nextSelection);
            }
            latestSelectionRef.current = nextSelection;
          }
        }
        refreshCellInspector(latestEditorSnapshotRef.current, nextSelection);
      };

      const disposables: Array<{ dispose: () => void }> = [
        univerWorkbook.onCommandExecuted(() => {
          syncWorkbookSnapshot();
          syncSelectionState();
        }),
        univerWorkbook.onSelectionChange(() => {
          syncSelectionState();
        }),
      ];

      bindingRef.current = {
        univerAPI,
        workbook: univerWorkbook,
        captureSnapshot,
        syncWorkbookSnapshot,
        disposables,
      };

      const applyPermissions = async () => {
        if (!restrictEditingToRange || !editableRange) return;
        const currentUser = getStoredUser();
        if (!currentUser?.id) {
          return;
        }
        const sheets = univerWorkbook.getSheets();
        for (const item of sheets) {
          await item.getWorksheetPermission().setReadOnly();
        }
        const targetSheet = univerWorkbook.getSheetByName(editableRange.sheetName);
        if (!targetSheet) return;
        const rangeRef = selectionToRangeRef(editableRange);
        await targetSheet.getWorksheetPermission().protectRanges([
          {
            ranges: [targetSheet.getRange(rangeRef)],
            options: {
              name: "editable-answer-range",
              allowEdit: true,
              allowedUsers: [String(currentUser.id)],
              allowViewByOthers: true,
            },
          },
        ]);
        targetSheet.getRange(rangeRef).activate();
      };

      void applyPermissions();
      disposeBinding = () => {
        onSnapshotCaptureReady?.(null);
        disposables.forEach((item) => item.dispose());
        univerAPI.dispose();
        bindingRef.current = null;
      };
    };

    void mountEditor();

    return () => {
      disposed = true;
      disposeBinding?.();
      onSnapshotCaptureReady?.(null);
      bindingRef.current = null;
    };
  }, [instanceVersion]);

  useEffect(() => {
    const binding = bindingRef.current;
    latestEditorSnapshotRef.current = workbook;
    refreshCellInspector(workbook, latestSelectionRef.current);
    if (!binding) return;
    if (lastInternalSnapshotRef.current === workbookKey || lastAppliedExternalRef.current === workbookKey) {
      lastAppliedExternalRef.current = workbookKey;
      return;
    }
    setInstanceVersion((current) => current + 1);
  }, [workbookKey]);

  useEffect(() => {
    const binding = bindingRef.current;
    if (!binding || !selectedSheetName) return;
    const sheet = binding.workbook.getSheetByName(selectedSheetName);
    if (sheet) {
      binding.workbook.setActiveSheet(sheet);
    }
  }, [selectedSheetName]);

  useEffect(() => {
    const binding = bindingRef.current;
    if (!binding || !focusRange) return;
    const nextRangeRef = selectionToRangeRef(focusRange);
    const nextFocusKey = `${focusRequestVersion}:${focusRange.sheetName}:${nextRangeRef}`;
    if (lastFocusedRangeKeyRef.current === nextFocusKey) {
      return;
    }

    const activeSheet = binding.workbook.getActiveSheet();
    const activeRange = binding.workbook.getActiveRange();
    const currentSheetName = activeSheet?.getSheetName() || "";
    const currentRangeRef = activeRange?.getA1Notation(false) || "";

    if (currentSheetName === focusRange.sheetName && currentRangeRef === nextRangeRef && focusRequestVersion === 0) {
      lastFocusedRangeKeyRef.current = nextFocusKey;
      return;
    }

    const sheet = binding.workbook.getSheetByName(focusRange.sheetName);
    if (!sheet) return;
    lastFocusedRangeKeyRef.current = nextFocusKey;
    binding.workbook.setActiveSheet(sheet);
    sheet.getRange(nextRangeRef).activate();
  }, [focusRange, focusRequestVersion]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const nextIsFullscreen = document.fullscreenElement === shellRef.current;
      setIsFullscreen(nextIsFullscreen);
      window.setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
        setInstanceVersion((current) => current + 1);
      }, 80);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement === shellRef.current) {
      await document.exitFullscreen();
      return;
    }
    await shellRef.current.requestFullscreen();
  };

  const handleEditorKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || (event.key !== "Backspace" && event.key !== "Delete")) return;
    if (!latestOnWorkbookChangeRef.current || isEditableKeyboardTarget(event.target)) return;
    const binding = bindingRef.current;
    const activeRange = binding?.workbook.getActiveRange?.();
    if (!binding || !activeRange?.clearContent) return;
    event.preventDefault();
    activeRange.clearContent();
    window.setTimeout(() => {
      binding.syncWorkbookSnapshot();
    }, 0);
  };

  const handleConvertSelectionToDateFormat = () => {
    const binding = bindingRef.current;
    const activeSelection = latestSelectionRef.current;
    if (!binding || !activeSelection) {
      setEditorNotice("请先框选需要转换的日期单元格");
      return;
    }

    const sourceSnapshot = binding.captureSnapshot();
    const result = convertWorkbookSelectionToDateFormat(sourceSnapshot, activeSelection);
    if (result.changed === 0) {
      setEditorNotice("当前选区未识别到可转换的日期");
      refreshCellInspector(sourceSnapshot, activeSelection);
      return;
    }

    const nextKey = JSON.stringify(result.workbook);
    latestEditorSnapshotRef.current = result.workbook;
    lastInternalSnapshotRef.current = nextKey;
    latestOnWorkbookChangeRef.current?.(result.workbook);
    refreshCellInspector(result.workbook, activeSelection);
    setEditorNotice(`已转换 ${result.changed} 个日期单元格`);
    window.setTimeout(() => {
      setInstanceVersion((current) => current + 1);
    }, 0);
  };

  const handleCopyActiveFormula = async () => {
    const text = cellInspector.formula ? `=${cellInspector.formula}` : cellInspector.display;
    if (!text.trim()) {
      setEditorNotice("当前单元格没有可复制内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setEditorNotice("已复制当前单元格内容");
    } catch {
      setEditorNotice("复制失败，请手动选择公式内容");
    }
  };

  useEffect(() => {
    if (!requestFullscreenVersion || !shellRef.current) return;
    if (document.fullscreenElement !== shellRef.current) {
      void shellRef.current.requestFullscreen();
    }
  }, [requestFullscreenVersion]);

  const resolvedViewportClassName = viewportClassName || (isFullscreen
    ? "h-[calc(100vh-3.5rem)] w-full"
    : "h-[640px] max-h-[70vh] w-full");
  const activeFormulaText = cellInspector.formula ? `=${cellInspector.formula}` : "";
  const activeCellLabel = `${cellInspector.sheetName || "Sheet"} / ${cellInspector.cellRef}`;
  const visibleErrors = cellInspector.workbookErrors;

  const editorShell = (
    <div
      ref={shellRef}
      onKeyDownCapture={handleEditorKeyDownCapture}
      className={`relative isolate flex min-h-0 flex-col overflow-hidden bg-white ${isFullscreen ? "h-screen w-screen rounded-none border-0 shadow-none" : `rounded-[28px] border border-slate-200 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] ${className}`}`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Excel Editor
        </div>
        <div className="flex items-center gap-2">
          {isFullscreen && (
            <>
              <button
                type="button"
                onClick={handleConvertSelectionToDateFormat}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
              >
                <CalendarDays size={14} />
                日期格式
              </button>
              <button
                type="button"
                onClick={() => setInspectorOpen((current) => !current)}
                className={`inline-flex h-9 items-center justify-center gap-2 rounded-full border px-3 text-xs font-bold transition ${
                  visibleErrors.length > 0
                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <AlertTriangle size={14} />
                公式诊断{visibleErrors.length > 0 ? ` ${visibleErrors.length}` : ""}
              </button>
              <button
                type="button"
                onClick={() => setEditorNotice("点击编辑器右侧的 AI助手，可在全屏内提问并上传截图")}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-sky-700 transition hover:bg-sky-100"
              >
                <Bot size={14} />
                AI助手
              </button>
            </>
          )}
          {isFullscreen && showConfirmSelectionButton && (
            <button
              type="button"
              onClick={onConfirmSelection}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#1677ff] px-4 text-sm font-bold text-white transition hover:bg-[#4096ff]"
            >
              {confirmSelectionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Expand size={14} />}
            {isFullscreen ? "退出全屏" : "全屏进入"}
          </button>
        </div>
      </div>
      <div ref={containerRef} className={resolvedViewportClassName} />
      {isFullscreen && inspectorOpen && (
        <div className="pointer-events-auto absolute right-4 top-16 z-30 w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                当前单元格
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900">{activeCellLabel}</div>
            </div>
            <button
              type="button"
              onClick={handleCopyActiveFormula}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
            >
              <Copy size={13} />
              复制
            </button>
          </div>

          <textarea
            readOnly
            value={activeFormulaText || cellInspector.display || "当前单元格暂无公式或显示值"}
            className="mt-3 min-h-20 max-h-72 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800 outline-none"
          />

          {cellInspector.error && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <div className="font-black">{cellInspector.cellRef}：{cellInspector.error.code} {cellInspector.error.title}</div>
              <div className="mt-1 leading-5">{cellInspector.error.description}</div>
            </div>
          )}

          {visibleErrors.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-black text-amber-800">错误单元格</div>
              <div className="mt-2 grid max-h-28 grid-cols-2 gap-2 overflow-auto text-xs">
                {visibleErrors.map((item) => (
                  <div key={`${item.sheetName}:${item.cellRef}`} className="rounded-lg bg-white/80 px-2 py-1.5 text-amber-800">
                    <span className="font-black">{item.cellRef}</span>
                    <span className="ml-1">{item.code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editorNotice && (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">
              {editorNotice}
            </div>
          )}
        </div>
      )}
      {isFullscreen && <AssistantWidget />}
    </div>
  );

  return editorShell;
}
