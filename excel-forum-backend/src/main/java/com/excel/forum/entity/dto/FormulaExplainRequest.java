package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class FormulaExplainRequest {
    private String formula;
    private String locale = "zh-CN";
    private String detailLevel = "standard";
    private String workbookContext;
    private String expectedResult;
    private String errorMessageInput;
}
