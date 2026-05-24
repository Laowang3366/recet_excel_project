package com.excel.forum.entity.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FormulaExplainTaskResponse {
    private String taskId;
    private String status;
    private FormulaExplainRequest request;
    private FormulaExplainResponse result;
    private String errorMessage;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
