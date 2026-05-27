package com.excel.forum.entity.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdminQaBatchAssignRequest {
    private List<Long> ids;
    private Long assigneeUserId;
    private String note;
}
