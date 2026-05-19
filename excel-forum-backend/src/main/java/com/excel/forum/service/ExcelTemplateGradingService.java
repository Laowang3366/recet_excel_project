package com.excel.forum.service;

import com.excel.forum.entity.dto.ExcelTemplateEvaluation;
import com.excel.forum.entity.dto.ExcelTemplateAnswerSnapshot;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.entity.dto.ExcelTemplateExpectedSnapshot;
import com.excel.forum.entity.dto.ExcelTemplateRuleConfig;

import java.util.Map;

public interface ExcelTemplateGradingService {
    ExcelWorkbookSnapshot loadWorkbookSnapshot(String fileUrl);

    ExcelTemplateRuleConfig parseRuleConfig(String gradingRuleJson);

    String normalizeRuleJson(String gradingRuleJson);

    void validateAnswerArea(String fileUrl, String sheetName, String rangeRef);

    String buildSimpleRuleJson(String answerSheet, String answerRange, Boolean checkFormula);

    String buildRuleJson(String fileUrl, String answerSheet, String answerRange, Boolean checkFormula, String gradingRuleJson);

    ExcelTemplateAnswerSnapshot parseAnswerSnapshot(String json);

    String normalizeAnswerSnapshotJson(String fileUrl, String answerSheet, String answerRange, Boolean checkFormula, String answerSnapshotJson);

    String buildExpectedSnapshotJson(String answerSheet, String answerRange, Boolean checkFormula, String answerSnapshotJson);

    String buildExpectedSnapshotJson(String fileUrl, String answerSheet, String answerRange, Boolean checkFormula, String answerSnapshotJson, String gradingRuleJson);

    String buildExpectedSnapshotJson(String fileUrl, String answerSheet, String answerRange, Boolean checkFormula, String answerSnapshotJson, String gradingRuleJson, String previousExpectedSnapshotJson);

    String buildExpectedSnapshotJson(String fileUrl, String gradingRuleJson, String expectedSnapshotJson);

    ExcelTemplateExpectedSnapshot parseExpectedSnapshot(String json);

    ExcelWorkbookSnapshot materializeSubmission(String fileUrl, ExcelWorkbookSnapshot submission);

    byte[] buildStudentWorkbookFile(String fileUrl, String answerSheet, String answerRange);

    byte[] buildWorkbookFileFromSnapshot(String fileUrl, ExcelWorkbookSnapshot submission);

    ExcelTemplateEvaluation grade(ExcelWorkbookSnapshot submission, String gradingRuleJson, String expectedSnapshotJson);

    Map<String, Object> buildRuleSummary(String gradingRuleJson);
}
