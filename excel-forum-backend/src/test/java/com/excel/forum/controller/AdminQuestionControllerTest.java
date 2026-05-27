package com.excel.forum.controller;

import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.entity.dto.ExcelTemplateEvaluation;
import com.excel.forum.entity.dto.ExcelTemplateExpectedSnapshot;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.http.MediaType.APPLICATION_JSON;
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

    @Test
    void createQuestionDerivesPointsFromDifficulty() throws Exception {
        doAnswer(invocation -> {
            Question question = invocation.getArgument(0);
            question.setId(18L);
            return null;
        }).when(questionService).save(any(Question.class));
        when(excelTemplateGradingService.normalizeAnswerSnapshotJson(anyString(), anyString(), anyString(), anyBoolean(), anyString()))
                .thenReturn("{\"values\":[[1]],\"formulas\":[[\"\"]]}");
        when(excelTemplateGradingService.buildRuleJson(anyString(), anyString(), anyString(), anyBoolean(), any()))
                .thenReturn("{}");
        when(excelTemplateGradingService.buildExpectedSnapshotJson(anyString(), anyString(), anyString(), anyBoolean(), anyString(), anyString(), any()))
                .thenReturn("{}");

        mockMvc.perform(post("/api/admin/questions")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "title":"自动积分题",
                                  "questionCategoryId":3,
                                  "difficulty":7,
                                  "points":999,
                                  "templateFileUrl":"/uploads/demo.xlsx",
                                  "answerSheet":"Sheet1",
                                  "answerRange":"B2",
                                  "answerSnapshotJson":"{}",
                                  "checkFormula":false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.difficulty").value(7))
                .andExpect(jsonPath("$.points").value(26));
    }

    @Test
    void batchImportCreatesValidRowsAndReportsInvalidRows() throws Exception {
        doAnswer(invocation -> {
            Question question = invocation.getArgument(0);
            question.setId(31L);
            return null;
        }).when(questionService).save(any(Question.class));
        when(excelTemplateGradingService.normalizeAnswerSnapshotJson(anyString(), anyString(), anyString(), anyBoolean(), anyString()))
                .thenReturn("{\"values\":[[1]],\"formulas\":[[\"\"]]}");
        when(excelTemplateGradingService.buildRuleJson(anyString(), anyString(), anyString(), anyBoolean(), any()))
                .thenReturn("{}");
        when(excelTemplateGradingService.buildExpectedSnapshotJson(anyString(), anyString(), anyString(), anyBoolean(), anyString(), anyString(), any()))
                .thenReturn("{}");

        mockMvc.perform(post("/api/admin/questions/batch-import")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "records":[
                                    {
                                      "title":"批量导入题",
                                      "questionCategoryId":3,
                                      "difficulty":3,
                                      "templateFileUrl":"/uploads/import.xlsx",
                                      "answerSheet":"练习表",
                                      "answerRange":"B2:F20",
                                      "answerSnapshotJson":"{}",
                                      "checkFormula":true
                                    },
                                    {
                                      "title":"",
                                      "questionCategoryId":3,
                                      "difficulty":3,
                                      "templateFileUrl":"/uploads/import.xlsx",
                                      "answerSheet":"练习表",
                                      "answerRange":"B2:F20",
                                      "answerSnapshotJson":"{}"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.created").value(1))
                .andExpect(jsonPath("$.failed").value(1))
                .andExpect(jsonPath("$.records[0].id").value(31))
                .andExpect(jsonPath("$.errors[0].index").value(1));
    }

    @Test
    void getTemplateSnapshotChecksReturnsServerAuditRecords() throws Exception {
        Question question = new Question();
        question.setId(42L);
        question.setTitle("SUMIF 条件求和");
        question.setType("excel_template");
        question.setEnabled(true);

        QuestionExcelTemplate template = new QuestionExcelTemplate();
        template.setQuestionId(42L);
        template.setTemplateFileUrl("/uploads/demo.xlsx");
        template.setAnswerSheet("练习表");
        template.setAnswerRange("B2:F20");
        template.setExpectedSnapshotJson("{}");
        template.setGradingRuleJson("{}");

        when(questionService.list(any(QueryWrapper.class))).thenReturn(List.of(question));
        when(questionExcelTemplateService.mapByQuestionIds(List.of(42L))).thenReturn(Map.of(42L, template));
        when(excelTemplateGradingService.loadWorkbookSnapshot("/uploads/demo.xlsx")).thenReturn(new ExcelWorkbookSnapshot());
        when(excelTemplateGradingService.parseExpectedSnapshot("{}")).thenReturn(new ExcelTemplateExpectedSnapshot());
        when(excelTemplateGradingService.buildRuleSummary("{}"))
                .thenReturn(Map.of("mode", "cell_range", "totalScore", 10, "cellRuleCount", 1));

        mockMvc.perform(get("/api/admin/questions/template-snapshot-checks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.passed").value(1))
                .andExpect(jsonPath("$.records[0].questionId").value(42))
                .andExpect(jsonPath("$.records[0].status").value("passed"))
                .andExpect(jsonPath("$.records[0].answerRange").value("B2:F20"));
    }

    @Test
    void getExceptionReportFlagsMissingExpectedSnapshot() throws Exception {
        Question question = new Question();
        question.setId(43L);
        question.setTitle("缺少标准答案");
        question.setType("excel_template");
        question.setEnabled(true);

        QuestionExcelTemplate template = new QuestionExcelTemplate();
        template.setQuestionId(43L);
        template.setTemplateFileUrl("/uploads/demo.xlsx");
        template.setAnswerSheet("练习表");
        template.setAnswerRange("B2:F20");
        template.setGradingRuleJson("{}");

        when(questionService.list(any(QueryWrapper.class))).thenReturn(List.of(question));
        when(questionExcelTemplateService.mapByQuestionIds(List.of(43L))).thenReturn(Map.of(43L, template));
        when(excelTemplateGradingService.loadWorkbookSnapshot("/uploads/demo.xlsx")).thenReturn(new ExcelWorkbookSnapshot());
        when(excelTemplateGradingService.buildRuleSummary("{}"))
                .thenReturn(Map.of("mode", "cell_range", "totalScore", 10, "cellRuleCount", 1));

        mockMvc.perform(get("/api/admin/questions/exceptions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.critical").value(1))
                .andExpect(jsonPath("$.records[0].questionId").value(43))
                .andExpect(jsonPath("$.records[0].code").value("missing_expected_snapshot"));
    }

    @Test
    void publishTestGradesStoredExpectedSnapshot() throws Exception {
        Question question = new Question();
        question.setId(44L);
        question.setTitle("发布前测试");
        question.setType("excel_template");
        question.setEnabled(true);

        QuestionExcelTemplate template = new QuestionExcelTemplate();
        template.setQuestionId(44L);
        template.setExpectedSnapshotJson("""
                {"requiredSheets":["练习表"],"cellValues":{"练习表!B2":51700}}
                """);
        template.setGradingRuleJson("{}");

        ExcelTemplateExpectedSnapshot expectedSnapshot = new ExcelTemplateExpectedSnapshot();
        expectedSnapshot.setRequiredSheets(List.of("练习表"));
        expectedSnapshot.setCellValues(Map.of("练习表!B2", 51700));
        ExcelTemplateEvaluation evaluation = new ExcelTemplateEvaluation();
        evaluation.setPassed(true);
        evaluation.setScore(10);
        evaluation.setTotalScore(10);
        evaluation.setFeedback("全部通过");

        when(questionService.getById(44L)).thenReturn(question);
        when(questionExcelTemplateService.getByQuestionId(44L)).thenReturn(template);
        when(excelTemplateGradingService.parseExpectedSnapshot(anyString())).thenReturn(expectedSnapshot);
        when(excelTemplateGradingService.grade(any(ExcelWorkbookSnapshot.class), anyString(), anyString()))
                .thenReturn(evaluation);

        mockMvc.perform(post("/api/admin/questions/44/publish-test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questionId").value(44))
                .andExpect(jsonPath("$.passed").value(true))
                .andExpect(jsonPath("$.score").value(10))
                .andExpect(jsonPath("$.totalScore").value(10));
    }
}
