import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ModuleSearch } from "./ModuleSearch";

describe("ModuleSearch", () => {
  it("renders a page-local search box from an explicit module key", () => {
    const html = renderToStaticMarkup(
      <ModuleSearch
        moduleKey="templates"
        search="category=财务&search=利润"
        onNavigate={() => {}}
        className="w-full xl:max-w-[420px]"
      />
    );

    expect(html).toContain("模板搜索");
    expect(html).toContain("搜索模板、行业或函数");
    expect(html).toContain("value=\"利润\"");
    expect(html).toContain("xl:max-w-[420px]");
  });
});
