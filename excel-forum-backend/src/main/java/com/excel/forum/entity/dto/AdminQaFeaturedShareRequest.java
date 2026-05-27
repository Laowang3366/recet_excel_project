package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminQaFeaturedShareRequest {
    private Long caseId;
    private Long answerId;
    private String title;
    private String thoughtText;
}
