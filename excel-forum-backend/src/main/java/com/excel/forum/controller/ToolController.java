package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.DocumentConversionRecord;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.FormulaExplainRequest;
import com.excel.forum.service.DocumentConversionService;
import com.excel.forum.service.DocumentConversionRecordService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.FormulaExplainService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import com.excel.forum.service.ToolBillingService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

import static com.excel.forum.util.QueryPageUtils.limit;

@RestController
@RequestMapping("/api/tools")
@RequiredArgsConstructor
public class ToolController {
    private static final int CONVERSION_COST_POINTS = 5;

    private final DocumentConversionService documentConversionService;
    private final DocumentConversionRecordService documentConversionRecordService;
    private final UserService userService;
    private final RateLimitService rateLimitService;
    private final FileStorageService fileStorageService;
    private final FormulaExplainService formulaExplainService;
    private final ToolBillingService toolBillingService;

    @GetMapping("/overview")
    public ResponseEntity<?> getToolOverview(@RequestAttribute(value = "userId", required = false) Long userId) {
        User user = userId == null ? null : userService.getById(userId);
        Map<String, Object> response = new HashMap<>();
        response.put("conversionCostPoints", CONVERSION_COST_POINTS);
        if (user == null) {
            response.put("user", null);
        } else {
            response.put("user", Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "points", safeInt(user.getPoints())
            ));
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/formula/explain")
    public ResponseEntity<?> explainFormula(
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestBody FormulaExplainRequest request) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "请先登录"));
        }
        ResponseEntity<?> minuteLimit = toLimitResponse(rateLimitService.check(
                "tools:formula:explain:10m:" + userId,
                20,
                Duration.ofMinutes(10),
                "公式解释过于频繁，请稍后再试"
        ));
        if (minuteLimit != null) {
            return minuteLimit;
        }
        ResponseEntity<?> dailyLimit = toLimitResponse(rateLimitService.check(
                "tools:formula:explain:day:" + userId + ":" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE),
                100,
                Duration.ofDays(1),
                "今日公式解释额度已用完，请明天再来"
        ));
        if (dailyLimit != null) {
            return dailyLimit;
        }
        try {
            return ResponseEntity.ok(formulaExplainService.explain(userId, request));
        } catch (IllegalArgumentException e) {
            int status = "请先登录".equals(e.getMessage()) ? 401 : e.getMessage() != null && e.getMessage().contains("积分不足") ? 402 : 400;
            return ResponseEntity.status(status).body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(502).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/formula/history")
    public ResponseEntity<?> getFormulaHistory(
            @RequestAttribute Long userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(formulaExplainService.history(userId, page, size));
    }

    @GetMapping("/formula/history/{id}")
    public ResponseEntity<?> getFormulaHistoryDetail(@RequestAttribute Long userId, @PathVariable Long id) {
        try {
            return ResponseEntity.ok(formulaExplainService.detail(userId, id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/convert")
    @Transactional
    public ResponseEntity<?> convertDocument(
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("targetType") String targetType) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "请先登录"));
        }
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "用户不存在"));
        }
        if (safeInt(user.getPoints()) < CONVERSION_COST_POINTS) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "积分不足，实用功能每次转换需要 " + CONVERSION_COST_POINTS + " 积分",
                    "requiredPoints", CONVERSION_COST_POINTS,
                    "currentPoints", safeInt(user.getPoints())
            ));
        }
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "tools:convert:user:" + userId,
                5,
                Duration.ofMinutes(10),
                "文档转换过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        ToolBillingService.BillingResult billing;
        try {
            billing = toolBillingService.charge(userId, CONVERSION_COST_POINTS, "tool_conversion", "文件转换扣除 " + CONVERSION_COST_POINTS + " 积分");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "积分不足，实用功能每次转换需要 " + CONVERSION_COST_POINTS + " 积分",
                    "requiredPoints", CONVERSION_COST_POINTS,
                    "currentPoints", safeInt(user.getPoints())
            ));
        }
        try {
            Map<String, Object> result = new HashMap<>(documentConversionService.convert(file, targetType));
            User updatedUser = userService.getById(userId);

            DocumentConversionRecord record = new DocumentConversionRecord();
            record.setUserId(userId);
            record.setSourceFileName(file.getOriginalFilename());
            record.setSourceType(String.valueOf(result.get("sourceType")));
            record.setTargetType(String.valueOf(result.get("targetType")));
            record.setResultFileName(String.valueOf(result.get("fileName")));
            record.setResultUrl(String.valueOf(result.get("url")));
            record.setStatus("success");
            documentConversionRecordService.save(record);
            result.put("url", buildConversionDownloadUrl(record.getId()));
            toolBillingService.recordCharge(userId, CONVERSION_COST_POINTS, "tool_conversion", record.getId(), "文件转换扣除 " + CONVERSION_COST_POINTS + " 积分", updatedUser == null ? billing.currentPoints() : safeInt(updatedUser.getPoints()));

            result.put("recordId", record.getId());
            result.put("costPoints", CONVERSION_COST_POINTS);
            result.put("currentPoints", updatedUser == null ? billing.currentPoints() : safeInt(updatedUser.getPoints()));
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException | IllegalStateException e) {
            toolBillingService.refund(userId, CONVERSION_COST_POINTS);
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            toolBillingService.refund(userId, CONVERSION_COST_POINTS);
            throw e;
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getConversionHistory(@RequestAttribute Long userId) {
        List<Map<String, Object>> records = limit(documentConversionRecordService, new QueryWrapper<DocumentConversionRecord>()
                        .eq("user_id", userId)
                        .orderByDesc("create_time"), 12)
                .stream()
                .map(item -> {
                    Map<String, Object> record = new HashMap<>();
                    record.put("id", item.getId());
                    record.put("sourceFileName", item.getSourceFileName());
                    record.put("sourceType", item.getSourceType());
                    record.put("targetType", item.getTargetType());
                    record.put("resultFileName", item.getResultFileName());
                    record.put("resultUrl", buildConversionDownloadUrl(item.getId()));
                    record.put("status", item.getStatus());
                    record.put("createTime", item.getCreateTime());
                    return record;
                })
                .toList();
        return ResponseEntity.ok(Map.of("records", records));
    }

    @GetMapping("/conversions/{recordId}/file")
    public ResponseEntity<?> downloadConversionFile(@RequestAttribute Long userId, @PathVariable Long recordId) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "download:tool-conversion:user:" + userId + ":record:" + recordId,
                20,
                Duration.ofMinutes(1),
                "文件下载过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        DocumentConversionRecord record = documentConversionRecordService.getById(recordId);
        if (record == null || !userId.equals(record.getUserId()) || !"success".equals(record.getStatus())) {
            return ResponseEntity.status(404).body(Map.of("message", "转换记录不存在"));
        }
        byte[] content = fileStorageService.load(record.getResultUrl());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(content.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(record.getResultFileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(new ByteArrayResource(content));
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String buildConversionDownloadUrl(Long recordId) {
        return "/api/tools/conversions/" + recordId + "/file";
    }

    private ResponseEntity<?> toLimitResponse(RateLimitResult result) {
        if (result == null || result.allowed()) {
            return null;
        }
        return ResponseEntity.status(429).body(Map.of(
                "message", result.message(),
                "retryAfterSeconds", result.retryAfterSeconds()
        ));
    }
}
