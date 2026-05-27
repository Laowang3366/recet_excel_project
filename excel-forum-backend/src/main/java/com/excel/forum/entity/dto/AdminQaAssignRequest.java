package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminQaAssignRequest {
    private Long assigneeUserId;
    private String note;
}
