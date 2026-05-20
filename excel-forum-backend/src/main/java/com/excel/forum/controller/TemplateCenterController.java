package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.TemplateCenterItem;
import com.excel.forum.entity.TemplateDownloadRecord;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.TemplateCenterItemService;
import com.excel.forum.service.TemplateDownloadRecordService;
import com.excel.forum.service.UserService;
import com.excel.forum.util.TemplateCenterCatalog;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
@Slf4j
public class TemplateCenterController {
    private final TemplateCenterItemService templateCenterItemService;
    private final TemplateDownloadRecordService templateDownloadRecordService;
    private final UserService userService;
    private final UserMapper userMapper;
    private final PointsRecordService pointsRecordService;
    private final ObjectMapper objectMapper;
    private final FileStorageConfig fileStorageConfig;

    @GetMapping
    public ResponseEntity<?> getTemplates(
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestParam(required = false) String industryCategory) {
        String normalizedCategory = normalizeIndustryCategory(industryCategory);
        List<TemplateCenterItem> allEnabledItems = templateCenterItemService.list(new QueryWrapper<TemplateCenterItem>()
                .eq("enabled", true)
                .isNull("deleted_at")
                .orderByAsc("sort_order")
                .orderByAsc("id"));
        List<TemplateCenterItem> visibleItems = normalizedCategory == null
                ? allEnabledItems
                : allEnabledItems.stream()
                .filter(item -> normalizedCategory.equals(item.getIndustryCategory()))
                .toList();

        Set<Long> downloadedTemplateIds = userId == null
                ? Set.of()
                : templateDownloadRecordService.listByUserId(userId).stream()
                .map(TemplateDownloadRecord::getTemplateId)
                .collect(Collectors.toSet());

        List<Map<String, Object>> categoryStats = TemplateCenterCatalog.INDUSTRY_CATEGORIES.stream()
                .map(category -> Map.<String, Object>of(
                        "key", category,
                        "label", category,
                        "count", allEnabledItems.stream().filter(item -> category.equals(item.getIndustryCategory())).count()
                ))
                .toList();

        List<Map<String, Object>> records = visibleItems.stream()
                .map(item -> toTemplateMap(item, downloadedTemplateIds.contains(item.getId()), false))
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("categories", categoryStats);
        response.put("difficultyLevels", TemplateCenterCatalog.DIFFICULTY_LEVELS);
        response.put("selectedCategory", normalizedCategory == null ? "" : normalizedCategory);
        response.put("records", records);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/records")
    public ResponseEntity<?> getTemplatePurchaseRecords(@RequestAttribute Long userId) {
        List<TemplateDownloadRecord> downloadRecords = templateDownloadRecordService.listByUserId(userId);
        List<Long> templateIds = downloadRecords.stream()
                .map(TemplateDownloadRecord::getTemplateId)
                .distinct()
                .toList();
        Map<Long, TemplateCenterItem> itemMap = templateIds.isEmpty()
                ? Map.of()
                : templateCenterItemService.listByIds(templateIds).stream()
                .collect(Collectors.toMap(TemplateCenterItem::getId, Function.identity(), (left, right) -> left));

        List<Map<String, Object>> records = downloadRecords.stream()
                .map(record -> {
                    TemplateCenterItem item = itemMap.get(record.getTemplateId());
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", record.getId());
                    row.put("templateId", record.getTemplateId());
                    row.put("title", item == null ? "模板已删除" : defaultString(item.getTitle()));
                    row.put("industryCategory", item == null ? "" : defaultString(item.getIndustryCategory()));
                    row.put("useScenario", item == null ? "" : defaultString(item.getUseScenario()));
                    row.put("previewImageUrl", item == null ? "" : defaultString(item.getPreviewImageUrl()));
                    row.put("templateDescription", item == null ? "" : defaultString(item.getTemplateDescription()));
                    row.put("functionsUsed", item == null ? List.of() : parseFunctionsUsed(item.getFunctionsUsed()));
                    row.put("difficultyLevel", item == null ? "" : defaultString(item.getDifficultyLevel()));
                    row.put("templateFileUrl", item == null ? "" : defaultString(item.getTemplateFileUrl()));
                    row.put("downloadUrl", item == null ? "" : buildTemplateDownloadUrl(item.getId()));
                    row.put("hasTemplateFile", item != null && item.getTemplateFileUrl() != null && !item.getTemplateFileUrl().isBlank());
                    row.put("pointsCost", safeInt(record.getPointsCost()));
                    row.put("createTime", record.getCreateTime());
                    return row;
                })
                .toList();

        int totalSpentPoints = downloadRecords.stream()
                .map(TemplateDownloadRecord::getPointsCost)
                .filter(points -> points != null && points > 0)
                .mapToInt(Integer::intValue)
                .sum();

        return ResponseEntity.ok(Map.of(
                "records", records,
                "totalDownloads", downloadRecords.size(),
                "totalSpentPoints", totalSpentPoints
        ));
    }

    @PostMapping("/{id}/download")
    @Transactional
    public ResponseEntity<?> downloadTemplate(@RequestAttribute Long userId, @PathVariable Long id) {
        TemplateCenterItem item = templateCenterItemService.getById(id);
        if (item == null || item.getDeletedAt() != null || !Boolean.TRUE.equals(item.getEnabled())) {
            return ResponseEntity.status(404).body(Map.of("message", "模板不存在"));
        }
        if (item.getTemplateFileUrl() == null || item.getTemplateFileUrl().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "当前模板尚未上传下载文件"));
        }
        if (resolveReadableTemplateFile(item.getTemplateFileUrl()) == null) {
            return ResponseEntity.status(404).body(Map.of("message", "模板文件不存在，请联系管理员重新上传"));
        }
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "用户不存在"));
        }

        if (templateDownloadRecordService.hasDownloaded(userId, id)) {
            return ResponseEntity.ok(Map.of(
                    "url", buildTemplateDownloadUrl(item.getId()),
                    "deductedPoints", 0,
                    "currentPoints", safeInt(user.getPoints()),
                    "downloaded", true
            ));
        }

        int costPoints = Math.max(0, safeInt(item.getDownloadCostPoints()));
        if (costPoints > 0) {
            int deducted = userMapper.deductPoints(userId, costPoints);
            if (deducted == 0) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "积分不足，下载该模板需要 " + costPoints + " 积分",
                        "requiredPoints", costPoints,
                        "currentPoints", safeInt(user.getPoints())
                ));
            }
        }

        TemplateDownloadRecord downloadRecord = new TemplateDownloadRecord();
        downloadRecord.setUserId(userId);
        downloadRecord.setTemplateId(id);
        downloadRecord.setPointsCost(costPoints);
        templateDownloadRecordService.save(downloadRecord);

        if (costPoints > 0) {
            User updatedUser = userService.getById(userId);
            PointsRecord pointsRecord = new PointsRecord();
            pointsRecord.setUserId(userId);
            pointsRecord.setRuleName("模板下载");
            pointsRecord.setTaskKey("template_download");
            pointsRecord.setBizId(id);
            pointsRecord.setChange(-costPoints);
            pointsRecord.setBalance(updatedUser == null ? 0 : safeInt(updatedUser.getPoints()));
            pointsRecord.setDescription("下载模板：" + item.getTitle());
            pointsRecord.setCreateTime(LocalDateTime.now());
            pointsRecordService.save(pointsRecord);
        }

        User updatedUser = userService.getById(userId);
        return ResponseEntity.ok(Map.of(
                "url", buildTemplateDownloadUrl(item.getId()),
                "deductedPoints", costPoints,
                "currentPoints", updatedUser == null ? 0 : safeInt(updatedUser.getPoints()),
                "downloaded", true
        ));
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<?> downloadTemplateFile(@RequestAttribute Long userId, @PathVariable Long id) {
        TemplateCenterItem item = templateCenterItemService.getById(id);
        if (item == null || item.getDeletedAt() != null || !Boolean.TRUE.equals(item.getEnabled())) {
            return ResponseEntity.status(404).body(Map.of("message", "模板不存在"));
        }
        if (item.getTemplateFileUrl() == null || item.getTemplateFileUrl().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "当前模板尚未上传下载文件"));
        }
        if (!templateDownloadRecordService.hasDownloaded(userId, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "请先下载该模板"));
        }

        Path filePath = resolveReadableTemplateFile(item.getTemplateFileUrl());
        if (filePath == null) {
            return ResponseEntity.status(404).body(Map.of("message", "模板文件不存在，请联系管理员重新上传"));
        }

        Resource resource = new FileSystemResource(filePath);
        String fileName = filePath.getFileName().toString();
        MediaType contentType = resolveMediaType(fileName);
        long contentLength = safeFileSize(filePath);
        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(fileName, StandardCharsets.UTF_8)
                        .build()
                        .toString());
        if (contentLength >= 0) {
            response.contentLength(contentLength);
        }
        return response.body(resource);
    }

    private Map<String, Object> toTemplateMap(TemplateCenterItem item, boolean downloaded, boolean includeFileUrl) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", item.getId());
        response.put("title", defaultString(item.getTitle()));
        response.put("industryCategory", defaultString(item.getIndustryCategory()));
        response.put("useScenario", defaultString(item.getUseScenario()));
        response.put("previewImageUrl", defaultString(item.getPreviewImageUrl()));
        response.put("templateDescription", defaultString(item.getTemplateDescription()));
        response.put("functionsUsed", parseFunctionsUsed(item.getFunctionsUsed()));
        response.put("difficultyLevel", defaultString(item.getDifficultyLevel()));
        response.put("downloadCostPoints", safeInt(item.getDownloadCostPoints()));
        response.put("hasTemplateFile", item.getTemplateFileUrl() != null && !item.getTemplateFileUrl().isBlank());
        response.put("downloaded", downloaded);
        response.put("updateTime", item.getUpdateTime());
        if (includeFileUrl) {
            response.put("templateFileUrl", defaultString(item.getTemplateFileUrl()));
        }
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

    private String normalizeIndustryCategory(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (!TemplateCenterCatalog.isValidIndustryCategory(normalized)) {
            return null;
        }
        return normalized;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }

    private String buildTemplateDownloadUrl(Long templateId) {
        return templateId == null ? "" : "/api/templates/" + templateId + "/file";
    }

    private Path resolveLocalTemplateFile(String fileUrl) {
        String pathValue = extractPath(fileUrl);
        if (pathValue == null) {
            return null;
        }
        String urlPrefix = normalizeUrlPrefix(fileStorageConfig.getLocal().getUrlPrefix());
        if (!pathValue.equals(urlPrefix) && !pathValue.startsWith(urlPrefix + "/")) {
            return null;
        }
        String relativePath = pathValue.substring(urlPrefix.length());
        if (relativePath.startsWith("/")) {
            relativePath = relativePath.substring(1);
        }
        if (relativePath.isBlank()) {
            return null;
        }
        String decodedPath = URLDecoder.decode(relativePath, StandardCharsets.UTF_8);
        Path uploadRoot = Paths.get(fileStorageConfig.getLocal().getPath()).toAbsolutePath().normalize();
        Path resolvedPath = uploadRoot.resolve(decodedPath).normalize();
        return resolvedPath.startsWith(uploadRoot) ? resolvedPath : null;
    }

    private Path resolveReadableTemplateFile(String fileUrl) {
        Path filePath = resolveLocalTemplateFile(fileUrl);
        if (filePath == null || !Files.isRegularFile(filePath) || !Files.isReadable(filePath)) {
            return null;
        }
        return filePath;
    }

    private String extractPath(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return null;
        }
        String value = fileUrl.trim();
        if (value.startsWith("http://") || value.startsWith("https://")) {
            try {
                return URI.create(value).getPath();
            } catch (IllegalArgumentException exception) {
                log.debug("Invalid template file URL: {}", value, exception);
                return null;
            }
        }
        return value.startsWith("/") ? value : "/" + value;
    }

    private String normalizeUrlPrefix(String value) {
        String prefix = value == null || value.isBlank() ? "/uploads" : value.trim();
        if (!prefix.startsWith("/")) {
            prefix = "/" + prefix;
        }
        while (prefix.endsWith("/") && prefix.length() > 1) {
            prefix = prefix.substring(0, prefix.length() - 1);
        }
        return prefix;
    }

    private MediaType resolveMediaType(String fileName) {
        String lowerName = fileName == null ? "" : fileName.toLowerCase();
        if (lowerName.endsWith(".xlsx")) {
            return MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        }
        if (lowerName.endsWith(".xls")) {
            return MediaType.parseMediaType("application/vnd.ms-excel");
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    private long safeFileSize(Path filePath) {
        try {
            return Files.size(filePath);
        } catch (Exception exception) {
            log.debug("Failed to read template file size: {}", filePath, exception);
            return -1;
        }
    }
}
