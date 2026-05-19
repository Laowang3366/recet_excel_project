package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("qa_case_help_answer")
public class QaCaseHelpAnswer {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long caseId;
    private Long userId;
    private String answerFileUrl;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
