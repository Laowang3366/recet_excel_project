package com.excel.forum.util;

import java.util.List;

public final class TemplateCenterCatalog {
    public static final List<String> INDUSTRY_CATEGORIES = List.of("财务", "人事", "生产", "销售", "运营", "仓储", "采购");
    public static final List<String> DIFFICULTY_LEVELS = List.of("入门", "基础", "中级", "进阶", "高级", "专家");

    private TemplateCenterCatalog() {
    }

    public static boolean isValidIndustryCategory(String value) {
        return value != null && INDUSTRY_CATEGORIES.contains(value.trim());
    }

    public static boolean isValidDifficultyLevel(String value) {
        return value != null && DIFFICULTY_LEVELS.contains(value.trim());
    }
}
