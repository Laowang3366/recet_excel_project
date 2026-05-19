import { useEffect, useMemo, useRef, useState } from "react";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import type { IWorkbookData } from "@univerjs/core";
import type { FWorkbook } from "@univerjs/preset-sheets-core";
import "@univerjs/preset-sheets-core/lib/index.css";
import { Expand, Minimize2 } from "lucide-react";
import {
  ExcelRangeSelection,
  ExcelWorkbookSnapshot,
  clearInferredDynamicArraySpillChildren,
  normalizeSelection,
  parseRangeRef,
  parseSheetAndRange,
  resolveExcelCellNumberFormat,
  selectionToRangeRef,
} from "../lib/excel";
import { captureUniverWorkbookSnapshot, type UniverWorkbookSnapshotOptions } from "../lib/univer-workbook";
import { getStoredUser } from "../lib/session-store";

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
  const formula = cell?.formula ? `=${cell.formula}` : "";
  if (formula) return formula;
  const value = cell?.value;
  const numberFormat = resolveExcelCellNumberFormat(cell);
  if (numberFormat && typeof value === "number") {
    return { v: value, s: { n: { pattern: numberFormat } } };
  }
  return value;
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
  const [instanceVersion, setInstanceVersion] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const workbookKey = useMemo(() => JSON.stringify(workbook), [workbook]);

  useEffect(() => {
    latestSelectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    latestSelectedSheetNameRef.current = selectedSheetName;
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
        lastInternalSnapshotRef.current = nextKey;
        latestOnWorkbookChangeRef.current?.(nextSnapshot);
      };

      const syncSelectionState = () => {
        if (hydratingRef.current) return;
        const activeSheet = univerWorkbook.getActiveSheet();
        if (activeSheet && activeSheet.getSheetName() !== latestSelectedSheetNameRef.current) {
          latestOnSelectedSheetNameChangeRef.current?.(activeSheet.getSheetName());
        }
        const activeRange = univerWorkbook.getActiveRange();
        if (activeRange && latestOnSelectionChangeRef.current && latestSelectionEnabledRef.current) {
          const parsed = parseSheetAndRange(activeRange.getA1Notation(true));
          const range = parseRangeRef(parsed.rangeRef);
          if (range) {
            const nextSelection = normalizeSelection(
              parsed.sheetName || activeSheet?.getSheetName() || "",
              range.startRow,
              range.startCol,
              range.endRow,
              range.endCol,
            );
            if (!isSameSelection(latestSelectionRef.current, nextSelection)) {
              latestOnSelectionChangeRef.current(nextSelection);
            }
          }
        }
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

  useEffect(() => {
    if (!requestFullscreenVersion || !shellRef.current) return;
    if (document.fullscreenElement !== shellRef.current) {
      void shellRef.current.requestFullscreen();
    }
  }, [requestFullscreenVersion]);

  const resolvedViewportClassName = viewportClassName || (isFullscreen
    ? "h-[calc(100vh-3.5rem)] w-full"
    : "h-[640px] max-h-[70vh] w-full");

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
    </div>
  );

  return editorShell;
}
