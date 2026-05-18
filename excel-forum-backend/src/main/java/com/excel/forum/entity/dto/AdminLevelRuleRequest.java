package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminLevelRuleRequest {
    private Object level;
    private String name;
    private Object threshold;
    private Boolean enabled;
    private Object sortOrder;
}
