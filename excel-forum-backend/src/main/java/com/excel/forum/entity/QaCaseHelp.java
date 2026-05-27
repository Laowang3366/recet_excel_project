package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("qa_case_help")
public class QaCaseHelp {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String title;
    private String description;
    private String templateFileUrl;
    private String answerSheet;
    private String answerRange;
    private String idealAnswerSnapshotJson;
    private String status;
    private Long acceptedAnswerId;
    private LocalDateTime acceptedAt;
    private Long assignedUserId;
    private Long assignedBy;
    private LocalDateTime assignedAt;
    private String assignmentNote;
    private Integer viewCount;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
