package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("points_rule")
public class PointsRule {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String description;
    private String taskKey;
    private Integer points;
    private String type;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private Integer dailyLimit;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private LocalDateTime effectiveAt;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private LocalDateTime expiresAt;
    private Boolean enabled;
    private Boolean userVisible;
    private Integer sortOrder;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
