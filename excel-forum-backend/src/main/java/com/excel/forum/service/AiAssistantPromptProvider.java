package com.excel.forum.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

@Slf4j
@Component
@RequiredArgsConstructor
public class AiAssistantPromptProvider {
    private static final String CLASSPATH_DEFAULT_PROMPT = "classpath:prompts/ai-assistant-system-prompt.txt";
    private static final String DEFAULT_EDITABLE_PROMPT_FILE_NAME = "ai-assistant-system-prompt.txt";
    private static final String LEGACY_BUILTIN_DEFAULT_PROMPT = String.join("\n",
            "你是一个专业、可靠、克制的 Excel 中文助手。",
            "输出必须使用自然中文纯文本。",
            "不要使用 Markdown 排版标记，包括 #、##、---、```、**、反引号。",
            "标题直接写成“结论：”“步骤：”“公式：”，列表使用 1. 2. 3. 这样的编号。",
            "Excel 公式本身必须完整保留，例如 =SUM(A1:A10)。"
    );
    private static final String BUILTIN_DEFAULT_PROMPT = String.join("\n",
            "你是 ExcelCC 的专业表格问题解答助手，负责解答 Excel、WPS 表格、Google Sheets 相关问题。",
            "默认使用简洁、准确、可操作的中文回答，必要时保留英文函数名和公式。",
            "根据用户问题自然组织答案，不要固定套用“结论：”“步骤：”“公式：”“说明：”等标题。",
            "先直接给出可执行方案，再补充关键原因、注意事项或替代写法。",
            "如果用户提供公式，解释公式意图并指出错误或改写建议。",
            "如果用户提供截图、表格上下文或附件，优先基于这些信息回答，不要编造未提供的站内内容。",
            "信息不足时，明确说明缺少哪些字段、区域或业务规则，并给出可继续操作的假设方案。",
            "公式必须可直接复制使用，例如 =SUM(A1:A10)。",
            "不要使用 Markdown 代码围栏；可以使用普通编号或短段落保证易读。"
    );

    private final Environment environment;
    private final ResourceLoader resourceLoader;

    public PromptSource getDefaultPrompt() {
        PromptSource editablePrompt = readEditableDefaultPrompt();
        if (editablePrompt != null) {
            return normalizeDefaultPrompt(editablePrompt);
        }

        PromptSource filePrompt = firstReadableFilePrompt(
                environment.getProperty("AI_ASSISTANT_SYSTEM_PROMPT_FILE"),
                environment.getProperty("AI_ASSISTANT_SYSTEM_PROMPT_PATH"),
                environment.getProperty("AI_ASSISTANT_SYSTEM_PROMPT_FILE_PATH")
        );
        if (filePrompt != null) {
            return normalizeDefaultPrompt(filePrompt);
        }

        String inlinePrompt = trimToNull(environment.getProperty("AI_ASSISTANT_SYSTEM_PROMPT"));
        if (inlinePrompt != null) {
            return normalizeDefaultPrompt(new PromptSource(
                    defaultIfBlank(environment.getProperty("AI_ASSISTANT_SYSTEM_PROMPT_FILE_NAME"), "AI_ASSISTANT_SYSTEM_PROMPT"),
                    inlinePrompt
            ));
        }

        PromptSource classpathPrompt = readPromptResource(CLASSPATH_DEFAULT_PROMPT, "ai-assistant-system-prompt.txt");
        if (classpathPrompt != null) {
            return normalizeDefaultPrompt(classpathPrompt);
        }

        return new PromptSource("builtin-default", BUILTIN_DEFAULT_PROMPT);
    }

    public PromptSource saveDefaultPrompt(String fileName, String content) {
        String prompt = trimToNull(content);
        if (prompt == null) {
            throw new IllegalArgumentException("system prompt 内容不能为空");
        }
        try {
            Path promptPath = editablePromptPath(fileName);
            Path parent = promptPath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(
                    promptPath,
                    prompt + System.lineSeparator(),
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING
            );
            return new PromptSource(promptPath.getFileName().toString(), prompt);
        } catch (IOException e) {
            throw new IllegalStateException("系统默认 prompt 保存失败：" + e.getMessage());
        }
    }

