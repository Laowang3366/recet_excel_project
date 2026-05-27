package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminLevelRuleRequest {
    private Object level;
    private String name;
    private Object threshold;
    private Object maxExp;
    private Boolean enabled;
    private Object sortOrder;
    private String iconTone;
    private String benefits;
}
