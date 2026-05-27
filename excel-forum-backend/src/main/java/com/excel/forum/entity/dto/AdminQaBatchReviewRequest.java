package com.excel.forum.entity.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdminQaBatchReviewRequest {
    private List<Long> ids;
    private String action;
    private String note;
}
