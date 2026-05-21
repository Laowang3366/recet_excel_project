package com.excel.forum.controller;

import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.service.QaService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class QaControllerTest {
    @Mock
    private QaService qaService;

    @Mock
    private RateLimitService rateLimitService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new QaController(qaService, rateLimitService)).build();
    }

    @Test
    void submitCaseAnswerReturnsTooManyRequestsWhenRateLimited() throws Exception {
        when(rateLimitService.check(argThat(key -> key != null && key.startsWith("qa:answer:user:7")), any(Integer.class), any(), any()))
                .thenReturn(RateLimitResult.limited("答疑提交过于频繁，请稍后再试", 60));

        mockMvc.perform(post("/api/qa/cases/30/answers")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answerFileUrl":"/uploads/answer.xlsx"}
                                """))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("答疑提交过于频繁，请稍后再试"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(60));

        verify(qaService, never()).submitCaseAnswer(any(), any(), any());
    }

    @Test
    void caseTemplateSnapshotUsesControlledCaseEndpoint() throws Exception {
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();
        when(qaService.loadCaseTemplateSnapshot(7L, 30L)).thenReturn(snapshot);

        mockMvc.perform(get("/api/qa/cases/30/template-snapshot").requestAttr("userId", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sheets").isArray());
    }

    @Test
    void caseAnswerSnapshotUsesControlledAnswerEndpoint() throws Exception {
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();
        when(qaService.loadCaseAnswerSnapshot(7L, 30L, 88L)).thenReturn(snapshot);

        mockMvc.perform(get("/api/qa/cases/30/answers/88/template-snapshot").requestAttr("userId", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sheets").isArray());
    }
}
