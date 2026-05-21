package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("admin_audit_log")
public class AdminAuditLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long adminUserId;
    private String method;
    private String path;
    private String queryString;
    private Integer statusCode;
    private String clientIp;
    private String userAgent;
    private LocalDateTime createTime;
}
