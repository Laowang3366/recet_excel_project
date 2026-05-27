package com.excel.forum.controller;

import com.excel.forum.entity.AiAssistantConfig;
import com.excel.forum.entity.dto.AdminAiAssistantConfigRequest;
import com.excel.forum.entity.dto.AdminAiAssistantDefaultPromptRequest;
import com.excel.forum.entity.dto.AdminAiAssistantModelRequest;
import com.excel.forum.entity.dto.AdminAiAssistantTestRequest;
import com.excel.forum.service.AiAssistantCallLogService;
import com.excel.forum.service.AiAssistantConfigService;
import com.excel.forum.service.AiCompletionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
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

import java.time.LocalDate;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/assistant")
@RequiredArgsConstructor
public class AdminAssistantController {
    private static final Set<String> REASONING_EFFORT_VALUES = Set.of("low", "medium", "high");
    private static final int DEFAULT_TIMEOUT_MS = 60000;
    private static final int MIN_TIMEOUT_MS = 1000;
    private static final int MAX_TIMEOUT_MS = 3600000;
    private static final int MIN_TIMEOUT_MINUTES = 1;
    private static final int MAX_TIMEOUT_MINUTES = 60;
    private static final int MIN_MAX_RETRIES = 0;
    private static final int MAX_MAX_RETRIES = 10;

    private final AiAssistantConfigService aiAssistantConfigService;
    private final AiAssistantCallLogService aiAssistantCallLogService;
    private final AiCompletionService aiCompletionService;

    @GetMapping("/configs")
    public ResponseEntity<?> getConfigs() {
        return ResponseEntity.ok(Map.of("records", aiAssistantConfigService.listAdminConfigs()));
    }

    @GetMapping("/configs/{id}/api-key")
    public ResponseEntity<?> getConfigApiKey(@PathVariable Long id) {
        AiAssistantConfig config = aiAssistantConfigService.getById(id);
        if (config == null) {
            return ResponseEntity.notFound().build();
        }
        String apiKey = normalizeText(config.getApiKey());
        return ResponseEntity.ok(Map.of(
                "apiKey", apiKey == null ? "" : apiKey,
                "hasApiKey", apiKey != null
        ));
    }

    @PostMapping("/configs")
    @Transactional
    public ResponseEntity<?> createConfig(@RequestBody AdminAiAssistantConfigRequest request, HttpServletRequest servletRequest) {
        String validationMessage = validateRequest(request, true);
        if (validationMessage != null) {
            return ResponseEntity.badRequest().body(Map.of("message", validationMessage));
        }
        AiAssistantConfig config = new AiAssistantConfig();
        applyRequest(config, request, true);
        config.setCreatedBy((Long) servletRequest.getAttribute("userId"));
        aiAssistantConfigService.save(config);
        if (Boolean.TRUE.equals(request.getActive())) {
            aiAssistantConfigService.activate(config.getId());
        }
        return ResponseEntity.ok(Map.of("record", aiAssistantConfigService.listAdminConfigs().stream()
                .filter(item -> config.getId().equals(item.get("id")))
                .findFirst()
                .orElse(Map.of())));
    }

    @PutMapping("/configs/{id}")
    @Transactional
    public ResponseEntity<?> updateConfig(@PathVariable Long id, @RequestBody AdminAiAssistantConfigRequest request) {
        AiAssistantConfig config = aiAssistantConfigService.getById(id);
        if (config == null) {
            return ResponseEntity.notFound().build();
        }
        String validationMessage = validateRequest(request, false);
        if (validationMessage != null) {
            return ResponseEntity.badRequest().body(Map.of("message", validationMessage));
        }
        applyRequest(config, request, false);
        aiAssistantConfigService.updateById(config);
        if (Boolean.TRUE.equals(request.getActive())) {
            aiAssistantConfigService.activate(id);
        }
        return ResponseEntity.ok(Map.of("message", "AI 助手配置已更新"));
    }

    @PutMapping("/configs/{id}/activate")
    public ResponseEntity<?> activateConfig(@PathVariable Long id) {
        aiAssistantConfigService.activate(id);
        return ResponseEntity.ok(Map.of("message", "AI 助手配置已生效"));
    }

    @DeleteMapping("/configs/{id}")
    public ResponseEntity<?> deleteConfig(@PathVariable Long id) {
        if (!aiAssistantConfigService.removeById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("message", "AI 助手配置已删除"));
    }

    @GetMapping("/default-prompt")
    public ResponseEntity<?> getDefaultPrompt() {
        return ResponseEntity.ok(aiAssistantConfigService.getDefaultPrompt());
    }

    @PutMapping("/default-prompt")
    public ResponseEntity<?> saveDefaultPrompt(@RequestBody AdminAiAssistantDefaultPromptRequest request) {
        if (request == null || isBlank(request.getSystemPrompt())) {
            return ResponseEntity.badRequest().body(Map.of("message", "system prompt 内容不能为空"));
        }
        return ResponseEntity.ok(aiAssistantConfigService.saveDefaultPrompt(
                request.getPromptFileName(),
                request.getSystemPrompt()
        ));
    }

