package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("formula_explain_record")
public class FormulaExplainRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String formula;
    private String normalizedFormula;
    private String formulaHash;
    private String locale;
    private String detailLevel;
    private String workbookContext;
    private String expectedResult;
    private String errorMessageInput;
    private String responseJson;
    private String summary;
    private String model;
    private Boolean fallbackUsed;
    private Boolean cacheHit;
    private Integer pointsCost;
    private String status;
    private String errorMessage;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
