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
    private String status;
    private Integer upVoteCount;
    private Integer downVoteCount;
    private Integer rewardPoints;
    private LocalDateTime acceptedAt;
    private Long reviewerId;
    private String reviewNote;
    private LocalDateTime reviewedAt;
    private LocalDateTime publishedAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
