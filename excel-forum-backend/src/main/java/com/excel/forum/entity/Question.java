package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("question")
public class Question {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String type;
    private Long categoryId;
    @TableField("question_category_id")
    private Long questionCategoryId;
    private String options;
    private String answer;
    private Integer difficulty;
    private Integer points;
    private String explanation;
    private Boolean enabled;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
