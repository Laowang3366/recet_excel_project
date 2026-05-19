package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.excel.forum.entity.PracticeChapter;
import com.excel.forum.entity.PracticeLevel;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PracticeCampaignServiceImplAttemptStatsTest {

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
    void chapterDetailIncludesLevelAttemptStats() {
        PracticeChapter chapter = new PracticeChapter();
        chapter.setId(1L);
        chapter.setWorldId(1L);
        chapter.setName("函数基础");
        chapter.setEnabled(true);

        PracticeLevel sumLevel = level(11L, "SUM");
        PracticeLevel averageLevel = level(12L, "AVERAGE");
        when(practiceChapterMapper.selectById(1L)).thenReturn(chapter);
        when(practiceChapterMapper.selectList(any())).thenReturn(List.of(chapter));
        when(practiceLevelMapper.selectList(any())).thenReturn(List.of(sumLevel, averageLevel));
        when(practiceAttemptMapper.selectMaps(any(Wrapper.class))).thenReturn(List.of(
                statsRow(11L, 3L, 2L),
                statsRow(12L, 0L, 0L)
        ));

        Map<String, Object> response = service.getCampaignChapterDetail(1L, null);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> levels = (List<Map<String, Object>>) response.get("levels");
        assertThat(levels).hasSize(2);
        assertThat(levels.get(0))
                .containsEntry("participantCount", 3L)
                .containsEntry("passedCount", 2L)
                .containsEntry("passRate", 66.7);
        assertThat(levels.get(1))
                .containsEntry("participantCount", 0L)
                .containsEntry("passedCount", 0L)
                .containsEntry("passRate", 0.0);
    }

    private PracticeLevel level(Long id, String title) {
        PracticeLevel level = new PracticeLevel();
        level.setId(id);
        level.setChapterId(1L);
        level.setQuestionId(id + 1000);
        level.setTitle(title);
        level.setEnabled(true);
        return level;
    }

    private Map<String, Object> statsRow(Long levelId, Long participantCount, Long passedCount) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("level_id", levelId);
        row.put("participant_count", participantCount);
        row.put("passed_count", passedCount);
        return row;
    }
}
