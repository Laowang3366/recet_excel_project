package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("question_excel_template")
public class QuestionExcelTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long questionId;
    private String templateFileUrl;
    private String idealAnswerImageUrl;
    private String answerSheet;
    private String answerRange;
    private String answerSnapshotJson;
    private Boolean checkFormula;
    private String gradingRuleJson;
    private String expectedSnapshotJson;
    private Integer sheetCountLimit;
    private Integer version;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
