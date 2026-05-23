package com.excel.forum.service.impl;

import com.excel.forum.entity.AiAssistantConfig;
import com.excel.forum.service.AiAssistantConfigService;
import com.excel.forum.service.AiAssistantPromptProvider;
import com.excel.forum.service.AiCompletionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

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
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiCompletionServiceImpl implements AiCompletionService {
    private static final int DEFAULT_TIMEOUT_MS = 60000;
    private static final int MIN_TIMEOUT_MS = 60000;
    private static final int MAX_TIMEOUT_MS = 3600000;
    private static final int MIN_TIMEOUT_MINUTES = 1;
    private static final int MAX_TIMEOUT_MINUTES = 60;
    private static final Pattern MARKDOWN_FENCE_LINE_PATTERN = Pattern.compile("(?m)^\\s*```[\\w-]*\\s*$");
    private static final Pattern MARKDOWN_RULE_LINE_PATTERN = Pattern.compile("(?m)^\\s*[-*_]{3,}\\s*$");
    private static final Pattern MARKDOWN_HEADING_LINE_PATTERN = Pattern.compile("(?m)^\\s{0,3}#{1,6}\\s+(.+)$");
    private static final Pattern MARKDOWN_BOLD_PATTERN = Pattern.compile("\\*\\*([^\\n*][^\\n]*?)\\*\\*");
    private static final Pattern MARKDOWN_INLINE_CODE_PATTERN = Pattern.compile("`([^`\\n]+)`");
    private static final Set<String> REASONING_EFFORT_VALUES = Set.of("low", "medium", "high");

    private final AiAssistantConfigService aiAssistantConfigService;
    private final AiAssistantPromptProvider promptProvider;
    private final Environment environment;
    private final ObjectMapper objectMapper;

    @Override
    public Result complete(Request request) {
        if (request == null || isBlank(request.userPrompt())) {
            throw new IllegalArgumentException("请输入需要发送给 AI 的内容");
        }
        RuntimeConfig runtimeConfig = resolveRuntimeConfig();
        String systemPrompt = isBlank(request.systemPromptOverride())
                ? runtimeConfig.systemPrompt()
                : request.systemPromptOverride();
        List<ImageInput> images = request.images() == null ? List.of() : request.images();
        long startedAt = System.currentTimeMillis();
        try {
            String answer = callOpenAiCompatible(
                    runtimeConfig.baseUrl(),
                    runtimeConfig.apiKey(),
                    runtimeConfig.model(),
                    runtimeConfig.reasoningEffort(),
                    runtimeConfig.timeoutMs(),
                    systemPrompt,
                    request.userPrompt(),
                    images,
                    request.maxOutputTokens(),
                    request.temperature()
            );
            return new Result(answer, runtimeConfig.model(), false, runtimeConfig.configId());
        } catch (Exception primaryError) {
            log.warn("AI completion primary model failed after {}ms: {}", System.currentTimeMillis() - startedAt, primaryError.toString());
        }
        if (runtimeConfig.hasFallback()) {
            try {
                String answer = callOpenAiCompatible(
                        runtimeConfig.fallbackBaseUrl(),
                        runtimeConfig.fallbackApiKey(),
                        runtimeConfig.fallbackModel(),
                        runtimeConfig.reasoningEffort(),
                        runtimeConfig.timeoutMs(),
                        systemPrompt,
                        request.userPrompt(),
                        images,
                        request.maxOutputTokens(),
                        request.temperature()
                );
                return new Result(answer, runtimeConfig.fallbackModel(), true, runtimeConfig.configId());
            } catch (Exception fallbackError) {
                log.error("AI completion fallback model failed: {}", fallbackError.toString());
            }
        }
        throw new IllegalStateException("AI 助手暂时不可用，请稍后再试");
    }

    private RuntimeConfig resolveRuntimeConfig() {
        AiAssistantConfig activeConfig = aiAssistantConfigService.getActiveConfig();
        if (activeConfig != null) {
            String baseUrl = trimToNull(activeConfig.getBaseUrl());
            String apiKey = trimToNull(activeConfig.getApiKey());
            String model = trimToNull(activeConfig.getModel());
            String reasoningEffort = normalizeReasoningEffort(activeConfig.getReasoningEffort());
            int timeoutMs = normalizeTimeoutMs(activeConfig.getTimeoutMs());
            if (baseUrl == null || apiKey == null || model == null) {
                throw new IllegalStateException("AI 助手配置不完整");
            }
            return new RuntimeConfig(
                    activeConfig.getId(),
                    normalizeBaseUrl(baseUrl),
                    apiKey,
                    model,
                    reasoningEffort,
                    null,
                    null,
                    null,
                    timeoutMs,
                    promptProvider.resolveSystemPrompt(activeConfig.getSystemPrompt())
            );
        }

        if (!environment.getProperty("AI_ASSISTANT_ENABLED", Boolean.class, false)) {
            throw new IllegalStateException("AI 助手暂未开启");
        }
        String primaryBaseUrl = trimToNull(environment.getProperty("AI_ASSISTANT_BASE_URL"));
        String primaryApiKey = trimToNull(environment.getProperty("AI_ASSISTANT_API_KEY"));
        String primaryModel = trimToNull(environment.getProperty("AI_ASSISTANT_MODEL"));
        String reasoningEffort = normalizeReasoningEffort(environment.getProperty("AI_ASSISTANT_REASONING_EFFORT"));
        String fallbackBaseUrl = trimToNull(environment.getProperty("AI_ASSISTANT_FALLBACK_BASE_URL", primaryBaseUrl));
        String fallbackApiKey = trimToNull(environment.getProperty("AI_ASSISTANT_FALLBACK_API_KEY", primaryApiKey));
        String fallbackModel = trimToNull(environment.getProperty("AI_ASSISTANT_FALLBACK_MODEL"));
        int timeoutMs = environmentTimeoutMs();
        if (primaryBaseUrl == null || primaryApiKey == null || primaryModel == null) {
            throw new IllegalStateException("AI 助手配置不完整");
        }
        return new RuntimeConfig(
                null,
                normalizeBaseUrl(primaryBaseUrl),
                primaryApiKey,
                primaryModel,
                reasoningEffort,
                fallbackBaseUrl == null ? null : normalizeBaseUrl(fallbackBaseUrl),
                fallbackApiKey,
                fallbackModel,
                timeoutMs,
                promptProvider.getDefaultPrompt().content()
        );
    }

    private String callOpenAiCompatible(String baseUrl, String apiKey, String model, String reasoningEffort, int timeoutMs,
                                        String systemPrompt, String prompt, List<ImageInput> images,
                                        Integer requestedMaxOutputTokens, Double requestedTemperature) throws IOException, InterruptedException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        if (!isBlank(reasoningEffort)) {
            payload.put("reasoning_effort", reasoningEffort);
        }
        payload.put("temperature", requestedTemperature == null ? 0.3 : requestedTemperature);
        payload.put("max_tokens", normalizeMaxOutputTokens(requestedMaxOutputTokens));
        payload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", buildUserMessageContent(prompt, images))
        ));
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(normalizeBaseUrl(baseUrl) + "/chat/completions"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .timeout(Duration.ofMillis(timeoutMs))
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(timeoutMs)).build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IOException("upstream " + response.statusCode() + ": " + response.body());
        }
        JsonNode root = objectMapper.readTree(response.body());
        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
            throw new IOException("empty choices from upstream");
        }
        String answer = normalizeAnswer(choices.get(0).path("message").path("content").asText(""));
        if (answer.isEmpty()) {
            throw new IOException("empty answer from upstream");
        }
        return answer;
    }

    private Object buildUserMessageContent(String prompt, List<ImageInput> images) {
        if (images == null || images.isEmpty()) {
            return prompt;
        }
        List<Map<String, Object>> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", prompt));
        for (ImageInput image : images) {
            content.add(Map.of(
                    "type", "image_url",
                    "image_url", Map.of(
                            "url", image.dataUrl(),
                            "detail", "auto"
                    )
            ));
        }
        return content;
    }

    private String normalizeAnswer(String answer) {
        if (answer == null) {
            return "";
        }
        String normalized = answer.replace("\r\n", "\n").replace("\r", "\n");
        normalized = MARKDOWN_FENCE_LINE_PATTERN.matcher(normalized).replaceAll("");
        normalized = MARKDOWN_RULE_LINE_PATTERN.matcher(normalized).replaceAll("");
        normalized = MARKDOWN_HEADING_LINE_PATTERN.matcher(normalized).replaceAll("$1");
        normalized = MARKDOWN_BOLD_PATTERN.matcher(normalized).replaceAll("$1");
        normalized = MARKDOWN_INLINE_CODE_PATTERN.matcher(normalized).replaceAll("$1");
        normalized = normalized.replaceAll("(?m)^\\s*>\\s?", "");
        normalized = normalized.replaceAll("\\n{3,}", "\n\n");
        return normalized.trim();
    }

    private int normalizeMaxOutputTokens(Integer value) {
        return value == null ? maxOutputTokens() : Math.max(256, value);
    }

    private int maxOutputTokens() {
        return Math.max(256, environment.getProperty("AI_ASSISTANT_MAX_OUTPUT_TOKENS", Integer.class, 1200));
    }

    private int environmentTimeoutMs() {
        Integer timeoutMinutes = environment.getProperty("AI_ASSISTANT_TIMEOUT_MINUTES", Integer.class);
        if (timeoutMinutes != null) {
            return timeoutMinutesToMs(timeoutMinutes);
        }
        return normalizeTimeoutMs(environment.getProperty("AI_ASSISTANT_TIMEOUT_MS", Integer.class, DEFAULT_TIMEOUT_MS));
    }

    private int normalizeTimeoutMs(Integer timeoutMs) {
        if (timeoutMs == null) {
            return DEFAULT_TIMEOUT_MS;
        }
        return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, timeoutMs));
    }

    private int timeoutMinutesToMs(Integer timeoutMinutes) {
        int minutes = timeoutMinutes == null
                ? MIN_TIMEOUT_MINUTES
                : Math.min(MAX_TIMEOUT_MINUTES, Math.max(MIN_TIMEOUT_MINUTES, timeoutMinutes));
        return minutes * 60 * 1000;
    }

    private String normalizeReasoningEffort(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.toLowerCase(Locale.ROOT);
        return REASONING_EFFORT_VALUES.contains(normalized) ? normalized : null;
    }

    private String normalizeBaseUrl(String value) {
        String normalized = value.replaceAll("/+$", "");
        if (normalized.endsWith("/chat/completions")) {
            normalized = normalized.substring(0, normalized.length() - "/chat/completions".length());
        }
        return normalized;
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

    private record RuntimeConfig(Long configId, String baseUrl, String apiKey, String model, String reasoningEffort,
                                 String fallbackBaseUrl, String fallbackApiKey, String fallbackModel,
                                 int timeoutMs, String systemPrompt) {
        boolean hasFallback() {
            return fallbackBaseUrl != null && fallbackApiKey != null && fallbackModel != null;
        }
    }
}
