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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/question-categories")
@RequiredArgsConstructor
public class AdminQuestionCategoryController {
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
        if (!StringUtils.hasText(category.getName())) {
            return ResponseEntity.badRequest().body(Map.of("message", "分类名称不能为空"));
        }
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

    @PutMapping("/{id}")
    public ResponseEntity<?> updateQuestionCategory(@PathVariable Long id, @RequestBody QuestionCategory category) {
        QuestionCategory existing = questionCategoryService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        if (!StringUtils.hasText(category.getName())) {
            return ResponseEntity.badRequest().body(Map.of("message", "分类名称不能为空"));
        }
        category.setId(id);
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
        response.put("sortOrder", category.getSortOrder());
        response.put("enabled", category.getEnabled());
        response.put("questionCount", category.getQuestionCount() == null ? 0 : category.getQuestionCount());
        response.put("createTime", category.getCreateTime());
        response.put("updateTime", category.getUpdateTime());
        return response;
    }
}
