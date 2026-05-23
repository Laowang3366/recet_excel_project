package com.excel.forum.entity.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FormulaExplainResponse {
    private String formula;
    private String normalizedFormula;
    private String summary;
    private List<FormulaSegment> segments = new ArrayList<>();
    private List<FormulaFunction> functions = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
    private List<String> suggestions = new ArrayList<>();
    private List<String> fixes = new ArrayList<>();
    private FormulaAnalysis analysis;
    private String model;
    private boolean fallbackUsed;
    private Long recordId;
    private boolean cacheHit;
    private int pointsCost;
    private int currentPoints;
    private LocalDateTime createTime;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FormulaSegment {
        private String text;
        private String title;
        private String explanation;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FormulaFunction {
        private String name;
        private String purpose;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FormulaAnalysis {
        private List<String> functions = new ArrayList<>();
        private int parenthesesDepth;
        private int nestingDepth;
        private boolean structuredReference;
        private boolean dynamicArrayFunction;
        private List<String> riskFlags = new ArrayList<>();
    }
}
