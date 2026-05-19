import { describe, expect, it } from "vitest";
import viteConfig from "../../../vite.config";

describe("vite performance configuration", () => {
  it("keeps the Vite preload helper out of heavy async vendor chunks", () => {
    const output = viteConfig.build?.rollupOptions?.output;
    const manualChunks = Array.isArray(output) ? output[0]?.manualChunks : output?.manualChunks;

    expect(typeof manualChunks).toBe("function");
    expect((manualChunks as (id: string) => string | undefined)("\0vite/preload-helper.js")).toBe("vite-helper");
  });

  it("keeps Univer language packs in a dedicated async chunk with a higher warning budget", () => {
    const output = viteConfig.build?.rollupOptions?.output;
    const manualChunks = Array.isArray(output) ? output[0]?.manualChunks : output?.manualChunks;
    const chunkName = (manualChunks as (id: string) => string | undefined)(
      "D:/project/recet_excel_project/reace_web/node_modules/@univerjs/preset-sheets-core/locales/zh-CN.js",
    );

    expect(chunkName).toBe("univer-locales");
    expect(viteConfig.build?.chunkSizeWarningLimit).toBeGreaterThanOrEqual(900);
  });

  it("splits heavy Univer editor dependencies by runtime responsibility", () => {
    const output = viteConfig.build?.rollupOptions?.output;
    const manualChunks = Array.isArray(output) ? output[0]?.manualChunks : output?.manualChunks;
    const resolveChunk = manualChunks as (id: string) => string | undefined;

    expect(resolveChunk("D:/repo/node_modules/@univerjs/engine-render/lib/es/index.js")).toBe("univer-render-core");
    expect(resolveChunk("D:/repo/node_modules/@univerjs/engine-render/lib/es/hu-Er-06LwB.js")).toBe("univer-render-data-h-l");
    expect(resolveChunk("D:/repo/node_modules/@univerjs/engine-formula/lib/es/index.js")).toBe("univer-engine-formula");
    expect(resolveChunk("D:/repo/node_modules/@univerjs/sheets-formula-ui/lib/es/index.js")).toBe("univer-sheets-feature-ui");
    expect(resolveChunk("D:/repo/node_modules/@univerjs/sheets-ui/lib/es/index.js")).toBe("univer-sheets-ui");
    expect(resolveChunk("D:/repo/node_modules/@univerjs/ui/lib/es/index.js")).toBe("univer-ui-core");
    expect(resolveChunk("D:/repo/node_modules/@univerjs/sheets/lib/es/index.js")).toBe("univer-sheets");
    expect(resolveChunk("D:/repo/node_modules/@univerjs/core/lib/es/index.js")).toBe("univer-render-core");
  });
});
