package com.excel.forum.service.impl;

import com.excel.forum.entity.dto.AssistantChatRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AssistantServiceImplTest {

    private final AssistantServiceImpl service = new AssistantServiceImpl(
            null,
            null,
            null,
            null,
            null,
            null,
            new ObjectMapper()
    );

    @Test
    void normalizeImagesAcceptsJpgAliasAndNormalizesMimeType() {
        String base64 = Base64.getEncoder().encodeToString("jpg".getBytes(StandardCharsets.UTF_8));
        AssistantChatRequest.ImageAttachment image = new AssistantChatRequest.ImageAttachment();
        image.setName("formula.jpg");
        image.setSize(3L);
        image.setDataUrl("data:image/jpg;base64," + base64);

        List<Object> images = normalizeImages(List.of(image));

        assertThat(images).hasSize(1);
        assertThat(readRecordAccessor(images.get(0), "mimeType")).isEqualTo("image/jpeg");
        assertThat(readRecordAccessor(images.get(0), "dataUrl")).isEqualTo("data:image/jpeg;base64," + base64);
    }

    @Test
    void normalizeImagesRejectsMoreThanThreeImages() {
        String base64 = Base64.getEncoder().encodeToString("png".getBytes(StandardCharsets.UTF_8));
        List<AssistantChatRequest.ImageAttachment> images = List.of(
                image("1.png", base64),
                image("2.png", base64),
                image("3.png", base64),
                image("4.png", base64)
        );

        assertThatThrownBy(() -> normalizeImages(images))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("一次最多支持 3 张图片");
    }

    @Test
    void timeoutUsesConfiguredValue() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("AI_ASSISTANT_TIMEOUT_MS", "120000");
        AssistantServiceImpl assistantService = new AssistantServiceImpl(
                null,
                null,
                null,
                null,
                null,
                environment,
                new ObjectMapper()
        );

        Integer timeoutMs = ReflectionTestUtils.invokeMethod(assistantService, "environmentTimeoutMs");

        assertThat(timeoutMs).isEqualTo(120000);
    }

    @Test
    void timeoutSupportsUpToSixtyMinutes() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("AI_ASSISTANT_TIMEOUT_MS", "7200000");
        AssistantServiceImpl assistantService = new AssistantServiceImpl(
                null,
                null,
                null,
                null,
                null,
                environment,
                new ObjectMapper()
        );

        Integer timeoutMs = ReflectionTestUtils.invokeMethod(assistantService, "environmentTimeoutMs");

        assertThat(timeoutMs).isEqualTo(3_600_000);
    }

    @Test
    void timeoutCanBeConfiguredInMinutes() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("AI_ASSISTANT_TIMEOUT_MINUTES", "45");
        AssistantServiceImpl assistantService = new AssistantServiceImpl(
                null,
                null,
                null,
                null,
                null,
                environment,
                new ObjectMapper()
        );

        Integer timeoutMs = ReflectionTestUtils.invokeMethod(assistantService, "environmentTimeoutMs");

        assertThat(timeoutMs).isEqualTo(2_700_000);
    }

    @Test
    void timeoutFallsBackToSixtySecondsWhenMissing() {
        AssistantServiceImpl assistantService = new AssistantServiceImpl(
                null,
                null,
                null,
                null,
                null,
                new MockEnvironment(),
                new ObjectMapper()
        );

        Integer timeoutMs = ReflectionTestUtils.invokeMethod(assistantService, "environmentTimeoutMs");

        assertThat(timeoutMs).isEqualTo(60000);
    }

    @Test
    void buildPromptLeavesAnswerFormatToSystemPrompt() {
        String prompt = ReflectionTestUtils.invokeMethod(
                service,
                "buildPrompt",
                "帮我写一个 SUMIFS 公式",
                "",
                "",
                List.of(),
                List.of(),
                List.of()
        );

        assertThat(prompt)
                .contains("请遵循 system prompt")
                .contains("用户问题")
                .doesNotContain("输出格式硬性要求")
                .doesNotContain("结论：先用一句话回答")
                .doesNotContain("你是 ExcelCC.cn 的 Excel AI 助手");
    }

    @SuppressWarnings("unchecked")
    private List<Object> normalizeImages(List<AssistantChatRequest.ImageAttachment> images) {
        return (List<Object>) ReflectionTestUtils.invokeMethod(service, "normalizeImages", images);
    }

    private AssistantChatRequest.ImageAttachment image(String name, String base64) {
        AssistantChatRequest.ImageAttachment image = new AssistantChatRequest.ImageAttachment();
        image.setName(name);
        image.setSize(3L);
        image.setDataUrl("data:image/png;base64," + base64);
        return image;
    }

    private String readRecordAccessor(Object record, String accessorName) {
        try {
            var accessor = record.getClass().getDeclaredMethod(accessorName);
            accessor.setAccessible(true);
            return String.valueOf(accessor.invoke(record));
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
    }
}
