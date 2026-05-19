package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminAiAssistantConfigRequest {
    private String name;
    private String baseUrl;
    private String apiKey;
    private String model;
    private String reasoningEffort;
    private Integer timeoutMs;
    private Integer timeoutMinutes;
    private String systemPrompt;
    private String promptFileName;
    private Boolean enabled;
    private Boolean active;
    private Integer sortOrder;
}
