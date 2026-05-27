package com.excel.forum.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.excel.forum.entity.PracticeAnswer;
import com.excel.forum.entity.PracticeRecord;
import com.excel.forum.entity.QaCaseHelp;
import com.excel.forum.entity.QaCaseHelpAnswer;
import com.excel.forum.entity.QaCaseHelpFeedback;
import com.excel.forum.entity.QaSolutionShare;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.AdminQaAssignRequest;
import com.excel.forum.entity.dto.AdminQaFeaturedShareRequest;
import com.excel.forum.entity.dto.AdminQaFeedbackHandleRequest;
import com.excel.forum.entity.dto.AdminQaReviewRequest;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.entity.dto.QaCaseAcceptRequest;
import com.excel.forum.entity.dto.QaCaseAnswerRequest;
import com.excel.forum.entity.dto.QaCaseSnapshotAnswerRequest;
import com.excel.forum.entity.dto.QaSolutionShareRequest;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.mapper.QaCaseHelpAnswerMapper;
import com.excel.forum.mapper.QaCaseHelpAnswerVoteMapper;
import com.excel.forum.mapper.QaCaseHelpFeedbackMapper;
import com.excel.forum.mapper.QaCaseHelpMapper;
import com.excel.forum.mapper.QaSolutionShareMapper;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.AssistantService;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QaServiceImplTest {

    @Mock
    private QaSolutionShareMapper solutionShareMapper;
    @Mock
    private QaCaseHelpMapper caseHelpMapper;
    @Mock
    private QaCaseHelpAnswerMapper caseHelpAnswerMapper;
    @Mock
    private QaCaseHelpAnswerVoteMapper caseHelpAnswerVoteMapper;
    @Mock
    private QaCaseHelpFeedbackMapper caseHelpFeedbackMapper;
    @Mock
    private PracticeAnswerMapper practiceAnswerMapper;
    @Mock
    private PracticeRecordMapper practiceRecordMapper;
    @Mock
    private UserMapper userMapper;
    @Mock
    private UserService userService;
    @Mock
    private PointsRecordService pointsRecordService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private AssistantService assistantService;
    @Mock
    private ExcelTemplateGradingService excelTemplateGradingService;
    @Mock
    private FileRecycleService fileRecycleService;
    @Mock
    private FileStorageService fileStorageService;

    private QaServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new QaServiceImpl(
                solutionShareMapper,
                caseHelpMapper,
                caseHelpAnswerMapper,
                caseHelpAnswerVoteMapper,
                caseHelpFeedbackMapper,
                practiceAnswerMapper,
                practiceRecordMapper,
                userMapper,
                userService,
                pointsRecordService,
                notificationService,
                assistantService,
                excelTemplateGradingService,
                fileRecycleService,
                fileStorageService,
                new ObjectMapper()
        );
    }

    @Test
    void shareSolutionRejectsIncorrectAnswer() {
        PracticeAnswer answer = new PracticeAnswer();
        answer.setId(12L);
        answer.setRecordId(8L);
        answer.setIsCorrect(false);
        PracticeRecord record = new PracticeRecord();
        record.setId(8L);
        record.setUserId(7L);

        when(practiceAnswerMapper.selectById(12L)).thenReturn(answer);
        when(practiceRecordMapper.selectById(8L)).thenReturn(record);

        QaSolutionShareRequest request = new QaSolutionShareRequest();
        request.setAnswerId(12L);

        assertThatThrownBy(() -> service.shareSolution(7L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("仅支持分享已通过的答案");

        verify(solutionShareMapper, never()).insert(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void submitCaseAnswerNotifiesCaseOwner() {
        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setId(30L);
        qaCase.setUserId(7L);
        qaCase.setTitle("销售榜单求助");
        qaCase.setStatus("open");

        User answerer = new User();
        answerer.setId(9L);
        answerer.setUsername("answerer");

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);
        when(userService.getById(9L)).thenReturn(answerer);

        QaCaseAnswerRequest request = new QaCaseAnswerRequest();
        request.setAnswerFileUrl("/uploads/answer.xlsx");

        service.submitCaseAnswer(9L, 30L, request);

        ArgumentCaptor<QaCaseHelp> caseUpdateCaptor = ArgumentCaptor.forClass(QaCaseHelp.class);
        verify(caseHelpMapper).updateById(caseUpdateCaptor.capture());
        assertThat(caseUpdateCaptor.getValue().getStatus()).isEqualTo("answered");

        verify(notificationService).createNotification(
                org.mockito.ArgumentMatchers.eq(7L),
                org.mockito.ArgumentMatchers.eq("qa_case_answered"),
                contains("销售榜单求助"),
                org.mockito.ArgumentMatchers.eq(30L)
        );
    }

    @Test
    void submitCaseAnswerRejectsDuplicateActiveAnswerBeforeParsingFile() {
        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setId(30L);
        qaCase.setUserId(7L);
        qaCase.setStatus("open");

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);
        when(caseHelpAnswerMapper.selectCount(any())).thenReturn(1L);

        QaCaseAnswerRequest request = new QaCaseAnswerRequest();
        request.setAnswerFileUrl("/uploads/private/answer.xlsx");

        assertThatThrownBy(() -> service.submitCaseAnswer(9L, 30L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("已提交过答疑");

        verify(excelTemplateGradingService, never()).loadWorkbookSnapshot(any());
        verify(caseHelpAnswerMapper, never()).insert(any());
    }

    @Test
    void submitCaseAnswerFromSnapshotRejectsCaseAnswerCapBeforeBuildingWorkbook() {
        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setId(30L);
        qaCase.setUserId(7L);
        qaCase.setStatus("open");

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);
        when(caseHelpAnswerMapper.selectCount(any())).thenReturn(0L, 50L);

        QaCaseSnapshotAnswerRequest request = new QaCaseSnapshotAnswerRequest();
        request.setWorkbook(new ExcelWorkbookSnapshot());

        assertThatThrownBy(() -> service.submitCaseAnswerFromSnapshot(9L, 30L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("答疑数量已达上限");

        verify(excelTemplateGradingService, never()).buildWorkbookFileFromSnapshot(any(), any());
        verify(fileStorageService, never()).store(any(), any());
        verify(caseHelpAnswerMapper, never()).insert(any());
    }

    @Test
    void deleteCaseRejectsNonOwner() {
        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setId(30L);
        qaCase.setUserId(7L);
        qaCase.setStatus("open");

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);

        assertThatThrownBy(() -> service.deleteCase(8L, 30L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("只能操作自己的求助");

        verify(caseHelpMapper, never()).updateById(any());
    }

    @Test
    void updateCaseAnswerRejectsNonOwner() {
        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setId(44L);
        answer.setCaseId(30L);
        answer.setUserId(9L);
        answer.setStatus("active");

        when(caseHelpAnswerMapper.selectById(44L)).thenReturn(answer);

        QaCaseAnswerRequest request = new QaCaseAnswerRequest();
        request.setAnswerFileUrl("/uploads/private/answer.xlsx");

        assertThatThrownBy(() -> service.updateCaseAnswer(7L, 30L, 44L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("只能操作自己的答疑");

        verify(excelTemplateGradingService, never()).loadWorkbookSnapshot(any());
        verify(caseHelpAnswerMapper, never()).updateById(any());
    }

    @Test
    void deleteCaseAnswerRejectsNonOwner() {
        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setId(44L);
        answer.setCaseId(30L);
        answer.setUserId(9L);
        answer.setStatus("active");

        when(caseHelpAnswerMapper.selectById(44L)).thenReturn(answer);

        assertThatThrownBy(() -> service.deleteCaseAnswer(7L, 30L, 44L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("只能操作自己的答疑");

        verify(fileRecycleService, never()).recycleQaAnswer(any(), any());
    }

    @Test
    void loadCaseAnswerSnapshotUsesAnswerOwnedByCase() {
        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setId(30L);
        qaCase.setStatus("open");
        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setId(44L);
        answer.setCaseId(30L);
        answer.setAnswerFileUrl("/uploads/private/answer.xlsx");
        answer.setStatus("active");
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);
        when(caseHelpAnswerMapper.selectById(44L)).thenReturn(answer);
        when(excelTemplateGradingService.loadWorkbookSnapshot("/uploads/private/answer.xlsx")).thenReturn(snapshot);

        assertThat(service.loadCaseAnswerSnapshot(7L, 30L, 44L)).isSameAs(snapshot);
    }

    @Test
    void loadCaseAnswerSnapshotRejectsDeletedAnswer() {
        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setId(30L);
        qaCase.setStatus("open");
        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setId(44L);
        answer.setCaseId(30L);
        answer.setAnswerFileUrl("/uploads/private/answer.xlsx");
        answer.setStatus("deleted");

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);
        when(caseHelpAnswerMapper.selectById(44L)).thenReturn(answer);

        assertThatThrownBy(() -> service.loadCaseAnswerSnapshot(7L, 30L, 44L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("答疑不存在");

        verify(excelTemplateGradingService, never()).loadWorkbookSnapshot(any());
    }

    @Test
    void acceptCaseAnswerMarksAcceptedAndTransfersReward() {
        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setId(30L);
        qaCase.setUserId(7L);
        qaCase.setTitle("销售榜单求助");
        qaCase.setStatus("answered");

        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setId(44L);
        answer.setCaseId(30L);
        answer.setUserId(9L);
        answer.setStatus("active");
        answer.setRewardPoints(0);

        User owner = new User();
        owner.setId(7L);
        owner.setPoints(95);
        User answerer = new User();
        answerer.setId(9L);
        answerer.setUsername("answerer");
        answerer.setPoints(105);

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);
        when(caseHelpAnswerMapper.selectById(44L)).thenReturn(answer);
        when(userMapper.deductPoints(7L, 5)).thenReturn(1);
        when(userService.getById(7L)).thenReturn(owner);
        when(userService.getById(9L)).thenReturn(answerer);

        QaCaseAcceptRequest request = new QaCaseAcceptRequest();
        request.setRewardPoints(5);

        service.acceptCaseAnswer(7L, 30L, 44L, request);

        ArgumentCaptor<QaCaseHelpAnswer> answerCaptor = ArgumentCaptor.forClass(QaCaseHelpAnswer.class);
        verify(caseHelpAnswerMapper).updateById(answerCaptor.capture());
        assertThat(answerCaptor.getValue().getStatus()).isEqualTo("accepted");
        assertThat(answerCaptor.getValue().getRewardPoints()).isEqualTo(5);

        ArgumentCaptor<QaCaseHelp> caseCaptor = ArgumentCaptor.forClass(QaCaseHelp.class);
        verify(caseHelpMapper).updateById(caseCaptor.capture());
        assertThat(caseCaptor.getValue().getStatus()).isEqualTo("accepted");
        assertThat(caseCaptor.getValue().getAcceptedAnswerId()).isEqualTo(44L);

        verify(userMapper).addPoints(9L, 5);
        verify(pointsRecordService, org.mockito.Mockito.times(2)).save(any());
        verify(notificationService).createNotification(
                org.mockito.ArgumentMatchers.eq(9L),
                org.mockito.ArgumentMatchers.eq("qa_answer_accepted"),
                contains("销售榜单求助"),
                org.mockito.ArgumentMatchers.eq(30L)
        );
    }

    @Test
    void adminAssignCaseStoresAssignmentMetadata() {
        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setId(30L);
        qaCase.setUserId(7L);
        qaCase.setTitle("销售榜单求助");
        qaCase.setStatus("open");

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);

        AdminQaAssignRequest request = new AdminQaAssignRequest();
        request.setAssigneeUserId(88L);
        request.setNote("交给讲师处理");

        service.adminAssignCase(30L, 9L, request);

        ArgumentCaptor<QaCaseHelp> captor = ArgumentCaptor.forClass(QaCaseHelp.class);
        verify(caseHelpMapper).updateById(captor.capture());
        assertThat(captor.getValue().getAssignedUserId()).isEqualTo(88L);
        assertThat(captor.getValue().getAssignedBy()).isEqualTo(9L);
        assertThat(captor.getValue().getAssignmentNote()).isEqualTo("交给讲师处理");
        assertThat(captor.getValue().getAssignedAt()).isNotNull();
    }

    @Test
    void adminReviewCaseAnswerApprovesAndPersistsAuditMetadata() {
        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setId(44L);
        answer.setCaseId(30L);
        answer.setUserId(9L);
        answer.setStatus("active");

        when(caseHelpAnswerMapper.selectById(44L)).thenReturn(answer);

        AdminQaReviewRequest request = new AdminQaReviewRequest();
        request.setAction("approve");
        request.setNote("答案准确，可以发布");

        service.adminReviewCaseAnswer(44L, 5L, request);

        ArgumentCaptor<QaCaseHelpAnswer> captor = ArgumentCaptor.forClass(QaCaseHelpAnswer.class);
        verify(caseHelpAnswerMapper).updateById(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("approved");
        assertThat(captor.getValue().getReviewerId()).isEqualTo(5L);
        assertThat(captor.getValue().getReviewNote()).isEqualTo("答案准确，可以发布");
        assertThat(captor.getValue().getReviewedAt()).isNotNull();
        assertThat(captor.getValue().getPublishedAt()).isNotNull();
    }

    @Test
    void adminReviewCaseAnswerRejectsAndKeepsUnpublished() {
        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setId(44L);
        answer.setCaseId(30L);
        answer.setUserId(9L);
        answer.setStatus("active");

        when(caseHelpAnswerMapper.selectById(44L)).thenReturn(answer);

        AdminQaReviewRequest request = new AdminQaReviewRequest();
        request.setAction("reject");
        request.setNote("答案无法复现");

        service.adminReviewCaseAnswer(44L, 5L, request);

        ArgumentCaptor<QaCaseHelpAnswer> captor = ArgumentCaptor.forClass(QaCaseHelpAnswer.class);
        verify(caseHelpAnswerMapper).updateById(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("rejected");
        assertThat(captor.getValue().getPublishedAt()).isNull();
    }

    @Test
    void adminHandleFeedbackStoresHandledMetadata() {
        QaCaseHelpFeedback feedback = new QaCaseHelpFeedback();
        feedback.setId(70L);
        feedback.setCaseId(30L);
        feedback.setUserId(9L);
        feedback.setReason("unclear_requirement");
        feedback.setStatus("active");

        when(caseHelpFeedbackMapper.selectById(70L)).thenReturn(feedback);

        AdminQaFeedbackHandleRequest request = new AdminQaFeedbackHandleRequest();
        request.setStatus("handled");
        request.setNote("已补充说明");

        service.adminHandleFeedback(70L, 5L, request);

        ArgumentCaptor<QaCaseHelpFeedback> captor = ArgumentCaptor.forClass(QaCaseHelpFeedback.class);
        verify(caseHelpFeedbackMapper).updateById(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("handled");
        assertThat(captor.getValue().getHandledBy()).isEqualTo(5L);
        assertThat(captor.getValue().getHandleNote()).isEqualTo("已补充说明");
        assertThat(captor.getValue().getHandledAt()).isNotNull();
    }

    @Test
    void adminCreateFeaturedShareFromQaAnswerCreatesPublishedQaSource() {
        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setId(30L);
        qaCase.setUserId(7L);
        qaCase.setTitle("销售榜单求助");
        qaCase.setDescription("请检查 COUNTIFS 公式。");
        qaCase.setStatus("answered");

        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setId(44L);
        answer.setCaseId(30L);
        answer.setUserId(9L);
        answer.setStatus("approved");

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);
        when(caseHelpAnswerMapper.selectById(44L)).thenReturn(answer);

        AdminQaFeaturedShareRequest request = new AdminQaFeaturedShareRequest();
        request.setCaseId(30L);
        request.setAnswerId(44L);
        request.setTitle("多条件统计公式错误");
        request.setThoughtText("建议拆分条件检查。");

        service.adminCreateFeaturedShare(5L, request);

        ArgumentCaptor<QaSolutionShare> captor = ArgumentCaptor.forClass(QaSolutionShare.class);
        verify(solutionShareMapper).insert(captor.capture());
        assertThat(captor.getValue().getSourceType()).isEqualTo("qa_case");
        assertThat(captor.getValue().getUserId()).isEqualTo(9L);
        assertThat(captor.getValue().getQaCaseId()).isEqualTo(30L);
        assertThat(captor.getValue().getQaAnswerId()).isEqualTo(44L);
        assertThat(captor.getValue().getTitle()).isEqualTo("多条件统计公式错误");
        assertThat(captor.getValue().getStatus()).isEqualTo("published");
    }
}
