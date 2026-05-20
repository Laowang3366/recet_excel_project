package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminQuestionRequest {
    private String title;
    private String type;
    private Long categoryId;
    private Long questionCategoryId;
    private String options;
    private String answer;
    private Integer difficulty;
    private Integer points;
    private String explanation;
    private Boolean enabled;
    private String templateFileUrl;
    private String idealAnswerImageUrl;
    private String answerSheet;
    private String answerRange;
    private String answerSnapshotJson;
    private Boolean checkFormula;
    private String gradingRuleJson;
    private String expectedSnapshotJson;
    private Integer sheetCountLimit;
    private Integer version;
}
