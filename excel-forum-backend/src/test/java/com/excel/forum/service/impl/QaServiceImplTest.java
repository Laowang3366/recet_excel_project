package com.excel.forum.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.excel.forum.entity.PracticeAnswer;
import com.excel.forum.entity.PracticeRecord;
import com.excel.forum.entity.QaCaseHelp;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.QaCaseAnswerRequest;
import com.excel.forum.entity.dto.QaSolutionShareRequest;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.mapper.QaCaseHelpAnswerMapper;
import com.excel.forum.mapper.QaCaseHelpMapper;
import com.excel.forum.mapper.QaSolutionShareMapper;
import com.excel.forum.service.AssistantService;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.contains;
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
    private PracticeAnswerMapper practiceAnswerMapper;
    @Mock
    private PracticeRecordMapper practiceRecordMapper;
    @Mock
    private UserService userService;
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
                practiceAnswerMapper,
                practiceRecordMapper,
                userService,
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

        User answerer = new User();
        answerer.setId(9L);
        answerer.setUsername("answerer");

        when(caseHelpMapper.selectById(30L)).thenReturn(qaCase);
        when(userService.getById(9L)).thenReturn(answerer);

        QaCaseAnswerRequest request = new QaCaseAnswerRequest();
        request.setAnswerFileUrl("/uploads/answer.xlsx");

        service.submitCaseAnswer(9L, 30L, request);

        verify(notificationService).createNotification(
                org.mockito.ArgumentMatchers.eq(7L),
                org.mockito.ArgumentMatchers.eq("qa_case_answered"),
                contains("销售榜单求助"),
                org.mockito.ArgumentMatchers.eq(30L)
        );
    }
}
