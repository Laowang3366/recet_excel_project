package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminNotificationRequest {
    private String title;
    private String content;
    private String type;
    private String status;
    private String targetType;
    private Object targetRoles;
    private String attachments;
}
