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

    expect(markup).toContain("函数公式解释器");
    expect(markup).toContain("解释公式");
    expect(markup).toContain("公式历史");
    expect(markup).not.toContain("文件转换");
    expect(markup).not.toContain("粘贴需要解释的公式");
    expect(markup).not.toContain("公式优化排版");
  });
});
