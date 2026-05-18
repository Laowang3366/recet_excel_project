package com.excel.forum.controller;

import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.config.ExperienceProperties;
import com.excel.forum.config.PublicJsonCache;
import com.excel.forum.config.PublicReadCache;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.service.ExperienceLevelRuleService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PublicControllerTest {

    @Mock
    private UserService userService;

    @Mock
    private QuestionService questionService;

    @Mock
    private PracticeRecordMapper practiceRecordMapper;

    @Mock
    private PracticeAnswerMapper practiceAnswerMapper;

    @Mock
    private ExperienceLevelRuleService experienceLevelRuleService;

    @Mock
    private ExperienceProperties experienceProperties;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        PublicController controller = new PublicController(
                userService,
                questionService,
                practiceRecordMapper,
                practiceAnswerMapper,
                experienceLevelRuleService,
                experienceProperties,
                new PublicJsonCache(new PublicReadCache(), new ObjectMapper())
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void publicRootReturnsOverviewPayload() throws Exception {
        when(userService.count(any())).thenReturn(1L);
        when(questionService.count(any())).thenReturn(5L);

        mockMvc.perform(get("/api/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.questionCount").value(5))
                .andExpect(jsonPath("$.stats.userCount").value(1))
                .andExpect(jsonPath("$.topUsers").isArray());
    }

    @Test
    void homeOverviewCountsPracticeStatsWithoutLoadingWholeTables() throws Exception {
        when(userService.count(any())).thenReturn(1L);
        when(questionService.count(any())).thenReturn(5L);
        when(practiceAnswerMapper.selectCount(any())).thenReturn(10L, 7L);
        when(practiceRecordMapper.selectObjs(any())).thenReturn(List.of(11L, 12L, 13L));

        mockMvc.perform(get("/api/public/home-overview"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, allOf(
                        containsString("public"),
                        containsString("max-age=30")
                )))
                .andExpect(jsonPath("$.practiceStats.questionCount").value(5))
                .andExpect(jsonPath("$.practiceStats.passRate").value(70))
                .andExpect(jsonPath("$.practiceStats.activeUserCount").value(3));

        verify(practiceAnswerMapper, times(2)).selectCount(any());
        verify(practiceAnswerMapper, never()).selectList(any());
        verify(practiceRecordMapper).selectObjs(any());
        verify(practiceRecordMapper, never()).selectList(any());
    }

    @Test
    void homeOverviewReusesShortLivedServerCache() throws Exception {
        when(userService.count(any())).thenReturn(1L);
        when(questionService.count(any())).thenReturn(5L);
        when(practiceAnswerMapper.selectCount(any())).thenReturn(10L, 7L);
        when(practiceRecordMapper.selectObjs(any())).thenReturn(List.of(11L, 12L, 13L));

        mockMvc.perform(get("/api/public/home-overview"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .string(startsWith("{")))
                .andExpect(jsonPath("$.practiceStats.passRate").value(70));
        mockMvc.perform(get("/api/public/home-overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.practiceStats.passRate").value(70));

        verify(userService, times(2)).count(any());
        verify(questionService, times(1)).count(any());
        verify(practiceAnswerMapper, times(2)).selectCount(any());
        verify(practiceRecordMapper, times(1)).selectObjs(any());
        verify(userService, times(1)).page(any(), any());
    }

    @Test
    void levelRulesReturnsShortPublicCacheHeader() throws Exception {
        ExperienceProperties.LevelRule levelRule = new ExperienceProperties.LevelRule();
        levelRule.setLevel(1);
        levelRule.setName("入门");
        levelRule.setThreshold(0);
        when(experienceLevelRuleService.listEnabledRules()).thenReturn(List.of());
        when(experienceProperties.getLevels()).thenReturn(List.of(levelRule));

        mockMvc.perform(get("/api/public/level-rules"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, allOf(
                        containsString("public"),
                        containsString("max-age=30")
                )))
                .andExpect(jsonPath("$.rules[0].level").value(1));
    }
}
