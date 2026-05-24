import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Tools } from "./Tools";

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../lib/session", () => ({
  useSession: () => ({ isAuthenticated: false }),
}));

describe("Tools", () => {
  it("renders the formula interpreter without conversion entry or removed section titles", () => {
    const markup = renderToStaticMarkup(<Tools />);

    expect(markup).toContain("px-4 py-5 sm:px-6 sm:py-8 pt-0 sm:pt-0");
    expect(markup).toContain("函数公式解释器");
    expect(markup).toContain("解释公式");
    expect(markup).toContain("公式历史");
    expect(markup).toContain(">输入公式<");
    expect(markup).toContain(">公式解释<");
    expect(markup).not.toContain('pr-1"><h2 class="mb-3 text-base font-black text-slate-900">公式解释</h2>');
    expect(markup).toContain('pr-1"><div class="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_20px_54px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:p-6"><h2 class="mb-4 text-base font-black text-slate-900">公式解释</h2>');
    expect(markup).not.toContain("文件转换");
    expect(markup).not.toContain("粘贴需要解释的公式");
    expect(markup).not.toContain("公式优化排版");
  });
});
