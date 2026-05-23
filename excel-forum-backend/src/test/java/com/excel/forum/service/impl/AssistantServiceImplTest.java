package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.TutorialArticle;
import com.excel.forum.entity.dto.AssistantChatRequest;
import com.excel.forum.service.AiAssistantCallLogService;
import com.excel.forum.service.AiCompletionService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.TutorialArticleService;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AssistantServiceImplTest {

    private final AssistantServiceImpl service = new AssistantServiceImpl(
            null,
            null,
            null,
            null,
            null
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

    @Test
    void chatRecordsAssistantChatToolType() {
        TutorialArticleService tutorialArticleService = mock(TutorialArticleService.class);
        QuestionService questionService = mock(QuestionService.class);
        AiAssistantCallLogService callLogService = mock(AiAssistantCallLogService.class);
        Environment environment = mock(Environment.class);
        AiCompletionService aiCompletionService = mock(AiCompletionService.class);
        when(tutorialArticleService.list(org.mockito.ArgumentMatchers.<QueryWrapper<TutorialArticle>>any())).thenReturn(List.of());
        when(questionService.list(org.mockito.ArgumentMatchers.<QueryWrapper<Question>>any())).thenReturn(List.of());
        when(environment.getProperty(eq("AI_ASSISTANT_MAX_INPUT_CHARS"), eq(Integer.class), any()))
                .thenReturn(6000);
        when(environment.getProperty(eq("AI_ASSISTANT_MAX_OUTPUT_TOKENS"), eq(Integer.class), any()))
                .thenReturn(1200);
        when(aiCompletionService.complete(any()))
                .thenReturn(new AiCompletionService.Result("回答", "gpt-test", false, 9L));
        AssistantServiceImpl chatService = new AssistantServiceImpl(
                tutorialArticleService,
                questionService,
                callLogService,
                environment,
                aiCompletionService
        );
        AssistantChatRequest request = new AssistantChatRequest();
        request.setMessage("怎么求和");

        chatService.chat(7L, request);

        verify(callLogService).record(eq(7L), eq(9L), eq("gpt-test"), eq("assistant_chat"), eq(true), eq(false), anyLong(), eq(null));
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
