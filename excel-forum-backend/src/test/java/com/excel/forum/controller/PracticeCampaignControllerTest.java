package com.excel.forum.controller;

import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.service.PracticeCampaignService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PracticeCampaignControllerTest {

    @Mock
    private PracticeCampaignService practiceCampaignService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new PracticeCampaignController(practiceCampaignService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void wrongQuestionsReturnsUnauthorizedWhenServiceReportsNotLoggedIn() throws Exception {
        when(practiceCampaignService.getCampaignWrongQuestions(isNull())).thenThrow(new IllegalStateException("未登录"));

        mockMvc.perform(get("/api/practice/campaign/wrongs"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("未登录"));
    }

    @Test
    void startLevelRequiresLogin() throws Exception {
        mockMvc.perform(post("/api/practice/campaign/levels/3/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("未登录"));
    }

    @Test
    void submitLevelReturnsUnauthorizedWhenServiceReportsNotLoggedIn() throws Exception {
        when(practiceCampaignService.submitCampaignLevel(eq(3L), eq(7L), any())).thenThrow(new IllegalStateException("未登录"));

        mockMvc.perform(post("/api/practice/campaign/levels/3/submit")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"attemptId":12,"usedSeconds":20,"userAnswer":{"sheets":[]}}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("未登录"));
    }

    @Test
    void dailyChallengeEndpointIsNotExposed() throws Exception {
        MockMvc routeOnlyMockMvc = MockMvcBuilders
                .standaloneSetup(new PracticeCampaignController(practiceCampaignService))
                .build();

        routeOnlyMockMvc.perform(get("/api/practice/campaign/daily-challenge"))
                .andExpect(status().isNotFound());
    }
}
