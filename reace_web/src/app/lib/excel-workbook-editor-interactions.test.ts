import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editorSource = () =>
  readFileSync(resolve(process.cwd(), "src/app/components/ExcelWorkbookEditor.tsx"), "utf8");

describe("ExcelWorkbookEditor interactions", () => {
  it("keeps the first Escape inside active editor operations before fullscreen exit", () => {
    const source = editorSource();

    expect(source).toContain("handleFullscreenEscape");
    expect(source).toContain("clearActiveEditorOperation");
    expect(source).toContain("consumeNextFullscreenEscapeRef");
    expect(source).toContain('event.key !== "Escape"');
  });

  it("uses snapshot fallback when Delete clears the selected range", () => {
    const source = editorSource();

    expect(source).toContain("clearWorkbookRange");
    expect(source).toContain("clearActiveSelectionContent");
    expect(source).toContain("shouldSkipRangeClearForKeyboardTarget");
    expect(source).toContain('event.stopPropagation()');
  });

  it("exposes cell format controls for date percent text and number conversion", () => {
    const source = editorSource();

    expect(source).toContain("handleCellFormatChange");
    expect(source).toContain("formatSelection");
    expect(source).toContain("百分比");
    expect(source).toContain("文本");
  });

  it("does not open formula diagnostics by default until errors are detected", () => {
    const source = editorSource();

    expect(source).toContain("const [inspectorOpen, setInspectorOpen] = useState(false)");
    expect(source).toContain("visibleErrors.length > 0");
    expect(source).toContain("setInspectorOpen(true)");
  });

  it("renders a mouse-resizable formula bar in fullscreen", () => {
    const source = editorSource();

    expect(source).toContain("formulaBarHeight");
    expect(source).toContain("handleFormulaBarResizeStart");
    expect(source).toContain('aria-label="调整公式栏高度"');
  });

  it("keeps hydration guarded until initial Univer commands have flushed", () => {
    const source = editorSource();

    expect(source).toContain("releaseHydrationAfterCommandFlush");
    expect(source).toContain("hydrationReleaseTimerRef");
    expect(source).toContain("window.requestAnimationFrame");
  });
});
