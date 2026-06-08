import { describe, expect, it } from "vitest";
import { buildTutorialSections } from "./TutorialCenter";

describe("buildTutorialSections", () => {
  it("sanitizes tutorial html before rendering section content", () => {
    const sections = buildTutorialSections(`
      <h2>函数简介</h2>
      <p onclick="alert(1)">安全正文</p>
      <a href="vbscript:msgbox(1)">危险链接</a>
      <img src="data:image/svg+xml;base64,PHN2Zy8+" onerror="alert(2)" />
    `, "SUM");

    expect(sections).toHaveLength(1);
    expect(sections[0].html).toContain("安全正文");
    expect(sections[0].html).not.toContain("onclick");
    expect(sections[0].html).not.toContain("onerror");
    expect(sections[0].html).not.toContain("vbscript:");
    expect(sections[0].html).not.toContain("data:image");
  });
});
