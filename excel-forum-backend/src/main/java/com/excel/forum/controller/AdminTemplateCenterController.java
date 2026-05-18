package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.TemplateCenterItem;
import com.excel.forum.entity.TemplateDownloadRecord;
import com.excel.forum.entity.dto.AdminTemplateCenterRequest;
import com.excel.forum.service.TemplateCenterItemService;
import com.excel.forum.service.TemplateDownloadRecordService;
import com.excel.forum.util.TemplateCenterCatalog;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/admin/templates")
@RequiredArgsConstructor
@Slf4j
public class AdminTemplateCenterController {
    private final TemplateCenterItemService templateCenterItemService;
    private final TemplateDownloadRecordService templateDownloadRecordService;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<?> getTemplates(@RequestParam(required = false) String industryCategory) {
        QueryWrapper<TemplateCenterItem> queryWrapper = new QueryWrapper<>();
        if (industryCategory != null && !industryCategory.isBlank()) {
            queryWrapper.eq("industry_category", industryCategory.trim());
        }
        queryWrapper.orderByAsc("sort_order").orderByAsc("id");
        List<Map<String, Object>> records = templateCenterItemService.list(queryWrapper).stream()
                .map(this::toAdminMap)
                .toList();
        return ResponseEntity.ok(Map.of(
                "industryCategories", TemplateCenterCatalog.INDUSTRY_CATEGORIES,
                "difficultyLevels", TemplateCenterCatalog.DIFFICULTY_LEVELS,
                "records", records
        ));
    }

    @PostMapping
    public ResponseEntity<?> createTemplate(@RequestBody AdminTemplateCenterRequest request) {
        String validationMessage = validateRequest(request);
        if (validationMessage != null) {
            return ResponseEntity.badRequest().body(Map.of("message", validationMessage));
        }
        TemplateCenterItem item = new TemplateCenterItem();
        applyRequest(item, request);
        templateCenterItemService.save(item);
        return ResponseEntity.ok(toAdminMap(item));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTemplate(@PathVariable Long id, @RequestBody AdminTemplateCenterRequest request) {
        TemplateCenterItem item = templateCenterItemService.getById(id);
        if (item == null) {
            return ResponseEntity.notFound().build();
        }
        String validationMessage = validateRequest(request);
        if (validationMessage != null) {
            return ResponseEntity.badRequest().body(Map.of("message", validationMessage));
        }
        applyRequest(item, request);
        templateCenterItemService.updateById(item);
        return ResponseEntity.ok(toAdminMap(templateCenterItemService.getById(id)));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteTemplate(@PathVariable Long id) {
        TemplateCenterItem item = templateCenterItemService.getById(id);
        if (item == null) {
            return ResponseEntity.notFound().build();
        }
        templateDownloadRecordService.remove(new QueryWrapper<TemplateDownloadRecord>().eq("template_id", id));
        templateCenterItemService.removeById(id);
        return ResponseEntity.ok(Map.of("message", "模板已删除"));
    }

    private String validateRequest(AdminTemplateCenterRequest request) {
        if (normalizeText(request.getTitle()) == null) {
            return "模板标题不能为空";
        }
        if (!TemplateCenterCatalog.isValidIndustryCategory(normalizeText(request.getIndustryCategory()))) {
            return "请选择有效的行业分类";
        }
        if (!TemplateCenterCatalog.isValidDifficultyLevel(normalizeText(request.getDifficultyLevel()))) {
            return "请选择有效的难度等级";
        }
        if (request.getDownloadCostPoints() != null && request.getDownloadCostPoints() < 0) {
            return "下载积分不能小于 0";
        }
        return null;
    }

    private void applyRequest(TemplateCenterItem item, AdminTemplateCenterRequest request) {
        item.setTitle(normalizeText(request.getTitle()));
        item.setIndustryCategory(normalizeText(request.getIndustryCategory()));
        item.setUseScenario(normalizeText(request.getUseScenario()));
        item.setPreviewImageUrl(normalizeText(request.getPreviewImageUrl()));
        item.setTemplateDescription(normalizeText(request.getTemplateDescription()));
        item.setFunctionsUsed(toFunctionsJson(request.getFunctionsUsed()));
        item.setDifficultyLevel(normalizeText(request.getDifficultyLevel()));
        item.setDownloadCostPoints(request.getDownloadCostPoints() == null ? 0 : Math.max(0, request.getDownloadCostPoints()));
        item.setTemplateFileUrl(normalizeText(request.getTemplateFileUrl()));
        item.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        item.setEnabled(request.getEnabled() == null || Boolean.TRUE.equals(request.getEnabled()));
    }

    private Map<String, Object> toAdminMap(TemplateCenterItem item) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", item.getId());
        response.put("title", defaultString(item.getTitle()));
        response.put("industryCategory", defaultString(item.getIndustryCategory()));
        response.put("useScenario", defaultString(item.getUseScenario()));
        response.put("previewImageUrl", defaultString(item.getPreviewImageUrl()));
        response.put("templateDescription", defaultString(item.getTemplateDescription()));
        response.put("functionsUsed", parseFunctionsUsed(item.getFunctionsUsed()));
        response.put("difficultyLevel", defaultString(item.getDifficultyLevel()));
        response.put("downloadCostPoints", item.getDownloadCostPoints() == null ? 0 : item.getDownloadCostPoints());
        response.put("templateFileUrl", defaultString(item.getTemplateFileUrl()));
        response.put("sortOrder", item.getSortOrder() == null ? 0 : item.getSortOrder());
        response.put("enabled", Boolean.TRUE.equals(item.getEnabled()));
        response.put("downloadCount", templateDownloadRecordService.count(new QueryWrapper<TemplateDownloadRecord>().eq("template_id", item.getId())));
        response.put("updateTime", item.getUpdateTime());
        return response;
    }

    private List<String> parseFunctionsUsed(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(value, new TypeReference<List<String>>() {});
        } catch (Exception exception) {
            log.debug("Template functions metadata is not JSON, fallback to raw value: {}", value, exception);
            return List.of(value);
        }
    }

    private String toFunctionsJson(List<String> values) {
        List<String> normalized = values == null
                ? List.of()
                : values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .distinct()
                .toList();
        try {
            return objectMapper.writeValueAsString(normalized);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("函数列表保存失败");
        }
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }
}