    @PostMapping("/models")
    public ResponseEntity<?> fetchModels(@RequestBody AdminAiAssistantModelRequest request) {
        return ResponseEntity.ok(Map.of("models", aiAssistantConfigService.fetchModels(
                request == null ? null : request.getConfigId(),
                request == null ? null : request.getBaseUrl(),
                request == null ? null : request.getApiKey(),
                request == null ? null : request.getUseSubmittedApiKey()
        )));
    }

    @PostMapping("/test-call")
    public ResponseEntity<?> testCall(@RequestBody AdminAiAssistantTestRequest request) {
        String validationMessage = validateTestRequest(request);
        if (validationMessage != null) {
            return ResponseEntity.badRequest().body(Map.of("message", validationMessage));
        }
        AiAssistantConfig config = buildTestConfig(request);
        long startedAt = System.currentTimeMillis();
        AiCompletionService.Result result = aiCompletionService.completeWithConfig(config, new AiCompletionService.Request(
                null,
                request.getTestQuestion().trim(),
                java.util.List.of(),
                1200,
                0.2
        ));
        long latencyMs = Math.max(0L, System.currentTimeMillis() - startedAt);
        return ResponseEntity.ok(Map.of(
                "answer", result.answer(),
                "model", result.model(),
                "fallbackUsed", result.fallbackUsed(),
                "configId", result.configId() == null ? "" : result.configId(),
                "latencyMs", latencyMs
        ));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") Long page,
            @RequestParam(defaultValue = "10") Long size) {
        return ResponseEntity.ok(aiAssistantCallLogService.getUserStats(startDate, endDate, keyword, page, size));
    }

