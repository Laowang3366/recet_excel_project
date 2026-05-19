package com.excel.forum.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.excel.forum.entity.PracticeAnswer;
import com.excel.forum.entity.PracticeRecord;
import com.excel.forum.entity.QaCaseHelp;
import com.excel.forum.entity.QaCaseHelpAnswer;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.QaCaseAcceptRequest;
import com.excel.forum.entity.dto.QaCaseAnswerRequest;
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
}
