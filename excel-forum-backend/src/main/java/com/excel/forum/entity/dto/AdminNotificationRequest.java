package com.excel.forum.entity.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminNotificationRequest {
    private String title;
    private String content;
    private String type;
    private String status;
    private String targetType;
    private Object targetRoles;
    private Object targetUserIds;
    private String attachments;
    private LocalDateTime scheduledTime;
    private Boolean pinned;
}
