package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("site_notification")
public class SiteNotification {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String content;
    private String type;
    private String status;
    private String targetType;
    private String targetRoles;
    private Integer readCount;
    private Integer totalCount;
    private Long createdBy;
    private String attachments;
    private LocalDateTime scheduledTime;
    private Boolean pinned;
    private LocalDateTime pinnedUntil;
    private String targetUserIds;
    private LocalDateTime sendTime;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
