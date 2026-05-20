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
    expect(source).toContain('event.key !== "Escape"');
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
});
