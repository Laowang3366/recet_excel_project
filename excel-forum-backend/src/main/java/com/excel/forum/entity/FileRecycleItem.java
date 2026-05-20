package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("file_recycle_item")
public class FileRecycleItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String resourceType;
    private Long resourceId;
    private String displayName;
    private String originalFileUrl;
    private String recycleFileUrl;
    private String filesJson;
    private String businessSnapshotJson;
    private Long deletedBy;
    private LocalDateTime deletedAt;
    private LocalDateTime expiresAt;
    private LocalDateTime restoredAt;
    private LocalDateTime purgedAt;
    private String status;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
