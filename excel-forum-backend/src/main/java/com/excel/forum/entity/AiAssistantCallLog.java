package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("ai_assistant_call_log")
public class AiAssistantCallLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long configId;
    private String model;
    private String toolType;
    private String questionSummary;
    private String requestPreview;
    private String responsePreview;
    private Boolean success;
    private Boolean fallbackUsed;
    private Long latencyMs;
    private String errorMessage;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
