package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("experience_level_rule")
public class ExperienceLevelRule {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Integer level;
    private String name;
    private Integer threshold;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private Integer maxExp;
    private Boolean enabled;
    private Integer sortOrder;
    private String iconTone;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String benefits;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
