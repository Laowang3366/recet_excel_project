package com.excel.forum.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "excel.security.workbook")
public class WorkbookSecurityProperties {
    private int maxSheets = 24;
    private int maxWorkbookCells = 100_000;
    private int maxSnapshotCells = 50_000;
    private int maxFormulaLength = 8_192;
    private int maxTextLength = 32_767;
    private double minInflateRatio = 0.01d;
}
