package com.excel.forum.service.impl;

import com.excel.forum.entity.PracticeChapter;
import com.excel.forum.entity.PracticeLevel;
import com.excel.forum.entity.PracticeWorld;
import com.excel.forum.mapper.DailyChallengeMapper;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeAttemptMapper;
import com.excel.forum.mapper.PracticeChapterMapper;
import com.excel.forum.mapper.PracticeLevelMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.mapper.PracticeWorldMapper;
import com.excel.forum.mapper.UserChapterProgressMapper;
import com.excel.forum.mapper.UserLevelProgressMapper;
import com.excel.forum.mapper.UserWrongQuestionMapper;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.PracticeService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PracticeCampaignServiceImplReadPathTest {

    @Mock
    private PracticeWorldMapper practiceWorldMapper;
    @Mock
    private PracticeChapterMapper practiceChapterMapper;
    @Mock
    private PracticeLevelMapper practiceLevelMapper;
    @Mock
    private DailyChallengeMapper dailyChallengeMapper;
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
    private PointsRecordService pointsRecordService;
    @Mock
    private ExperienceService experienceService;
    @Mock
    private PracticeCampaignCatalogSyncService catalogSyncService;
    @Mock
    private PracticeCampaignRewardService rewardService;

    @InjectMocks
    private PracticeCampaignServiceImpl service;

    @BeforeEach
    void setUp() {
        PracticeWorld world = new PracticeWorld();
        world.setId(1L);
        world.setName("Excel 闯关");
        world.setDescription("desc");
        when(practiceWorldMapper.selectOne(any())).thenReturn(world);
        when(practiceChapterMapper.selectList(any())).thenReturn(List.of());
        when(practiceLevelMapper.selectList(any())).thenReturn(List.of());
    }

    @Test
    void campaignOverviewReadDoesNotSyncCatalog() {
        service.getCampaignOverview(null);

        verify(questionService, never()).list(any(com.baomidou.mybatisplus.core.conditions.Wrapper.class));
        verify(questionCategoryService, never()).list();
        verify(practiceChapterMapper, never()).insert(any(PracticeChapter.class));
        verify(practiceChapterMapper, never()).updateById(any(PracticeChapter.class));
        verify(practiceLevelMapper, never()).insert(any(PracticeLevel.class));
        verify(practiceLevelMapper, never()).updateById(any(PracticeLevel.class));
    }
}
