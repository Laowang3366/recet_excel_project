package com.excel.forum.controller;

import com.excel.forum.entity.QuestionCategory;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.QuestionCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/question-categories")
@RequiredArgsConstructor
public class AdminQuestionCategoryController {
    private static final String DEFAULT_ICON_KEY = "folder";
    private static final String DEFAULT_RECOMMENDED_DIFFICULTY = "medium";
    private static final Set<String> SUPPORTED_ICON_KEYS = Set.of("folder", "sigma", "chart", "pie", "table", "list", "more");
    private static final Set<String> SUPPORTED_DIFFICULTIES = Set.of("easy", "medium", "hard");

    private final QuestionCategoryService questionCategoryService;
    private final PracticeCampaignService practiceCampaignService;

    @GetMapping
    public ResponseEntity<?> getQuestionCategories() {
        List<Map<String, Object>> result = questionCategoryService.listWithQuestionCount(false).stream()
                .map(this::buildQuestionCategoryResponse)
                .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> createQuestionCategory(@RequestBody QuestionCategory category) {
        ResponseEntity<?> validation = normalizeCategoryPayload(category, null);
        if (validation != null) return validation;
        if (category.getSortOrder() == null) {
            category.setSortOrder(0);
        }
        if (category.getEnabled() == null) {
            category.setEnabled(true);
        }
        questionCategoryService.save(category);
        practiceCampaignService.syncCampaignCatalog();
        QuestionCategory saved = questionCategoryService.getById(category.getId());
        saved.setQuestionCount(questionCategoryService.countQuestions(saved.getId()));
        return ResponseEntity.ok(buildQuestionCategoryResponse(saved));
    }

    @PutMapping("/sort")
    public ResponseEntity<?> updateQuestionCategorySort(@RequestBody QuestionCategorySortRequest request) {
        if (request == null || request.items() == null || request.items().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "排序列表不能为空"));
        }
        List<QuestionCategory> updates = new ArrayList<>();
        for (QuestionCategorySortItem item : request.items()) {
            if (item == null || item.id() == null || item.sortOrder() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "排序项不完整"));
            }
            QuestionCategory category = new QuestionCategory();
            category.setId(item.id());
            category.setSortOrder(item.sortOrder());
            updates.add(category);
        }
        questionCategoryService.updateBatchById(updates);
        practiceCampaignService.syncCampaignCatalog();
        return ResponseEntity.ok(Map.of("message", "分类排序已保存"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateQuestionCategory(@PathVariable Long id, @RequestBody QuestionCategory category) {
        QuestionCategory existing = questionCategoryService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        category.setId(id);
        ResponseEntity<?> validation = normalizeCategoryPayload(category, existing);
        if (validation != null) return validation;
        if (category.getSortOrder() == null) {
            category.setSortOrder(existing.getSortOrder());
        }
        if (category.getEnabled() == null) {
            category.setEnabled(existing.getEnabled());
        }
        questionCategoryService.updateById(category);
        practiceCampaignService.syncCampaignCatalog();
        QuestionCategory updated = questionCategoryService.getById(id);
        updated.setQuestionCount(questionCategoryService.countQuestions(id));
        return ResponseEntity.ok(buildQuestionCategoryResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteQuestionCategory(@PathVariable Long id) {
        QuestionCategory category = questionCategoryService.getById(id);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        long count = questionCategoryService.countQuestions(id);
        if (count > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "当前分类下仍有题目，无法删除"));
        }
        questionCategoryService.removeById(id);
        practiceCampaignService.syncCampaignCatalog();
        return ResponseEntity.ok(Map.of("message", "题目分类已删除"));
    }

    private Map<String, Object> buildQuestionCategoryResponse(QuestionCategory category) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", category.getId());
        response.put("name", category.getName());
        response.put("description", category.getDescription());
        response.put("groupName", category.getGroupName());
        response.put("frontDisplayName", StringUtils.hasText(category.getFrontDisplayName()) ? category.getFrontDisplayName() : category.getName());
        response.put("iconKey", StringUtils.hasText(category.getIconKey()) ? category.getIconKey() : DEFAULT_ICON_KEY);
        response.put("recommendedDifficulty", StringUtils.hasText(category.getRecommendedDifficulty()) ? category.getRecommendedDifficulty() : DEFAULT_RECOMMENDED_DIFFICULTY);
        response.put("sortOrder", category.getSortOrder());
        response.put("enabled", category.getEnabled());
        response.put("questionCount", category.getQuestionCount() == null ? 0 : category.getQuestionCount());
        response.put("createTime", category.getCreateTime());
        response.put("updateTime", category.getUpdateTime());
        return response;
    }

    private ResponseEntity<?> normalizeCategoryPayload(QuestionCategory category, QuestionCategory existing) {
        if (!StringUtils.hasText(category.getName())) {
            return ResponseEntity.badRequest().body(Map.of("message", "分类名称不能为空"));
        }
        category.setName(category.getName().trim());
        if (category.getDescription() != null) {
            category.setDescription(category.getDescription().trim());
        } else if (existing != null) {
            category.setDescription(existing.getDescription());
        }
        if (category.getGroupName() != null) {
            category.setGroupName(category.getGroupName().trim());
        } else if (existing != null) {
            category.setGroupName(existing.getGroupName());
        }

        String frontDisplayName = category.getFrontDisplayName();
        if (frontDisplayName == null && existing != null) {
            frontDisplayName = existing.getFrontDisplayName();
        }
        category.setFrontDisplayName(StringUtils.hasText(frontDisplayName) ? frontDisplayName.trim() : category.getName());

        String iconKey = category.getIconKey();
        if (iconKey == null && existing != null) {
            iconKey = existing.getIconKey();
        }
        iconKey = StringUtils.hasText(iconKey) ? iconKey.trim() : DEFAULT_ICON_KEY;
        if (!SUPPORTED_ICON_KEYS.contains(iconKey)) {
            return ResponseEntity.badRequest().body(Map.of("message", "分类图标不正确"));
        }
        category.setIconKey(iconKey);

        String recommendedDifficulty = category.getRecommendedDifficulty();
        if (recommendedDifficulty == null && existing != null) {
            recommendedDifficulty = existing.getRecommendedDifficulty();
        }
        recommendedDifficulty = StringUtils.hasText(recommendedDifficulty) ? recommendedDifficulty.trim() : DEFAULT_RECOMMENDED_DIFFICULTY;
        if (!SUPPORTED_DIFFICULTIES.contains(recommendedDifficulty)) {
            return ResponseEntity.badRequest().body(Map.of("message", "推荐难度不正确"));
        }
        category.setRecommendedDifficulty(recommendedDifficulty);
        return null;
    }

    private record QuestionCategorySortRequest(List<QuestionCategorySortItem> items) {
    }

    private record QuestionCategorySortItem(Long id, Integer sortOrder) {
    }
}