    @GetMapping("/stats/users/{userId}")
    public ResponseEntity<?> getUserDetail(
            @PathVariable Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "1") Long page,
            @RequestParam(defaultValue = "10") Long size) {
        return ResponseEntity.ok(aiAssistantCallLogService.getUserDetail(userId, startDate, endDate, page, size));
    }

    @GetMapping("/stats/users/{userId}/raw-logs")
    public ResponseEntity<?> getUserRawLogs(
            @PathVariable Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "1") Long page,
            @RequestParam(defaultValue = "10") Long size) {
        return ResponseEntity.ok(aiAssistantCallLogService.getUserRawLogs(userId, startDate, endDate, page, size));
    }

    private String validateRequest(AdminAiAssistantConfigRequest request, boolean creating) {
        if (request == null) {
            return "请求参数不能为空";
        }
        if (isBlank(request.getName())) {
            return "配置名称不能为空";
        }
        if (isBlank(request.getBaseUrl())) {
            return "URL 不能为空";
        }
        if (creating && isBlank(request.getApiKey())) {
            return "SK 密钥不能为空";
        }
        if (isBlank(request.getModel())) {
            return "模型不能为空";
        }
        if (!isBlank(request.getReasoningEffort()) && !REASONING_EFFORT_VALUES.contains(request.getReasoningEffort().trim().toLowerCase())) {
            return "推理等级不支持";
        }
        if (request.getMaxRetries() != null
                && (request.getMaxRetries() < MIN_MAX_RETRIES || request.getMaxRetries() > MAX_MAX_RETRIES)) {
            return "最大重试次数需在 0 到 10 之间";
        }
        if (request.getTimeoutMinutes() != null
                && (request.getTimeoutMinutes() < MIN_TIMEOUT_MINUTES || request.getTimeoutMinutes() > MAX_TIMEOUT_MINUTES)) {
            return "模型超时时间需在 1 分钟到 60 分钟之间";
        }
        if (request.getTimeoutMinutes() == null
                && request.getTimeoutMs() != null
                && (request.getTimeoutMs() < MIN_TIMEOUT_MS || request.getTimeoutMs() > MAX_TIMEOUT_MS)) {
            return "模型超时时间需在 1 秒到 3600 秒之间";
        }
        if (Boolean.TRUE.equals(request.getActive()) && Boolean.FALSE.equals(request.getEnabled())) {
            return "生效配置必须保持启用";
        }
        return null;
    }

    private String validateTestRequest(AdminAiAssistantTestRequest request) {
        if (request == null) {
            return "请求参数不能为空";
        }
        if (isBlank(request.getTestQuestion())) {
            return "测试问题不能为空";
        }
        if (isBlank(request.getBaseUrl()) && request.getConfigId() == null) {
            return "URL 不能为空";
        }
        if (isBlank(request.getModel()) && request.getConfigId() == null) {
            return "模型不能为空";
        }
        if (isBlank(request.getApiKey()) && request.getConfigId() == null) {
            return "SK 密钥不能为空";
        }
        if (!isBlank(request.getReasoningEffort()) && !REASONING_EFFORT_VALUES.contains(request.getReasoningEffort().trim().toLowerCase())) {
            return "推理等级不支持";
        }
        if (request.getMaxRetries() != null
                && (request.getMaxRetries() < MIN_MAX_RETRIES || request.getMaxRetries() > MAX_MAX_RETRIES)) {
            return "最大重试次数需在 0 到 10 之间";
        }
        if (request.getTimeoutMinutes() != null
                && (request.getTimeoutMinutes() < MIN_TIMEOUT_MINUTES || request.getTimeoutMinutes() > MAX_TIMEOUT_MINUTES)) {
            return "模型超时时间需在 1 分钟到 60 分钟之间";
        }
        if (request.getTimeoutMinutes() == null
                && request.getTimeoutMs() != null
                && (request.getTimeoutMs() < MIN_TIMEOUT_MS || request.getTimeoutMs() > MAX_TIMEOUT_MS)) {
            return "模型超时时间需在 1 秒到 3600 秒之间";
        }
        return null;
    }

    private AiAssistantConfig buildTestConfig(AdminAiAssistantTestRequest request) {
        AiAssistantConfig stored = request.getConfigId() == null ? null : aiAssistantConfigService.getById(request.getConfigId());
        if (request.getConfigId() != null && stored == null) {
            throw new IllegalArgumentException("AI 助手配置不存在");
        }
        AiAssistantConfig config = new AiAssistantConfig();
        if (stored != null) {
            config.setId(stored.getId());
        }
        config.setBaseUrl(firstText(request.getBaseUrl(), stored == null ? null : stored.getBaseUrl()));
        config.setApiKey(firstApiKey(request.getApiKey(), stored == null ? null : stored.getApiKey()));
        config.setModel(firstText(request.getModel(), stored == null ? null : stored.getModel()));
        config.setBackupModel(firstText(request.getBackupModel(), stored == null ? null : stored.getBackupModel()));
        config.setMaxRetries(request.getMaxRetries() == null
                ? normalizeMaxRetries(stored == null ? null : stored.getMaxRetries())
                : normalizeMaxRetries(request.getMaxRetries()));
        config.setReasoningEffort(firstText(request.getReasoningEffort(), stored == null ? null : stored.getReasoningEffort()));
        config.setTimeoutMs(request.getTimeoutMinutes() != null || request.getTimeoutMs() != null
                ? resolveTimeoutMs(request)
                : normalizeTimeoutMs(stored == null ? null : stored.getTimeoutMs()));
        config.setSystemPrompt(firstText(request.getSystemPrompt(), stored == null ? null : stored.getSystemPrompt()));
        return config;
    }

    private void applyRequest(AiAssistantConfig config, AdminAiAssistantConfigRequest request, boolean creating) {
        config.setName(normalizeText(request.getName()));
        config.setBaseUrl(normalizeBaseUrl(request.getBaseUrl()));
        if (creating || !isBlank(request.getApiKey())) {
            config.setApiKey(request.getApiKey().trim());
        }
        config.setModel(normalizeText(request.getModel()));
        config.setBackupModel(normalizeText(request.getBackupModel()));
        config.setMaxRetries(normalizeMaxRetries(request.getMaxRetries()));
        config.setReasoningEffort(normalizeReasoningEffort(request.getReasoningEffort()));
        config.setTimeoutMs(resolveTimeoutMs(request));
        config.setSystemPrompt(normalizeText(request.getSystemPrompt()));
        config.setPromptFileName(normalizeText(request.getPromptFileName()));
        config.setEnabled(request.getEnabled() == null || Boolean.TRUE.equals(request.getEnabled()));
        if (Boolean.FALSE.equals(config.getEnabled())) {
            config.setActive(false);
        } else {
            config.setActive(Boolean.TRUE.equals(request.getActive()));
        }
        config.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
    }

    private String normalizeBaseUrl(String value) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.replaceAll("/+$", "");
        if (normalized.endsWith("/chat/completions")) {
            normalized = normalized.substring(0, normalized.length() - "/chat/completions".length());
        }
        return normalized;
    }

    private String normalizeReasoningEffort(String value) {
        String normalized = normalizeText(value);
        return normalized == null ? null : normalized.toLowerCase();
    }

    private Integer resolveTimeoutMs(AdminAiAssistantConfigRequest request) {
        if (request.getTimeoutMinutes() != null) {
            return request.getTimeoutMinutes() * 60 * 1000;
        }
        return normalizeTimeoutMs(request.getTimeoutMs());
    }

    private Integer normalizeTimeoutMs(Integer value) {
        if (value == null) {
            return DEFAULT_TIMEOUT_MS;
        }
        return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, value));
    }

    private Integer normalizeMaxRetries(Integer value) {
        if (value == null) {
            return 0;
        }
        return Math.min(MAX_MAX_RETRIES, Math.max(MIN_MAX_RETRIES, value));
    }

    private String firstText(String primary, String fallback) {
        String normalizedPrimary = normalizeText(primary);
        return normalizedPrimary == null ? normalizeText(fallback) : normalizedPrimary;
    }

    private String firstApiKey(String submitted, String stored) {
        String normalizedSubmitted = normalizeText(submitted);
        if (normalizedSubmitted == null || normalizedSubmitted.contains("****") || normalizedSubmitted.matches("^[*•●]+$")) {
            return normalizeText(stored);
        }
        return normalizedSubmitted;
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
