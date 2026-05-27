package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.TemplateCenterItem;
import com.excel.forum.entity.TemplateDownloadRecord;
import com.excel.forum.entity.dto.AdminTemplateCenterRequest;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.TemplateCenterItemService;
import com.excel.forum.service.TemplateDownloadRecordService;
import com.excel.forum.util.TemplateCenterCatalog;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/templates")
@RequiredArgsConstructor
@Slf4j
public class AdminTemplateCenterController {
    private static final int MAX_BATCH_UPLOAD_FILES = 50;
    private static final long MAX_TEMPLATE_FILE_SIZE = 20L * 1024L * 1024L;

    private final TemplateCenterItemService templateCenterItemService;
    private final TemplateDownloadRecordService templateDownloadRecordService;
    private final ObjectMapper objectMapper;
    private final FileRecycleService fileRecycleService;
    private final FileStorageService fileStorageService;

    @GetMapping
    public ResponseEntity<?> getTemplates(
            @RequestParam(required = false) String industryCategory,
            @RequestParam(required = false) String useScenario,
            @RequestParam(required = false) String difficultyLevel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize) {
        List<TemplateCenterItem> allRecords = listActiveTemplates();
        List<TemplateCenterItem> filteredRecords = filterTemplates(allRecords, industryCategory, useScenario, difficultyLevel, status, keyword);
        int safePageSize = pageSize == null || pageSize < 1 ? filteredRecords.size() : Math.min(pageSize, 100);
        if (safePageSize < 1) {
            safePageSize = 1;
        }
        int pageCount = Math.max(1, (int) Math.ceil(filteredRecords.size() / (double) safePageSize));
        int safePage = page == null ? 1 : Math.min(Math.max(1, page), pageCount);
        int start = Math.min((safePage - 1) * safePageSize, filteredRecords.size());
        int end = Math.min(start + safePageSize, filteredRecords.size());

        List<Map<String, Object>> records = filteredRecords.subList(start, end).stream()
                .map(this::toAdminMap)
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("industryCategories", TemplateCenterCatalog.INDUSTRY_CATEGORIES);
        response.put("difficultyLevels", TemplateCenterCatalog.DIFFICULTY_LEVELS);
        response.put("scenarioOptions", getScenarioOptions(allRecords));
        response.put("records", records);
        response.put("total", filteredRecords.size());
        response.put("page", safePage);
        response.put("pageSize", safePageSize);
        response.put("pageCount", pageCount);
        response.put("stats", buildSummary(allRecords, buildDownloadCountMap(allRecords)));
        response.put("healthItems", buildHealthItems(allRecords));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/operations-report")
    public ResponseEntity<?> getOperationsReport() {
        List<TemplateCenterItem> records = listActiveTemplates();
        Map<Long, Long> downloadCounts = buildDownloadCountMap(records);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", buildSummary(records, downloadCounts));
        response.put("categoryStats", buildGroupedStats(records, downloadCounts, "category"));
        response.put("difficultyStats", buildGroupedStats(records, downloadCounts, "difficulty"));
        response.put("healthItems", buildHealthItems(records));
        response.put("topTemplates", records.stream()
                .sorted(Comparator.comparingLong((TemplateCenterItem item) -> downloadCounts.getOrDefault(item.getId(), 0L)).reversed())
                .limit(5)
                .map(item -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", item.getId());
                    row.put("title", defaultString(item.getTitle()));
                    row.put("industryCategory", defaultString(item.getIndustryCategory()));
                    row.put("useScenario", defaultString(item.getUseScenario()));
                    row.put("downloadCount", downloadCounts.getOrDefault(item.getId(), 0L));
                    row.put("enabled", Boolean.TRUE.equals(item.getEnabled()));
                    return row;
                })
                .toList());
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<?> createTemplate(@Valid @RequestBody AdminTemplateCenterRequest request) {
        String validationMessage = validateRequest(request);
        if (validationMessage != null) {
            return ResponseEntity.badRequest().body(Map.of("message", validationMessage));
        }
        TemplateCenterItem item = new TemplateCenterItem();
        applyRequest(item, request);
        templateCenterItemService.save(item);
        return ResponseEntity.ok(toAdminMap(item));
    }

    @PostMapping(path = "/batch-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> batchUploadTemplates(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(required = false) String industryCategory,
            @RequestParam(required = false) String useScenario,
            @RequestParam(required = false) String difficultyLevel,
            @RequestParam(required = false) Boolean enabled) {
        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择要上传的模板文件"));
        }
        if (files.size() > MAX_BATCH_UPLOAD_FILES) {
            return ResponseEntity.badRequest().body(Map.of("message", "单次最多批量上传 50 个模板"));
        }

        List<TemplateCenterItem> created = new ArrayList<>();
        for (MultipartFile file : files) {
            String validationMessage = validateTemplateFile(file);
            if (validationMessage != null) {
                return ResponseEntity.badRequest().body(Map.of("message", validationMessage));
            }
            String fileUrl = fileStorageService.store(file);
            TemplateCenterItem item = new TemplateCenterItem();
            item.setTitle(titleFromFileName(file.getOriginalFilename()));
            item.setIndustryCategory(resolveBatchIndustry(industryCategory));
            item.setUseScenario(defaultString(normalizeText(useScenario), "批量上传"));
            item.setPreviewImageUrl(null);
            item.setTemplateDescription("批量上传待补充");
            item.setUsageGuide("");
            item.setFunctionsUsed(toJsonList(List.of()));
            item.setTagsJson(toJsonList(List.of()));
            item.setDifficultyLevel(resolveBatchDifficulty(difficultyLevel));
            item.setDownloadCostPoints(0);
            item.setTemplateFileUrl(fileUrl);
            item.setFileName(defaultString(normalizeText(file.getOriginalFilename()), getFileName(fileUrl)));
            item.setFileSize(Math.max(0L, file.getSize()));
            item.setFileVersion("1.0.0");
            item.setLastUploadedAt(LocalDateTime.now());
            item.setSortOrder(0);
            item.setEnabled(Boolean.TRUE.equals(enabled));
            templateCenterItemService.save(item);
            created.add(item);
        }

        return ResponseEntity.ok(Map.of(
                "createdCount", created.size(),
                "records", created.stream().map(this::toAdminMap).toList()
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTemplate(@PathVariable Long id, @Valid @RequestBody AdminTemplateCenterRequest request) {
        TemplateCenterItem item = templateCenterItemService.getById(id);
        if (item == null || item.getDeletedAt() != null) {
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
    public ResponseEntity<?> deleteTemplate(
            @RequestAttribute(value = "userId", required = false) Long adminUserId,
            @PathVariable Long id) {
        TemplateCenterItem item = templateCenterItemService.getById(id);
        if (item == null || item.getDeletedAt() != null) {
            return ResponseEntity.notFound().build();
        }
        fileRecycleService.recycleTemplate(item, adminUserId);
        return ResponseEntity.ok(Map.of("message", "模板已移入回收站"));
    }

    private List<TemplateCenterItem> listActiveTemplates() {
        QueryWrapper<TemplateCenterItem> queryWrapper = new QueryWrapper<>();
        queryWrapper.isNull("deleted_at");
        queryWrapper.orderByAsc("sort_order").orderByAsc("id");
        return templateCenterItemService.list(queryWrapper);
    }

    private List<TemplateCenterItem> filterTemplates(
            List<TemplateCenterItem> records,
            String industryCategory,
            String useScenario,
            String difficultyLevel,
            String status,
            String keyword) {
        String category = normalizeText(industryCategory);
        String scenario = normalizeText(useScenario);
        String difficulty = normalizeText(difficultyLevel);
        String normalizedStatus = normalizeText(status);
        String normalizedKeyword = normalizeText(keyword);
        String lowerKeyword = normalizedKeyword == null ? null : normalizedKeyword.toLowerCase();

        return records.stream()
                .filter(item -> category == null || category.equals(normalizeText(item.getIndustryCategory())))
                .filter(item -> scenario == null || scenario.equals(normalizeText(item.getUseScenario())))
                .filter(item -> difficulty == null || difficulty.equals(normalizeText(item.getDifficultyLevel())))
                .filter(item -> {
                    if ("enabled".equals(normalizedStatus)) return Boolean.TRUE.equals(item.getEnabled());
                    if ("draft".equals(normalizedStatus)) return !Boolean.TRUE.equals(item.getEnabled());
                    return true;
                })
                .filter(item -> lowerKeyword == null || keywordMatches(item, lowerKeyword))
                .toList();
    }

    private boolean keywordMatches(TemplateCenterItem item, String keyword) {
        List<String> values = new ArrayList<>();
        values.add(item.getTitle());
        values.add(item.getIndustryCategory());
        values.add(item.getUseScenario());
        values.add(item.getDifficultyLevel());
        values.add(item.getTemplateDescription());
        values.add(item.getUsageGuide());
        values.add(item.getFileName());
        values.addAll(parseJsonList(resolveTagsJson(item)));
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(String::toLowerCase)
                .anyMatch(value -> value.contains(keyword));
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
        if (request.getFileSize() != null && request.getFileSize() < 0) {
            return "文件大小不能小于 0";
        }
        if (Boolean.TRUE.equals(request.getEnabled()) && normalizeText(request.getTemplateFileUrl()) == null) {
            return "发布模板前请上传源文件";
        }
        return null;
    }

    private void applyRequest(TemplateCenterItem item, AdminTemplateCenterRequest request) {
        String previousFileUrl = normalizeText(item.getTemplateFileUrl());
        String nextFileUrl = normalizeText(request.getTemplateFileUrl());
        List<String> tags = normalizeTags(request.getTags() == null ? request.getFunctionsUsed() : request.getTags());
        String tagsJson = toJsonList(tags);

        item.setTitle(normalizeText(request.getTitle()));
        item.setIndustryCategory(normalizeText(request.getIndustryCategory()));
        item.setUseScenario(normalizeText(request.getUseScenario()));
        item.setPreviewImageUrl(normalizeText(request.getPreviewImageUrl()));
        item.setTemplateDescription(normalizeText(request.getTemplateDescription()));
        item.setUsageGuide(normalizeText(request.getUsageGuide()));
        item.setFunctionsUsed(tagsJson);
        item.setTagsJson(tagsJson);
        item.setDifficultyLevel(normalizeText(request.getDifficultyLevel()));
        item.setDownloadCostPoints(request.getDownloadCostPoints() == null ? 0 : Math.max(0, request.getDownloadCostPoints()));
        item.setTemplateFileUrl(nextFileUrl);
        item.setFileName(defaultString(normalizeText(request.getFileName()), getFileName(nextFileUrl)));
        item.setFileSize(request.getFileSize() == null ? null : Math.max(0L, request.getFileSize()));
        item.setFileVersion(defaultString(normalizeText(request.getFileVersion()), "1.0.0"));
        if (request.getLastUploadedAt() != null) {
            item.setLastUploadedAt(request.getLastUploadedAt());
        } else if (nextFileUrl != null && !nextFileUrl.equals(previousFileUrl)) {
            item.setLastUploadedAt(LocalDateTime.now());
        }
        item.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        item.setEnabled(request.getEnabled() == null || Boolean.TRUE.equals(request.getEnabled()));
    }

    private Map<String, Object> toAdminMap(TemplateCenterItem item) {
        Map<String, Object> response = new LinkedHashMap<>();
        List<String> tags = parseJsonList(resolveTagsJson(item));
        response.put("id", item.getId());
        response.put("title", defaultString(item.getTitle()));
        response.put("industryCategory", defaultString(item.getIndustryCategory()));
        response.put("useScenario", defaultString(item.getUseScenario()));
        response.put("previewImageUrl", defaultString(item.getPreviewImageUrl()));
        response.put("templateDescription", defaultString(item.getTemplateDescription()));
        response.put("usageGuide", defaultString(item.getUsageGuide()));
        response.put("functionsUsed", tags);
        response.put("tags", tags);
        response.put("difficultyLevel", defaultString(item.getDifficultyLevel()));
        response.put("downloadCostPoints", item.getDownloadCostPoints() == null ? 0 : item.getDownloadCostPoints());
        response.put("templateFileUrl", defaultString(item.getTemplateFileUrl()));
        response.put("fileName", defaultString(item.getFileName()));
        response.put("fileSize", item.getFileSize() == null ? 0 : item.getFileSize());
        response.put("fileVersion", defaultString(item.getFileVersion()));
        response.put("lastUploadedAt", formatTime(item.getLastUploadedAt()));
        response.put("sortOrder", item.getSortOrder() == null ? 0 : item.getSortOrder());
        response.put("enabled", Boolean.TRUE.equals(item.getEnabled()));
        response.put("downloadCount", countDownloads(item.getId()));
        response.put("exchangeUserCount", countExchangeUsers(item.getId()));
        response.put("updateTime", formatTime(item.getUpdateTime()));
        return response;
    }

    private Map<Long, Long> buildDownloadCountMap(List<TemplateCenterItem> records) {
        return records.stream().collect(Collectors.toMap(
                TemplateCenterItem::getId,
                item -> countDownloads(item.getId()),
                (left, right) -> left,
                LinkedHashMap::new
        ));
    }

    private Map<String, Object> buildSummary(List<TemplateCenterItem> records, Map<Long, Long> downloadCounts) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", records.size());
        summary.put("enabled", records.stream().filter(item -> Boolean.TRUE.equals(item.getEnabled())).count());
        summary.put("drafts", records.stream().filter(item -> !Boolean.TRUE.equals(item.getEnabled())).count());
        summary.put("downloads", downloadCounts.values().stream().mapToLong(Long::longValue).sum());
        summary.put("missingFiles", records.stream().filter(this::missingFile).count());
        summary.put("missingMetadata", records.stream().filter(this::missingMetadata).count());
        return summary;
    }

    private List<Map<String, Object>> buildHealthItems(List<TemplateCenterItem> records) {
        long missingFiles = records.stream().filter(this::missingFile).count();
        return List.of(
                healthItem("missingFiles", "缺失源文件", missingFiles, missingFiles == 0 ? "正常" : "", missingFiles == 0 ? "" : "处理"),
                healthItem("missingMetadata", "未填写行业/场景", records.stream().filter(this::missingMetadata).count(), "", "去补全"),
                healthItem("drafts", "草稿未发布", records.stream().filter(item -> !Boolean.TRUE.equals(item.getEnabled())).count(), "", "处理")
        );
    }

    private Map<String, Object> healthItem(String key, String label, long count, String statusLabel, String actionLabel) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("key", key);
        item.put("label", label);
        item.put("count", count);
        item.put("statusLabel", statusLabel);
        item.put("actionLabel", actionLabel);
        return item;
    }

    private List<Map<String, Object>> buildGroupedStats(List<TemplateCenterItem> records, Map<Long, Long> downloadCounts, String group) {
        Map<String, List<TemplateCenterItem>> grouped = records.stream().collect(Collectors.groupingBy(
                item -> "difficulty".equals(group)
                        ? defaultString(normalizeText(item.getDifficultyLevel()), "未填写")
                        : defaultString(normalizeText(item.getIndustryCategory()), "未填写"),
                LinkedHashMap::new,
                Collectors.toList()
        ));
        return grouped.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", entry.getKey());
                    row.put("templateCount", entry.getValue().size());
                    row.put("downloadCount", entry.getValue().stream().mapToLong(item -> downloadCounts.getOrDefault(item.getId(), 0L)).sum());
                    return row;
                })
                .toList();
    }

    private List<String> getScenarioOptions(List<TemplateCenterItem> records) {
        return records.stream()
                .map(TemplateCenterItem::getUseScenario)
                .map(this::normalizeText)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private boolean missingFile(TemplateCenterItem item) {
        return normalizeText(item.getTemplateFileUrl()) == null;
    }

    private boolean missingMetadata(TemplateCenterItem item) {
        return normalizeText(item.getIndustryCategory()) == null || normalizeText(item.getUseScenario()) == null;
    }

    private long countDownloads(Long templateId) {
        if (templateId == null) {
            return 0L;
        }
        return templateDownloadRecordService.count(new QueryWrapper<TemplateDownloadRecord>().eq("template_id", templateId));
    }

    private long countExchangeUsers(Long templateId) {
        return countDownloads(templateId);
    }

    private String resolveTagsJson(TemplateCenterItem item) {
        String tagsJson = normalizeText(item.getTagsJson());
        return tagsJson == null ? item.getFunctionsUsed() : tagsJson;
    }

    private List<String> parseJsonList(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(value, new TypeReference<List<String>>() {});
        } catch (Exception exception) {
            log.debug("Template metadata is not JSON, fallback to raw value: {}", value, exception);
            return List.of(value);
        }
    }

    private String toJsonList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(normalizeTags(values));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("模板标签保存失败");
        }
    }

    private List<String> normalizeTags(List<String> values) {
        return values == null
                ? List.of()
                : values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .distinct()
                .limit(30)
                .toList();
    }

    private String validateTemplateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return "模板文件不能为空";
        }
        if (file.getSize() > MAX_TEMPLATE_FILE_SIZE) {
            return "模板文件大小不能超过 20MB";
        }
        String name = defaultString(file.getOriginalFilename()).toLowerCase();
        if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
            return "批量上传仅支持 xlsx / xls 文件";
        }
        return null;
    }

    private String resolveBatchIndustry(String value) {
        String normalized = normalizeText(value);
        return TemplateCenterCatalog.isValidIndustryCategory(normalized) ? normalized : "运营";
    }

    private String resolveBatchDifficulty(String value) {
        String normalized = normalizeText(value);
        return TemplateCenterCatalog.isValidDifficultyLevel(normalized) ? normalized : "基础";
    }

    private String titleFromFileName(String fileName) {
        String normalized = defaultString(normalizeText(fileName), "未命名模板");
        int dot = normalized.lastIndexOf('.');
        return dot > 0 ? normalized.substring(0, dot) : normalized;
    }

    private String getFileName(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.split("\\?")[0].split("#")[0];
        int slash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
        return slash >= 0 ? normalized.substring(slash + 1) : normalized;
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

    private String defaultString(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String formatTime(LocalDateTime value) {
        return value == null ? "" : value.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }
}
