import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminQuestionsSource = () =>
  readFileSync(resolve(process.cwd(), "src/app/pages/AdminQuestions.tsx"), "utf8");

describe("admin questions layout", () => {
  it("keeps the question management area before campaign configuration blocks", () => {
    const source = adminQuestionsSource();

    expect(source.indexOf('title="题目列表"')).toBeGreaterThan(-1);
    expect(source.indexOf('title="题目列表"')).toBeLessThan(source.indexOf("闯关配置"));
  });

  it("provides direct filters for finding questions", () => {
    const source = adminQuestionsSource();

    expect(source).toContain("keyword");
    expect(source).toContain("enabledFilter");
    expect(source).toContain("difficultyFilter");
  });

  it("supports uploading an ideal answer reference image", () => {
    const source = adminQuestionsSource();

    expect(source).toContain("idealAnswerImageUrl");
    expect(source).toContain("理想答案参考图");
    expect(source).toContain("handleIdealAnswerImageUpload");
    expect(source).toContain("handleIdealAnswerImagePaste");
    expect(source).toContain("Ctrl+V 粘贴图片");
  });

  it("allows removing the current Excel template before uploading a replacement", () => {
    const source = adminQuestionsSource();
    const removeTemplateBlock = source.slice(
      source.indexOf("const removeCurrentTemplate"),
      source.indexOf("const uploadIdealAnswerImageFile"),
    );

    expect(source).toContain("removeCurrentTemplate");
    expect(source).toContain("移除模板");
    expect(source).toContain("尚未上传模板文件");
    expect(removeTemplateBlock).toContain("resetEditorState();");
    expect(removeTemplateBlock).not.toContain("openAdminConfirm");
  });

  it("keeps uploaded dynamic array spill values visible in the admin editor", () => {
    const source = adminQuestionsSource();
    const uploadBlock = source.slice(
      source.indexOf("const handleTemplateUpload"),
      source.indexOf("const removeCurrentTemplate"),
    );

    expect(uploadBlock).toContain("loadTemplateWorkbook(uploadResult.url)");
    expect(uploadBlock).not.toContain("clearDynamicArraySpillChildren(snapshot, [nextDynamicRule])");
  });

  it("loads existing templates with saved answer snapshots visible in the editor", () => {
    const source = adminQuestionsSource();
    const editBlock = source.slice(
      source.indexOf("const openEdit"),
      source.indexOf("const submit"),
    );

    expect(editBlock).toContain("loadTemplateWorkbook(item.templateFileUrl, item.answerSheet, item.answerRange, item.answerSnapshotJson, dynamicArrayRules)");
    expect(editBlock).not.toContain("hydrateAnswerSnapshot: false");
  });

  it("does not recapture stored answers when saving existing metadata outside template edit mode", () => {
    const source = adminQuestionsSource();
    const submitBlock = source.slice(
      source.indexOf("const submit"),
      source.indexOf("const toggleEnabled"),
    );

    expect(submitBlock).toContain("shouldReuseStoredAnswerSnapshot");
    expect(submitBlock).toContain("form.answerSnapshotJson");
    expect(submitBlock).toContain("answerSnapshotJson: resolvedAnswerSnapshotJson");
  });
});
