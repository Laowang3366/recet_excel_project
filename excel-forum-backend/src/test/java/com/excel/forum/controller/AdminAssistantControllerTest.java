package com.excel.forum.controller;

import com.excel.forum.entity.AiAssistantConfig;
import com.excel.forum.service.AiAssistantCallLogService;
import com.excel.forum.service.AiAssistantConfigService;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminAssistantControllerTest {
    @Mock
    private AiAssistantConfigService aiAssistantConfigService;

    @Mock
    private AiAssistantCallLogService aiAssistantCallLogService;

    @Test
    void createConfigAcceptsTimeoutMinutesUpToSixty() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AdminAssistantController(aiAssistantConfigService, aiAssistantCallLogService)).build();
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
    void createConfigRejectsTimeoutMinutesAboveSixty() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AdminAssistantController(aiAssistantConfigService, aiAssistantCallLogService)).build();

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
}
