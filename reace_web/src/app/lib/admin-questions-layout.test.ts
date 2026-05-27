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

  it("renders the redesigned question-bank shell from the design references", () => {
    const source = adminQuestionsSource();

    expect(source).toContain("QUESTION_BANK_TABS");
    expect(source).toContain("QUESTION_EDITOR_STEPS");
    expect(source).toContain("题目编辑向导");
    expect(source).toContain("发布前检查");
    expect(source).toContain("前台练习展示预览");
  });

  it("keeps the basic information step free of template upload and editor controls", () => {
    const source = adminQuestionsSource();
    const basicStepStart = source.indexOf("editorStep === 0");
    const basicStepBlock = source.slice(
      basicStepStart,
      source.indexOf("editorStep === 1", basicStepStart),
    );

    expect(basicStepStart).toBeGreaterThan(-1);
    expect(basicStepBlock).toContain("基本信息");
    expect(basicStepBlock).toContain("前台练习展示预览");
    expect(basicStepBlock).not.toContain("Excel 模板");
    expect(basicStepBlock).not.toContain("模板编辑器");
    expect(basicStepBlock).not.toContain("handleTemplateUpload");
  });

  it("keeps answer reference image upload in the upload-template step", () => {
    const source = adminQuestionsSource();
    const uploadStepStart = source.indexOf("editorStep === 1");
    const uploadStepBlock = source.slice(
      uploadStepStart,
      source.indexOf("editorStep === 2", uploadStepStart),
    );

    expect(uploadStepStart).toBeGreaterThan(-1);
    expect(uploadStepBlock).toContain("Excel 模板");
    expect(uploadStepBlock).toContain("上传模板");
    expect(uploadStepBlock).toContain("理想答案参考图");
    expect(uploadStepBlock).toContain("上传答案照片");
    expect(uploadStepBlock).toContain("idealAnswerImageUrl");
    expect(source).toContain("uploadIdealAnswerImageFile");
    expect(uploadStepBlock).toContain("模板编辑器");
    expect(uploadStepBlock).not.toContain("前台练习展示预览");
    expect(uploadStepBlock).not.toContain("工作表预览");
    expect(uploadStepBlock).not.toContain("区域与判题配置");
  });

  it("merges the answer-area and grading-rule configuration into one step", () => {
    const source = adminQuestionsSource();
    const answerStepStart = source.indexOf("editorStep === 2");
    const answerStepBlock = source.slice(
      answerStepStart,
      source.indexOf("editorStep === 3", answerStepStart),
    );

    expect(answerStepStart).toBeGreaterThan(-1);
    expect(answerStepBlock).toContain("工作表预览");
    expect(answerStepBlock).toContain("区域与判题配置");
    expect(answerStepBlock).toContain("判题规则");
    expect(answerStepBlock).toContain("测试结果");
    expect(source).not.toContain("editorStep === 4");
  });

  it("lets preview-publish edits write back to the same form state", () => {
    const source = adminQuestionsSource();
    const previewStepStart = source.indexOf("editorStep === 3");
    const previewStepBlock = source.slice(
      previewStepStart,
      source.indexOf("</FormDialog>", previewStepStart),
    );

    expect(previewStepStart).toBeGreaterThan(-1);
    expect(previewStepBlock).toContain("预览发布");
    expect(previewStepBlock).toContain("发布内容修改");
    expect(previewStepBlock).toMatch(/title:\s*event\.target\.value/);
    expect(previewStepBlock).toMatch(/explanation:\s*event\.target\.value/);
    expect(previewStepBlock).toMatch(/answerRange:\s*event\.target\.value\.toUpperCase\(\)/);
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

  it("wires redesigned question-bank gaps to server-backed endpoints", () => {
    const source = adminQuestionsSource();

    expect(source).toContain("QUESTION_BANK_SERVICE_ENDPOINTS.batchImport");
    expect(source).toContain("QUESTION_BANK_SERVICE_ENDPOINTS.templateSnapshotChecks");
    expect(source).toContain("QUESTION_BANK_SERVICE_ENDPOINTS.exceptions");
    expect(source).toContain("QUESTION_BANK_SERVICE_ENDPOINTS.publishTests");
    expect(source).toContain("QUESTION_BANK_SERVICE_ENDPOINTS.publishTest(item.id)");
    expect(source).not.toContain("需要后端接口支持");
    expect(source).not.toContain("需等待后端任务接口");
  });

  it("wraps long publish-test values instead of letting columns overlap", () => {
    const source = adminQuestionsSource();
    const testResultStart = source.indexOf("测试结果");
    const testResultBlock = source.slice(
      testResultStart,
      source.indexOf("预览发布", testResultStart),
    );

    expect(testResultBlock).toContain("min-w-0");
    expect(testResultBlock).toContain("whitespace-pre-wrap");
    expect(testResultBlock).toContain("[overflow-wrap:anywhere]");
  });
});