    public String resolveSystemPrompt(String configuredPrompt) {
        String prompt = trimToNull(configuredPrompt);
        return prompt == null ? getDefaultPrompt().content() : prompt;
    }

    private PromptSource normalizeDefaultPrompt(PromptSource promptSource) {
        return isLegacyDefaultPrompt(promptSource.content())
                ? new PromptSource(promptSource.fileName(), BUILTIN_DEFAULT_PROMPT)
                : promptSource;
    }

    private boolean isLegacyDefaultPrompt(String content) {
        return normalizeLineEndings(content).equals(LEGACY_BUILTIN_DEFAULT_PROMPT);
    }

    private String normalizeLineEndings(String value) {
        return value.replace("\r\n", "\n").replace('\r', '\n').trim();
    }

    private PromptSource readEditableDefaultPrompt() {
        Path promptPath = editablePromptPath(null);
        if (!Files.isRegularFile(promptPath)) {
            return null;
        }
        try {
            String content = trimToNull(Files.readString(promptPath, StandardCharsets.UTF_8));
            return content == null ? null : new PromptSource(promptPath.getFileName().toString(), content);
        } catch (Exception e) {
            log.warn("AI assistant editable prompt file read failed: {}", promptPath);
            return null;
        }
    }

    private Path editablePromptPath(String requestedFileName) {
        String configured = firstText(
                environment.getProperty("AI_ASSISTANT_EDITABLE_SYSTEM_PROMPT_FILE"),
                environment.getProperty("AI_ASSISTANT_SYSTEM_PROMPT_FILE"),
                environment.getProperty("AI_ASSISTANT_SYSTEM_PROMPT_PATH"),
                environment.getProperty("AI_ASSISTANT_SYSTEM_PROMPT_FILE_PATH")
        );
        if (configured != null && !configured.startsWith("classpath:")) {
            if (configured.startsWith("file:")) {
                configured = configured.substring("file:".length());
            }
            return Path.of(configured).toAbsolutePath().normalize();
        }

        return Path.of(System.getProperty("user.dir", "."), "prompts", DEFAULT_EDITABLE_PROMPT_FILE_NAME)
                .toAbsolutePath()
                .normalize();
    }

    private PromptSource firstReadableFilePrompt(String... locations) {
        for (String location : locations) {
            String normalized = trimToNull(location);
            if (normalized == null) {
                continue;
            }
            PromptSource promptSource = readPromptResource(toResourceLocation(normalized), displayFileName(normalized));
            if (promptSource != null) {
                return promptSource;
            }
        }
        return null;
    }

    private PromptSource readPromptResource(String location, String fileName) {
        try {
            Resource resource = resourceLoader.getResource(location);
            if (!resource.exists()) {
                return null;
            }
            try (InputStream inputStream = resource.getInputStream()) {
                String content = trimToNull(new String(inputStream.readAllBytes(), StandardCharsets.UTF_8));
                if (content == null) {
                    log.warn("AI assistant prompt file is empty: {}", location);
                    return null;
                }
                return new PromptSource(fileName, content);
            }
        } catch (Exception e) {
            log.warn("AI assistant prompt file read failed: {}", location);
            return null;
        }
    }

    private String toResourceLocation(String location) {
        if (location.startsWith("classpath:") || location.startsWith("file:")) {
            return location;
        }
        return "file:" + location;
    }

    private String displayFileName(String location) {
        if (location.startsWith("classpath:")) {
            return location.substring("classpath:".length());
        }
        if (location.startsWith("file:")) {
            location = location.substring("file:".length());
        }
        try {
            Path fileName = Path.of(location).getFileName();
            return fileName == null ? location : fileName.toString();
        } catch (RuntimeException exception) {
            log.debug("Failed to resolve prompt display file name: {}", location, exception);
            return location;
        }
    }

    private String firstText(String... values) {
        for (String value : values) {
            String normalized = trimToNull(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private String defaultIfBlank(String value, String fallback) {
        return isBlank(value) ? fallback : value.trim();
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public record PromptSource(String fileName, String content) {
    }
}
