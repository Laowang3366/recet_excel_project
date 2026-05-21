package com.excel.forum.service.impl;

import com.excel.forum.entity.PracticeAttempt;
import com.excel.forum.entity.dto.PracticeCampaignSubmitRequest;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeAttemptMapper;
import com.excel.forum.mapper.PracticeChapterMapper;
import com.excel.forum.mapper.PracticeLevelMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.mapper.PracticeWorldMapper;
import com.excel.forum.mapper.UserChapterProgressMapper;
import com.excel.forum.mapper.UserLevelProgressMapper;
import com.excel.forum.mapper.UserWrongQuestionMapper;
import com.excel.forum.service.PracticeService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class PracticeCampaignServiceImplSubmitTest {
    @Mock
    private PracticeWorldMapper practiceWorldMapper;
    @Mock
    private PracticeChapterMapper practiceChapterMapper;
    @Mock
    private PracticeLevelMapper practiceLevelMapper;
    @Mock
    private PracticeAttemptMapper practiceAttemptMapper;
    @Mock
    private PracticeRecordMapper practiceRecordMapper;
    @Mock
    private PracticeAnswerMapper practiceAnswerMapper;
    @Mock
    private UserLevelProgressMapper userLevelProgressMapper;
    @Mock
    private UserChapterProgressMapper userChapterProgressMapper;
    @Mock
    private UserWrongQuestionMapper userWrongQuestionMapper;
    @Mock
    private PracticeService practiceService;
    @Mock
    private QuestionService questionService;
    @Mock
    private QuestionCategoryService questionCategoryService;
    @Mock
    private UserService userService;
    @Mock
    private PracticeCampaignCatalogSyncService catalogSyncService;
    @Mock
    private PracticeCampaignRewardService rewardService;

    @InjectMocks
    private PracticeCampaignServiceImpl service;

    @Test
    void submitCampaignLevelRejectsAlreadyFinalAttemptBeforePracticeSubmit() {
        PracticeAttempt attempt = new PracticeAttempt();
        attempt.setId(88L);
        attempt.setUserId(7L);
        attempt.setLevelId(3L);
        attempt.setQuestionId(9L);
        attempt.setResultStatus("passed");
        when(practiceAttemptMapper.selectById(88L)).thenReturn(attempt);

        PracticeCampaignSubmitRequest request = new PracticeCampaignSubmitRequest();
        request.setAttemptId(88L);
        request.setUserAnswer("A");

        assertThatThrownBy(() -> service.submitCampaignLevel(3L, 7L, request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("挑战已提交");

        verify(practiceService, never()).submitPractice(any(), any());
    }
}
