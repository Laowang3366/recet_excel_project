package com.excel.forum.controller;

import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminQuestionControllerTest {

    @Mock
    private QuestionService questionService;
    @Mock
    private QuestionCategoryService questionCategoryService;
    @Mock
    private QuestionExcelTemplateService questionExcelTemplateService;
    @Mock
    private ExcelTemplateGradingService excelTemplateGradingService;
    @Mock
    private PracticeCampaignService practiceCampaignService;
    @Mock
    private FileRecycleService fileRecycleService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new AdminQuestionController(
                        questionService,
                        questionCategoryService,
                        questionExcelTemplateService,
                        excelTemplateGradingService,
                        practiceCampaignService,
                        fileRecycleService
                ))
                .build();
    }

    @Test
    void getQuestionsForwardsManagementFilters() throws Exception {
        when(questionService.getQuestionsPage(1, 20, "excel_template", 3L, "SUM", Boolean.TRUE, 2))
                .thenReturn(Map.of("questions", List.of(), "total", 0L));

        mockMvc.perform(get("/api/admin/questions")
                        .param("page", "1")
                        .param("size", "20")
                        .param("type", "excel_template")
                        .param("questionCategoryId", "3")
                        .param("keyword", "SUM")
                        .param("enabled", "true")
                        .param("difficulty", "2"))
                .andExpect(status().isOk());

        verify(questionService).getQuestionsPage(
                eq(1),
                eq(20),
                eq("excel_template"),
                eq(3L),
                eq("SUM"),
                eq(Boolean.TRUE),
                eq(2)
        );
    }

    @Test
    void getQuestionsIncludesIdealAnswerImageUrl() throws Exception {
        Question question = new Question();
        question.setId(9L);
        question.setTitle("参考图题目");
        question.setType("excel_template");
        question.setEnabled(true);

        QuestionExcelTemplate template = new QuestionExcelTemplate();
        template.setQuestionId(9L);
        template.setTemplateFileUrl("/uploads/questions/demo.xlsx");
        template.setIdealAnswerImageUrl("/uploads/questions/ideal.png");

        when(questionService.getQuestionsPage(1, 10, "excel_template", null, null, null, null))
                .thenReturn(Map.of("questions", List.of(question), "total", 1L));
        when(questionExcelTemplateService.mapByQuestionIds(List.of(9L))).thenReturn(Map.of(9L, template));

        mockMvc.perform(get("/api/admin/questions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].idealAnswerImageUrl").value("/uploads/questions/ideal.png"));
    }
}
