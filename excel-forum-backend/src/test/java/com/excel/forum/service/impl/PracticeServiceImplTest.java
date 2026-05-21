package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.PracticeAnswer;
import com.excel.forum.entity.PracticeRecord;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.ExcelTemplateEvaluation;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.entity.dto.PracticeSubmitAnswerRequest;
import com.excel.forum.entity.dto.PracticeSubmitRequest;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.ExperienceRuleService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.PointsTaskService;
import com.excel.forum.service.PracticeQuestionSubmissionService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PracticeServiceImplTest {

    @Mock
    private QuestionCategoryService questionCategoryService;
    @Mock
    private QuestionService questionService;
    @Mock
    private PracticeRecordMapper practiceRecordMapper;
    @Mock
    private PracticeAnswerMapper practiceAnswerMapper;
    @Mock
    private ExperienceService experienceService;
    @Mock
    private ExperienceRuleService experienceRuleService;
    @Mock
    private PointsRecordService pointsRecordService;
    @Mock
    private PointsTaskService pointsTaskService;
    @Mock
    private QuestionExcelTemplateService questionExcelTemplateService;
    @Mock
    private ExcelTemplateGradingService excelTemplateGradingService;
    @Mock
    private UserService userService;
    @Mock
    private PracticeQuestionSubmissionService practiceQuestionSubmissionService;

    @Test
    void getPracticeCategoriesIncludesUncategorizedQuestions() {
        PracticeServiceImpl service = createService();

        Question question = buildExcelQuestion();
        question.setQuestionCategoryId(null);

        when(questionService.list(any(QueryWrapper.class))).thenReturn(List.of(question));
        when(questionCategoryService.listWithQuestionCount(true)).thenReturn(List.of());

        Map<String, Object> result = service.getPracticeCategories();

        assertThat(result.get("categories"))
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.list(Map.class))
                .singleElement()
                .satisfies(item -> {
                    assertThat(item.get("name")).isEqualTo("未分类");
                    assertThat(item.get("questionCount")).isEqualTo(1L);
                });
    }

    @Test
    void getPracticeQuestionListUsesUncategorizedLabelWhenCategoryMissing() {
        PracticeServiceImpl service = createService();

        Question question = buildExcelQuestion();
        question.setQuestionCategoryId(null);

        when(questionService.list(any(QueryWrapper.class))).thenReturn(List.of(question));
        when(questionExcelTemplateService.mapByQuestionIds(any())).thenReturn(Map.of());

        Map<String, Object> result = service.getPracticeQuestionList(null, null);

        assertThat(result.get("questions"))
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.list(Map.class))
                .singleElement()
                .satisfies(item -> {
                    assertThat(item.get("questionCategoryName")).isEqualTo("未分类");
                    assertThat(item.get("categoryName")).isEqualTo("未分类");
                });
    }

    @Test
    void getPracticeQuestionListDoesNotExposeSensitiveAnswerFields() {
        PracticeServiceImpl service = createService();

        Question question = buildExcelQuestion();
        question.setAnswer("=SUM(A:A)");
        question.setExplanation("标准解析只应在结果页展示");
        QuestionExcelTemplate template = buildTemplate();
        template.setAnswerSnapshotJson("{\"secret\":\"answer\"}");
        template.setExpectedSnapshotJson("{\"secret\":\"expected\"}");

        when(questionService.list(any(QueryWrapper.class))).thenReturn(List.of(question));
        when(questionExcelTemplateService.mapByQuestionIds(any())).thenReturn(Map.of(9L, template));

        Map<String, Object> result = service.getPracticeQuestionList(null, 7L);

        assertThat(result.get("questions"))
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.list(Map.class))
                .singleElement()
                .satisfies(item -> assertThat(item)
                        .doesNotContainKeys(
                                "answer",
                                "correctAnswer",
                                "explanation",
                                "templateFileUrl",
                                "answerSnapshotJson",
                                "expectedSnapshotJson"));
    }

    @Test
    void getPracticeQuestionDetailDoesNotExposeAnswerExplanationBeforeSubmit() {
        PracticeServiceImpl service = createService();

        Question question = buildExcelQuestion();
        question.setAnswer("=SUM(A:A)");
        question.setExplanation("先用 FILTER+UNIQUE 生成组合，再用 BYROW+SUMIFS 聚合。");
        QuestionExcelTemplate template = buildTemplate();
        template.setAnswerSheet("Sheet1");
        template.setAnswerRange("K10:P14");
        template.setAnswerSnapshotJson("{\"secret\":\"answer\"}");
        template.setExpectedSnapshotJson("{\"secret\":\"expected\"}");

        when(questionService.getOne(any(QueryWrapper.class), eq(false))).thenReturn(question);
        when(questionExcelTemplateService.getByQuestionId(9L)).thenReturn(template);
        when(excelTemplateGradingService.loadWorkbookSnapshot("/uploads/practice.xlsx")).thenReturn(new ExcelWorkbookSnapshot());

        Map<String, Object> result = service.getPracticeQuestionDetail(9L);

        assertThat(result).doesNotContainKey("answer");
        assertThat(result).doesNotContainKey("correctAnswer");
        assertThat(result).doesNotContainKey("explanation");
        assertThat(result).doesNotContainKey("templateFileUrl");
        assertThat(result).doesNotContainKey("answerSnapshotJson");
        assertThat(result).doesNotContainKey("expectedSnapshotJson");
        assertThat(result.get("hasTemplateFile")).isEqualTo(true);
        assertThat(result.get("title")).isEqualTo("销售汇总");
        assertThat(result.get("answerSheet")).isEqualTo("Sheet1");
        assertThat(result.get("answerRange")).isEqualTo("K10:P14");
    }

    @Test
    void getPracticeQuestionDetailClearsConfiguredAnswerCellsFromStudentWorkbook() {
        PracticeServiceImpl service = createService();

        Question question = buildExcelQuestion();
        QuestionExcelTemplate template = buildTemplate();
        template.setAnswerSheet("Sheet1");
        template.setAnswerRange("K10:P14");
        ExcelWorkbookSnapshot workbook = buildWorkbookWithCells("Sheet1", Map.of(
                "J10", cell("keep nearby prompt", null),
                "K10", cell("#NAME?", "LET(m,K6,result,TAKE(result,5))"),
                "L10", cell("#NAME?", "INDEX(K10#,1,2)"),
                "P14", cell(1680, null)
        ));

        when(questionService.getOne(any(QueryWrapper.class), eq(false))).thenReturn(question);
        when(questionExcelTemplateService.getByQuestionId(9L)).thenReturn(template);
        when(excelTemplateGradingService.loadWorkbookSnapshot("/uploads/practice.xlsx")).thenReturn(workbook);

        Map<String, Object> result = service.getPracticeQuestionDetail(9L);
        ExcelWorkbookSnapshot studentWorkbook = (ExcelWorkbookSnapshot) result.get("templateWorkbook");
        Map<String, ExcelWorkbookSnapshot.CellSnapshot> cells = studentWorkbook.getSheets().get(0).getCells();

        assertThat(cells).containsKey("J10");
        assertThat(cells).doesNotContainKeys("K10", "L10", "P14");
        assertThat(workbook.getSheets().get(0).getCells()).containsKeys("K10", "L10", "P14");
    }

    @Test
    void submitPracticeAwardsQuestionRewardOnlyOnFirstPass() {
        PracticeServiceImpl service = createService();

        Question question = buildExcelQuestion();
        QuestionExcelTemplate template = buildTemplate();
        ExcelWorkbookSnapshot workbook = new ExcelWorkbookSnapshot();
        ExcelTemplateEvaluation evaluation = new ExcelTemplateEvaluation();
        evaluation.setPassed(true);
        evaluation.setScore(1);
        evaluation.setTotalScore(1);
        evaluation.setFeedback("ok");
        evaluation.setRuleResults(List.of(Map.of("label", "答案区域", "passed", true)));
        evaluation.setNormalizedUserAnswer("{\"sheets\":[]}");
        evaluation.setNormalizedCorrectAnswer("{\"rangeValues\":{}}");

        when(questionService.list(any(QueryWrapper.class))).thenReturn(List.of(question));
        when(questionExcelTemplateService.getByQuestionId(9L)).thenReturn(template);
        when(excelTemplateGradingService.materializeSubmission(eq("/uploads/practice.xlsx"), any(ExcelWorkbookSnapshot.class))).thenReturn(workbook);
        when(excelTemplateGradingService.grade(eq(workbook), any(), any())).thenReturn(evaluation);
        when(experienceRuleService.resolveFixedExp(any(), eq(2))).thenReturn(2);
        when(pointsTaskService.awardTask(any(), any(), any(), any())).thenReturn(null);
        when(practiceRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of());
        when(pointsRecordService.count(any(QueryWrapper.class))).thenReturn(0L);
        when(pointsRecordService.addTaskPointsRecord(any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(true);
        doAnswer(invocation -> {
            PracticeRecord record = invocation.getArgument(0);
            record.setId(88L);
            return 1;
        }).when(practiceRecordMapper).insert(any(PracticeRecord.class));

        PracticeSubmitRequest request = new PracticeSubmitRequest();
        request.setQuestionCategoryId(3L);
        request.setCategoryId(3L);
        request.setMode("single_question");
        request.setDurationSeconds(45);
        PracticeSubmitAnswerRequest answerRequest = new PracticeSubmitAnswerRequest();
        answerRequest.setQuestionId(9L);
        answerRequest.setUserAnswer(Map.of("sheets", List.of()));
        request.setAnswers(List.of(answerRequest));

        Map<String, Object> result = service.submitPractice(7L, request);

        assertThat(result.get("rewardPoints")).isEqualTo(15);
        assertThat(result.get("firstPass")).isEqualTo(true);
        verify(pointsRecordService).addTaskPointsRecord(eq(7L), eq(null), eq("题目首通奖励"), eq("practice_question_pass"), eq(9L), eq(null), eq(15), eq("首次完成题目《销售汇总》"));

        ArgumentCaptor<PracticeAnswer> answerCaptor = ArgumentCaptor.forClass(PracticeAnswer.class);
        verify(practiceAnswerMapper).insert(answerCaptor.capture());
        PracticeAnswer savedAnswer = answerCaptor.getValue();
        assertThat(savedAnswer.getRewardPoints()).isEqualTo(15);
        assertThat(savedAnswer.getRewardGranted()).isTrue();
    }

    @Test
    void submitPracticeSkipsQuestionRewardWhenAlreadyPassed() {
        PracticeServiceImpl service = createService();

        Question question = buildExcelQuestion();
        QuestionExcelTemplate template = buildTemplate();
        ExcelWorkbookSnapshot workbook = new ExcelWorkbookSnapshot();
        ExcelTemplateEvaluation evaluation = new ExcelTemplateEvaluation();
        evaluation.setPassed(true);
        evaluation.setScore(1);
        evaluation.setTotalScore(1);
        evaluation.setFeedback("ok");
        evaluation.setRuleResults(List.of());
        evaluation.setNormalizedUserAnswer("{\"sheets\":[]}");
        evaluation.setNormalizedCorrectAnswer("{\"rangeValues\":{}}");

        when(questionService.list(any(QueryWrapper.class))).thenReturn(List.of(question));
        when(questionExcelTemplateService.getByQuestionId(9L)).thenReturn(template);
        when(excelTemplateGradingService.materializeSubmission(eq("/uploads/practice.xlsx"), any(ExcelWorkbookSnapshot.class))).thenReturn(workbook);
        when(excelTemplateGradingService.grade(eq(workbook), any(), any())).thenReturn(evaluation);
        when(experienceRuleService.resolveFixedExp(any(), eq(2))).thenReturn(2);
        when(pointsTaskService.awardTask(any(), any(), any(), any())).thenReturn(null);
        PracticeRecord previousRecord = new PracticeRecord();
        previousRecord.setId(66L);
        when(practiceRecordMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(previousRecord));
        when(practiceAnswerMapper.selectCount(any(QueryWrapper.class))).thenReturn(1L);
        doAnswer(invocation -> {
            PracticeRecord record = invocation.getArgument(0);
            record.setId(89L);
            return 1;
        }).when(practiceRecordMapper).insert(any(PracticeRecord.class));

        PracticeSubmitRequest request = new PracticeSubmitRequest();
        request.setQuestionCategoryId(3L);
        request.setCategoryId(3L);
        request.setMode("single_question");
        request.setDurationSeconds(30);
        PracticeSubmitAnswerRequest answerRequest = new PracticeSubmitAnswerRequest();
        answerRequest.setQuestionId(9L);
        answerRequest.setUserAnswer(Map.of("sheets", List.of()));
        request.setAnswers(List.of(answerRequest));

        Map<String, Object> result = service.submitPractice(7L, request);

        assertThat(result.get("rewardPoints")).isEqualTo(0);
        assertThat(result.get("firstPass")).isEqualTo(false);
        verify(pointsRecordService, never()).addTaskPointsRecord(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void submitPracticeGradesMaterializedWorkbookForSimpleExcelTemplate() {
        PracticeServiceImpl service = createService();

        Question question = buildExcelQuestion();
        QuestionExcelTemplate template = buildTemplate();
        ExcelWorkbookSnapshot materializedWorkbook = buildWorkbookWithCell("Sheet1", "B2", 10, "SUM(A1:A3)");
        ExcelTemplateEvaluation evaluation = new ExcelTemplateEvaluation();
        evaluation.setPassed(false);
        evaluation.setScore(0);
        evaluation.setTotalScore(1);
        evaluation.setFeedback("fail");
        evaluation.setRuleResults(List.of());
        evaluation.setNormalizedUserAnswer("{}");
        evaluation.setNormalizedCorrectAnswer("{}");

        when(questionService.list(any(QueryWrapper.class))).thenReturn(List.of(question));
        when(questionExcelTemplateService.getByQuestionId(9L)).thenReturn(template);
        when(excelTemplateGradingService.materializeSubmission(eq("/uploads/practice.xlsx"), any(ExcelWorkbookSnapshot.class))).thenReturn(materializedWorkbook);
        when(excelTemplateGradingService.grade(any(ExcelWorkbookSnapshot.class), any(), any())).thenReturn(evaluation);
        when(experienceRuleService.resolveFixedExp(any(), eq(2))).thenReturn(2);
        when(pointsTaskService.awardTask(any(), any(), any(), any())).thenReturn(null);
        doAnswer(invocation -> {
            PracticeRecord record = invocation.getArgument(0);
            record.setId(90L);
            return 1;
        }).when(practiceRecordMapper).insert(any(PracticeRecord.class));

        service.submitPractice(7L, buildSingleExcelSubmitRequest(Map.of("sheets", List.of())));

        ArgumentCaptor<ExcelWorkbookSnapshot> workbookCaptor = ArgumentCaptor.forClass(ExcelWorkbookSnapshot.class);
        verify(excelTemplateGradingService).grade(workbookCaptor.capture(), any(), any());
        assertThat(workbookCaptor.getValue()).isSameAs(materializedWorkbook);
    }

    @Test
    void submitPracticeKeepsClientCapturedWorkbookForDynamicArrayRules() {
        PracticeServiceImpl service = createService();

        Question question = buildExcelQuestion();
        QuestionExcelTemplate template = buildTemplate();
        template.setGradingRuleJson("{\"dynamicArrayRules\":[{\"sheet\":\"Sheet1\",\"anchorCell\":\"B2\",\"spillRange\":\"B2:C3\",\"score\":1}]}");
        ExcelWorkbookSnapshot submittedWorkbook = buildWorkbookWithCell("Sheet1", "C3", 2, null);
        ExcelWorkbookSnapshot incompleteMaterializedWorkbook = buildWorkbookWithCell("Sheet1", "B2", "A", "FILTER(A1:B9,A1:A9<>\"\")");
        ExcelTemplateEvaluation evaluation = new ExcelTemplateEvaluation();
        evaluation.setPassed(false);
        evaluation.setScore(0);
        evaluation.setTotalScore(1);
        evaluation.setFeedback("fail");
        evaluation.setRuleResults(List.of());
        evaluation.setNormalizedUserAnswer("{}");
        evaluation.setNormalizedCorrectAnswer("{}");

        when(questionService.list(any(QueryWrapper.class))).thenReturn(List.of(question));
        when(questionExcelTemplateService.getByQuestionId(9L)).thenReturn(template);
        when(excelTemplateGradingService.grade(any(ExcelWorkbookSnapshot.class), any(), any())).thenReturn(evaluation);
        when(experienceRuleService.resolveFixedExp(any(), eq(2))).thenReturn(2);
        when(pointsTaskService.awardTask(any(), any(), any(), any())).thenReturn(null);
        doAnswer(invocation -> {
            PracticeRecord record = invocation.getArgument(0);
            record.setId(91L);
            return 1;
        }).when(practiceRecordMapper).insert(any(PracticeRecord.class));

        service.submitPractice(7L, buildSingleExcelSubmitRequest(submittedWorkbook));

        ArgumentCaptor<ExcelWorkbookSnapshot> workbookCaptor = ArgumentCaptor.forClass(ExcelWorkbookSnapshot.class);
        verify(excelTemplateGradingService, never()).materializeSubmission(any(), any());
        verify(excelTemplateGradingService).grade(workbookCaptor.capture(), any(), any());
        assertThat(workbookCaptor.getValue()).isEqualTo(submittedWorkbook);
        assertThat(workbookCaptor.getValue()).isNotEqualTo(incompleteMaterializedWorkbook);
    }

    @Test
    void getPracticeHistoryDetailReturnsNullForOtherUsersRecord() {
        PracticeServiceImpl service = createService();
        PracticeRecord record = new PracticeRecord();
        record.setId(88L);
        record.setUserId(8L);

        when(practiceRecordMapper.selectById(88L)).thenReturn(record);

        assertThat(service.getPracticeHistoryDetail(7L, 88L)).isNull();
        verify(practiceAnswerMapper, never()).selectList(any(QueryWrapper.class));
    }

    private Question buildExcelQuestion() {
        Question question = new Question();
        question.setId(9L);
        question.setType("excel_template");
        question.setTitle("销售汇总");
        question.setDifficulty(2);
        question.setPoints(15);
        question.setEnabled(true);
        return question;
    }

    private PracticeServiceImpl createService() {
        return new PracticeServiceImpl(
                questionCategoryService,
                questionService,
                practiceRecordMapper,
                practiceAnswerMapper,
                new ObjectMapper(),
                experienceService,
                experienceRuleService,
                pointsRecordService,
                pointsTaskService,
                questionExcelTemplateService,
                excelTemplateGradingService,
                userService,
                practiceQuestionSubmissionService
        );
    }

    private PracticeSubmitRequest buildSingleExcelSubmitRequest(Object userAnswer) {
        PracticeSubmitRequest request = new PracticeSubmitRequest();
        request.setQuestionCategoryId(3L);
        request.setCategoryId(3L);
        request.setMode("single_question");
        request.setDurationSeconds(30);
        PracticeSubmitAnswerRequest answerRequest = new PracticeSubmitAnswerRequest();
        answerRequest.setQuestionId(9L);
        answerRequest.setUserAnswer(userAnswer);
        request.setAnswers(List.of(answerRequest));
        return request;
    }

    private ExcelWorkbookSnapshot buildWorkbookWithCell(String sheetName, String cellRef, Object value, String formula) {
        ExcelWorkbookSnapshot.CellSnapshot cell = new ExcelWorkbookSnapshot.CellSnapshot();
        cell.setValue(value);
        cell.setFormula(formula);

        return buildWorkbookWithCells(sheetName, Map.of(cellRef, cell));
    }

    private ExcelWorkbookSnapshot buildWorkbookWithCells(String sheetName, Map<String, ExcelWorkbookSnapshot.CellSnapshot> cells) {
        ExcelWorkbookSnapshot.SheetSnapshot sheet = new ExcelWorkbookSnapshot.SheetSnapshot();
        sheet.setName(sheetName);
        sheet.getCells().putAll(cells);

        ExcelWorkbookSnapshot workbook = new ExcelWorkbookSnapshot();
        workbook.getSheets().add(sheet);
        return workbook;
    }

    private ExcelWorkbookSnapshot.CellSnapshot cell(Object value, String formula) {
        ExcelWorkbookSnapshot.CellSnapshot cell = new ExcelWorkbookSnapshot.CellSnapshot();
        cell.setValue(value);
        cell.setFormula(formula);
        return cell;
    }

    private QuestionExcelTemplate buildTemplate() {
        QuestionExcelTemplate template = new QuestionExcelTemplate();
        template.setQuestionId(9L);
        template.setTemplateFileUrl("/uploads/practice.xlsx");
        template.setGradingRuleJson("{\"answerSheet\":\"Sheet1\",\"answerRange\":\"B2\",\"checkFormula\":true}");
        template.setExpectedSnapshotJson("{\"rangeValues\":{}}");
        return template;
    }
}
