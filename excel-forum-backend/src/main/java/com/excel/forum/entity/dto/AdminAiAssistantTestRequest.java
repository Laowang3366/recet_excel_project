package com.excel.forum.entity.dto;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class AdminAiAssistantTestRequest extends AdminAiAssistantConfigRequest {
    private Long configId;
    private String testQuestion;
}
