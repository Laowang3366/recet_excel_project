package com.excel.forum.entity.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class AdminTemplateCenterRequest {
    @Size(max = 100)
    private String title;
    @Size(max = 32)
    private String industryCategory;
    @Size(max = 80)
    private String useScenario;
    @Size(max = 512)
    private String previewImageUrl;
    @Size(max = 500)
    private String templateDescription;
    @Size(max = 2000)
    private String usageGuide;
    @Size(max = 30)
    private List<String> functionsUsed;
    @Size(max = 30)
    private List<String> tags;
    @Size(max = 32)
    private String difficultyLevel;
    @Min(0)
    @Max(999999)
    private Integer downloadCostPoints;
    @Size(max = 512)
    private String templateFileUrl;
    @Size(max = 255)
    private String fileName;
    @Min(0)
    private Long fileSize;
    @Size(max = 40)
    private String fileVersion;
    private LocalDateTime lastUploadedAt;
    private Integer sortOrder;
    private Boolean enabled;
}
