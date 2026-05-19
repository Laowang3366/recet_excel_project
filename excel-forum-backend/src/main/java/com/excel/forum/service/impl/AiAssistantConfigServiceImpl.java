package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.AiAssistantConfig;
import com.excel.forum.mapper.AiAssistantConfigMapper;
import com.excel.forum.service.AiAssistantConfigService;
import com.excel.forum.service.AiAssistantPromptProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static com.excel.forum.util.QueryPageUtils.first;

@Service
@Slf4j
@RequiredArgsConstructor
public class AiAssistantConfigServiceImpl extends ServiceImpl<AiAssistantConfigMapper, AiAssistantConfig> implements AiAssistantConfigService {
    private static final Set<String> REASONING_EFFORT_VALUES = Set.of("low", "medium", "high");
    private static final int DEFAULT_TIMEOUT_MS = 60000;
    private static final int MIN_TIMEOUT_MS = 60000;
    private static final int MAX_TIMEOUT_MS = 3600000;
    private static final int MIN_TIMEOUT_MINUTES = 1;
    private static final int MAX_TIMEOUT_MINUTES = 60;

    private final ObjectMapper objectMapper;
    private final Environment environment;
    private final AiAssistantPromptProvider promptProvider;

    @Override
    public List<Map<String, Object>> listAdminConfigs() {
        ensureDefaultConfig();
        return list(new QueryWrapper<AiAssistantConfig>().orderByDesc("active").orderByAsc("sort_order").orderByDesc("id"))
                .stream()
                .map(this::toAdminMap)
                .toList();
    }

    @Override
    public AiAssistantConfig getActiveConfig() {
        ensureDefaultConfig();
        return first(this, new QueryWrapper<AiAssistantConfig>()
                .eq("active", true)
                .eq("enabled", true)
                .orderByAsc("sort_order")
                .orderByDesc("id"));
    }

    @Override
    @Transactional
    public void ensureDefaultConfig() {
        if (count() > 0) {
            return;
        }
        if (!environment.getProperty("AI_ASSISTANT_ENABLED", Boolean.class, false)) {
            return;
        }

        String baseUrl = normalizeBaseUrl(environment.getProperty("AI_ASSISTANT_BASE_URL"));
        String apiKey = trimToNull(environment.getProperty("AI_ASSISTANT_API_KEY"));
        String model = trimToNull(environment.getProperty("AI_ASSISTANT_MODEL"));
        if (baseUrl == null || apiKey == null || model == null) {
            log.warn("AI assistant default config skipped because environment config is incomplete");
            return;
        }

        AiAssistantConfig config = new AiAssistantConfig();
        config.setName(defaultIfBlank(environment.getProperty("AI_ASSISTANT_CONFIG_NAME"), "默认配置"));
        config.setBaseUrl(baseUrl);
        config.setApiKey(apiKey);
        config.setModel(model);
        config.setReasoningEffort(normalizeReasoningEffort(environment.getProperty("AI_ASSISTANT_REASONING_EFFORT")));
        config.setTimeoutMs(environmentTimeoutMs());
        AiAssistantPromptProvider.PromptSource defaultPrompt = promptProvider.getDefaultPrompt();
        config.setSystemPrompt(defaultPrompt.content());
        config.setPromptFileName(defaultPrompt.fileName());
        config.setEnabled(true);
        config.setActive(true);
        config.setSortOrder(environment.getProperty("AI_ASSISTANT_SORT_ORDER", Integer.class, -1000));
        save(config);
        log.info("AI assistant default config initialized from environment");
    }

    @Override
    public Map<String, Object> getDefaultPrompt() {
        AiAssistantPromptProvider.PromptSource promptSource = promptProvider.getDefaultPrompt();
        return toPromptMap(promptSource);
    }

    @Override
    public Map<String, Object> saveDefaultPrompt(String promptFileName, String systemPrompt) {
        AiAssistantPromptProvider.PromptSource promptSource = promptProvider.saveDefaultPrompt(promptFileName, systemPrompt);
        return toPromptMap(promptSource);
    }

