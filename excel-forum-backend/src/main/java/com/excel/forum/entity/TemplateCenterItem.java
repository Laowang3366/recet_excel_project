package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("template_center_item")
public class TemplateCenterItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String industryCategory;
    private String useScenario;
    private String previewImageUrl;
    private String templateDescription;
    private String usageGuide;
    private String functionsUsed;
    private String tagsJson;
    private String difficultyLevel;
    private Integer downloadCostPoints;
    private String templateFileUrl;
    private String fileName;
    private Long fileSize;
    private String fileVersion;
    private LocalDateTime lastUploadedAt;
    private Integer sortOrder;
    private Boolean enabled;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
    private LocalDateTime deletedAt;
    private Long deletedBy;
}
