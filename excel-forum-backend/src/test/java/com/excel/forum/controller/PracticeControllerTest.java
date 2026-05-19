package com.excel.forum.controller;

import com.excel.forum.config.PublicJsonCache;
import com.excel.forum.config.PublicReadCache;
import com.excel.forum.entity.dto.PracticeQuestionWorkbookFile;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.PracticeService;
import com.excel.forum.service.PracticeWorkbookLinkService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PracticeControllerTest {

    @Mock
    private PracticeService practiceService;

    @Mock
    private ExcelTemplateGradingService excelTemplateGradingService;

    @Mock
    private PracticeWorkbookLinkService practiceWorkbookLinkService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        PracticeController controller = new PracticeController(
                practiceService,
                excelTemplateGradingService,
                new PublicJsonCache(new PublicReadCache(), new ObjectMapper()),
                practiceWorkbookLinkService
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void categoriesReturnsShortPublicCacheHeader() throws Exception {
        when(practiceService.getPracticeCategories()).thenReturn(Map.of(
                "categories", List.of(Map.of("id", 1L, "name", "函数基础"))
        ));

        mockMvc.perform(get("/api/practice/categories"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, allOf(
                        containsString("public"),
                        containsString("max-age=30")
                )))
                .andExpect(jsonPath("$.categories[0].id").value(1));
    }

    @Test
    void categoriesReusesShortLivedServerCache() throws Exception {
        when(practiceService.getPracticeCategories()).thenReturn(Map.of(
                "categories", List.of(Map.of("id", 1L, "name", "函数基础"))
        ));

        mockMvc.perform(get("/api/practice/categories"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .string(startsWith("{\"categories\"")))
                .andExpect(jsonPath("$.categories[0].id").value(1));
        mockMvc.perform(get("/api/practice/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories[0].id").value(1));

        verify(practiceService, times(1)).getPracticeCategories();
    }

    @Test
    void questionListDoesNotReturnPublicCacheHeaderBecauseItCanUseUserContext() throws Exception {
        when(practiceService.getPracticeQuestionList(null, 7L)).thenReturn(Map.of(
                "questions", List.of()
        ));

        mockMvc.perform(get("/api/practice/question-list").requestAttr("userId", 7L))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist(HttpHeaders.CACHE_CONTROL));
    }

    @Test
    void questionWorkbookDownloadReturnsAttachment() throws Exception {
        when(practiceService.buildPracticeQuestionWorkbookFile(9L)).thenReturn(new PracticeQuestionWorkbookFile(
                "函数练习.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[] { 1, 2, 3 }
        ));

        mockMvc.perform(get("/api/practice/questions/9/file").requestAttr("userId", 7L))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("filename*=")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("%E5%87%BD%E6%95%B0%E7%BB%83%E4%B9%A0.xlsx")))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, startsWith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")));
    }

    @Test
    void submitPracticeReturnsUnauthorizedWhenServiceReportsNotLoggedIn() throws Exception {
        when(practiceService.submitPractice(eq(7L), any())).thenThrow(new IllegalStateException("未登录"));

        mockMvc.perform(post("/api/practice/submit")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answers":[]}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("未登录"));
    }

    @Test
    void submitPracticeQuestionReturnsUnauthorizedWhenServiceReportsNotLoggedIn() throws Exception {
        when(practiceService.submitPracticeQuestion(eq(7L), any())).thenThrow(new IllegalArgumentException("未登录"));

        mockMvc.perform(post("/api/practice/submissions")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"投稿题"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("未登录"));
    }
}