    private Map<String, Object> toPromptMap(AiAssistantPromptProvider.PromptSource promptSource) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("promptFileName", promptSource.fileName());
        map.put("systemPrompt", promptSource.content());
        return map;
    }

    @Override
    @Transactional
    public void activate(Long id) {
        AiAssistantConfig config = getById(id);
        if (config == null) {
            throw new IllegalArgumentException("AI 助手配置不存在");
        }
        if (Boolean.FALSE.equals(config.getEnabled())) {
            throw new IllegalArgumentException("请先启用该配置");
        }
        update(new UpdateWrapper<AiAssistantConfig>().set("active", false));
        config.setActive(true);
        updateById(config);
    }

    @Override
    public List<String> fetchModels(Long configId, String baseUrl, String apiKey, Boolean useSubmittedApiKey) {
        AiAssistantConfig stored = configId == null ? null : getById(configId);
        String resolvedBaseUrl = normalizeBaseUrl(firstText(baseUrl, stored == null ? null : stored.getBaseUrl()));
        String submittedApiKey = normalizeSubmittedApiKey(apiKey);
        String resolvedApiKey = Boolean.TRUE.equals(useSubmittedApiKey) ? submittedApiKey : null;
        if (resolvedApiKey == null && stored != null) {
            resolvedApiKey = trimToNull(stored.getApiKey());
        }
        if (resolvedApiKey == null) {
            resolvedApiKey = submittedApiKey;
        }
        if (resolvedBaseUrl == null || resolvedApiKey == null) {
            throw new IllegalArgumentException("请填写 URL 和 SK 密钥后再获取模型");
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(resolvedBaseUrl + "/models"))
                    .header("Authorization", "Bearer " + resolvedApiKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(15000))
                    .GET()
                    .build();
            HttpResponse<String> response = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofMillis(15000))
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new IOException("upstream " + response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            List<String> models = new ArrayList<>();
            JsonNode data = root.path("data");
            if (data.isArray()) {
                for (JsonNode item : data) {
                    String id = item.path("id").asText("");
                    if (!id.isBlank()) {
                        models.add(id);
                    }
                }
            }
            if (models.isEmpty() && root.isArray()) {
                for (JsonNode item : root) {
                    String id = item.path("id").asText(item.asText(""));
                    if (!id.isBlank()) {
                        models.add(id);
                    }
                }
            }
            return models.stream().distinct().sorted().toList();
        } catch (Exception e) {
            throw new IllegalStateException("模型获取失败：" + e.getMessage());
        }
    }

    private Map<String, Object> toAdminMap(AiAssistantConfig config) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", config.getId());
        map.put("name", defaultString(config.getName()));
        map.put("baseUrl", defaultString(config.getBaseUrl()));
        map.put("apiKeyMasked", maskKey(config.getApiKey()));
        map.put("hasApiKey", !isBlank(config.getApiKey()));
        map.put("model", defaultString(config.getModel()));
        map.put("reasoningEffort", defaultString(config.getReasoningEffort()));
        int timeoutMs = normalizeTimeoutMs(config.getTimeoutMs());
        map.put("timeoutMs", timeoutMs);
        map.put("timeoutMinutes", timeoutMsToMinutes(timeoutMs));
        map.put("systemPrompt", defaultString(config.getSystemPrompt()));
        map.put("promptFileName", defaultString(config.getPromptFileName()));
        map.put("enabled", !Boolean.FALSE.equals(config.getEnabled()));
        map.put("active", Boolean.TRUE.equals(config.getActive()));
        map.put("sortOrder", config.getSortOrder() == null ? 0 : config.getSortOrder());
        map.put("createTime", config.getCreateTime());
        map.put("updateTime", config.getUpdateTime());
        return map;
    }

    private String normalizeBaseUrl(String value) {
        String normalized = trimToNull(value);
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
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.toLowerCase(Locale.ROOT);
        return REASONING_EFFORT_VALUES.contains(normalized) ? normalized : null;
    }

    private Integer normalizeTimeoutMs(Integer value) {
        if (value == null) {
            return DEFAULT_TIMEOUT_MS;
        }
        return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, value));
    }

    private Integer environmentTimeoutMs() {
        Integer timeoutMinutes = environment.getProperty("AI_ASSISTANT_TIMEOUT_MINUTES", Integer.class);
        if (timeoutMinutes != null) {
            return timeoutMinutesToMs(timeoutMinutes);
        }
        return normalizeTimeoutMs(environment.getProperty("AI_ASSISTANT_TIMEOUT_MS", Integer.class, DEFAULT_TIMEOUT_MS));
    }

    private Integer timeoutMinutesToMs(Integer value) {
        int minutes = value == null ? MIN_TIMEOUT_MINUTES : Math.min(MAX_TIMEOUT_MINUTES, Math.max(MIN_TIMEOUT_MINUTES, value));
        return minutes * 60 * 1000;
    }

    private Integer timeoutMsToMinutes(Integer value) {
        return Math.min(MAX_TIMEOUT_MINUTES, Math.max(MIN_TIMEOUT_MINUTES, (int) Math.ceil(normalizeTimeoutMs(value) / 60000.0)));
    }

    private String firstText(String primary, String fallback) {
        String normalizedPrimary = trimToNull(primary);
        return normalizedPrimary == null ? fallback : normalizedPrimary;
    }

    private String normalizeSubmittedApiKey(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null || trimmed.contains("****") || trimmed.matches("^[*•●]+$")) {
            return null;
        }
        return trimmed;
    }

    private String maskKey(String value) {
        if (isBlank(value)) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 10) {
            return "****";
        }
        return trimmed.substring(0, 4) + "****" + trimmed.substring(trimmed.length() - 4);
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }

    private String defaultIfBlank(String value, String fallback) {
        return isBlank(value) ? fallback : value.trim();
    }

    private String trimToNull(String value) {
        if (isBlank(value)) {
            return null;
        }
        return value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
