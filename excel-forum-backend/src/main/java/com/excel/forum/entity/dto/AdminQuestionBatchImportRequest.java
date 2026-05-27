package com.excel.forum.entity.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdminQuestionBatchImportRequest {
    private List<AdminQuestionRequest> records;
}
