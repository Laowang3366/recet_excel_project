package com.excel.forum.controller;

import com.excel.forum.service.AssistantService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AssistantControllerTest {
    @Mock
    private AssistantService assistantService;

    @Mock
    private RateLimitService rateLimitService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AssistantController(assistantService, rateLimitService)).build();
    }

    @Test
    void chatReturnsTooManyRequestsWhenMinuteLimitExceeded() throws Exception {
        when(rateLimitService.check(argThat(key -> key != null && key.startsWith("assistant:chat:10m:7")), any(Integer.class), any(), any()))
                .thenReturn(RateLimitResult.limited("AI 助手调用过于频繁，请 10 分钟后再试", 120));

        mockMvc.perform(post("/api/assistant/chat")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"message":"hello"}
                                """))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("AI 助手调用过于频繁，请 10 分钟后再试"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(120));

        verify(assistantService, never()).chat(any(), any());
    }
}
