package com.excel.forum.controller;

import com.excel.forum.entity.AiAssistantConfig;
import com.excel.forum.service.AiAssistantCallLogService;
import com.excel.forum.service.AiAssistantConfigService;
import com.excel.forum.service.AiCompletionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminAssistantControllerTest {
    @Mock
    private AiAssistantConfigService aiAssistantConfigService;

    @Mock
    private AiAssistantCallLogService aiAssistantCallLogService;

    @Mock
    private AiCompletionService aiCompletionService;

    @Test
    void createConfigAcceptsTimeoutMinutesUpToSixty() throws Exception {
        MockMvc mockMvc = mockMvc();
        when(aiAssistantConfigService.save(any(AiAssistantConfig.class))).thenAnswer(invocation -> {
            AiAssistantConfig config = invocation.getArgument(0);
            config.setId(9L);
            return true;
        });
        when(aiAssistantConfigService.listAdminConfigs()).thenReturn(List.of(Map.of("id", 9L)));

        mockMvc.perform(post("/api/admin/assistant/configs")
                        .requestAttr("userId", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "long timeout",
                                  "baseUrl": "https://api.example.com/v1",
                                  "apiKey": "sk-test",
                                  "model": "gpt-test",
                                  "timeoutMinutes": 60,
                                  "enabled": true
                                }
                                """))
                .andExpect(status().isOk());

        ArgumentCaptor<AiAssistantConfig> captor = ArgumentCaptor.forClass(AiAssistantConfig.class);
        verify(aiAssistantConfigService).save(captor.capture());
        assertThat(captor.getValue().getTimeoutMs()).isEqualTo(3_600_000);
    }

    @Test
    void createConfigAcceptsSubMinuteTimeoutMsForAdminUiSecondsInput() throws Exception {
        MockMvc mockMvc = mockMvc();
        when(aiAssistantConfigService.save(any(AiAssistantConfig.class))).thenAnswer(invocation -> {
            AiAssistantConfig config = invocation.getArgument(0);
            config.setId(10L);
            return true;
        });
        when(aiAssistantConfigService.listAdminConfigs()).thenReturn(List.of(Map.of("id", 10L)));

        mockMvc.perform(post("/api/admin/assistant/configs")
                        .requestAttr("userId", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "seconds timeout",
                                  "baseUrl": "https://api.example.com/v1",
                                  "apiKey": "sk-test",
                                  "model": "gpt-test",
                                  "timeoutMs": 30000,
                                  "enabled": true
                                }
                                """))
                .andExpect(status().isOk());

        ArgumentCaptor<AiAssistantConfig> captor = ArgumentCaptor.forClass(AiAssistantConfig.class);
        verify(aiAssistantConfigService).save(captor.capture());
        assertThat(captor.getValue().getTimeoutMs()).isEqualTo(30_000);
    }

    @Test
    void createConfigRejectsTimeoutMinutesAboveSixty() throws Exception {
        MockMvc mockMvc = mockMvc();

        mockMvc.perform(post("/api/admin/assistant/configs")
                        .requestAttr("userId", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "too long",
                                  "baseUrl": "https://api.example.com/v1",
                                  "apiKey": "sk-test",
                                  "model": "gpt-test",
                                  "timeoutMinutes": 61
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("模型超时时间需在 1 分钟到 60 分钟之间"));
    }

    @Test
    void fullApiKeyEndpointReturnsStoredKeyForAdminReveal() throws Exception {
        MockMvc mockMvc = mockMvc();
        AiAssistantConfig config = new AiAssistantConfig();
        config.setId(3L);
        config.setApiKey("sk-full-secret-value");
        when(aiAssistantConfigService.getById(3L)).thenReturn(config);

        mockMvc.perform(get("/api/admin/assistant/configs/3/api-key"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apiKey").value("sk-full-secret-value"))
                .andExpect(jsonPath("$.hasApiKey").value(true));
    }

    @Test
    void userDetailReturnsPerUserCallRecords() throws Exception {
        MockMvc mockMvc = mockMvc();
        when(aiAssistantCallLogService.getUserDetail(eq(7L), any(), any(), eq(1L), eq(10L))).thenReturn(Map.of(
                "profile", Map.of("userId", 7L, "username", "aquan76504", "email", "user@email.com"),
                "summary", Map.of("totalCalls", 62, "successCalls", 61, "failedCalls", 1, "fallbackCalls", 0, "avgLatencyMs", 2800),
                "records", List.of(Map.of("model", "gpt-5.4-mini", "latencyMs", 2300, "success", true)),
                "failureReasons", List.of(Map.of("reason", "timeout", "count", 1)),
                "total", 1L,
                "current", 1L,
                "size", 10L
        ));

        mockMvc.perform(get("/api/admin/assistant/stats/users/7")
                        .param("page", "1")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.username").value("aquan76504"))
                .andExpect(jsonPath("$.summary.avgLatencyMs").value(2800))
                .andExpect(jsonPath("$.records[0].model").value("gpt-5.4-mini"))
                .andExpect(jsonPath("$.failureReasons[0].reason").value("timeout"));
    }

    @Test
    void testCallUsesSubmittedDraftConfigAndReturnsCompletionPreview() throws Exception {
        MockMvc mockMvc = mockMvc();
        when(aiCompletionService.completeWithConfig(any(AiAssistantConfig.class), any()))
                .thenReturn(new AiCompletionService.Result("VLOOKUP 会按首列查找并返回指定列。", "gpt-5.4-mini", false, null));

        mockMvc.perform(post("/api/admin/assistant/test-call")
                        .requestAttr("userId", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "draft",
                                  "baseUrl": "https://api.example.com/v1",
                                  "apiKey": "sk-test",
                                  "model": "gpt-5.4-mini",
                                  "backupModel": "gpt-5.5",
                                  "timeoutMs": 30000,
                                  "maxRetries": 3,
                                  "systemPrompt": "你是 Excel 助手",
                                  "testQuestion": "如何使用 VLOOKUP？"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").value("VLOOKUP 会按首列查找并返回指定列。"))
                .andExpect(jsonPath("$.model").value("gpt-5.4-mini"))
                .andExpect(jsonPath("$.fallbackUsed").value(false))
                .andExpect(jsonPath("$.latencyMs").isNumber());

        ArgumentCaptor<AiAssistantConfig> captor = ArgumentCaptor.forClass(AiAssistantConfig.class);
        verify(aiCompletionService).completeWithConfig(captor.capture(), any());
        assertThat(captor.getValue().getBackupModel()).isEqualTo("gpt-5.5");
        assertThat(captor.getValue().getMaxRetries()).isEqualTo(3);
        assertThat(captor.getValue().getTimeoutMs()).isEqualTo(30_000);
    }

    @Test
    void rawLogsEndpointReturnsSanitizedRequestAndResponsePreview() throws Exception {
        MockMvc mockMvc = mockMvc();
        when(aiAssistantCallLogService.getUserRawLogs(eq(7L), any(), any(), eq(1L), eq(10L))).thenReturn(Map.of(
                "records", List.of(Map.of(
                        "id", 100L,
                        "questionSummary", "如何使用 VLOOKUP？",
                        "requestPreview", "用户问题：如何使用 VLOOKUP？",
                        "responsePreview", "VLOOKUP 会按首列查找。",
                        "model", "gpt-5.4-mini"
                )),
                "total", 1L,
                "current", 1L,
                "size", 10L
        ));

        mockMvc.perform(get("/api/admin/assistant/stats/users/7/raw-logs")
                        .param("page", "1")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].questionSummary").value("如何使用 VLOOKUP？"))
                .andExpect(jsonPath("$.records[0].requestPreview").value("用户问题：如何使用 VLOOKUP？"))
                .andExpect(jsonPath("$.records[0].responsePreview").value("VLOOKUP 会按首列查找。"));
    }

    private MockMvc mockMvc() {
        return MockMvcBuilders.standaloneSetup(new AdminAssistantController(
                aiAssistantConfigService,
                aiAssistantCallLogService,
                aiCompletionService
        )).build();
    }
}
