package com.excel.forum.service.impl;

import com.excel.forum.entity.PracticeChapter;
import com.excel.forum.entity.PracticeLevel;
import com.excel.forum.entity.UserLevelProgress;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Constructor;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PracticeCampaignServiceImplUnlockTest {

    @Test
    void chapterSummariesDefaultEveryChapterToUnlocked() throws Exception {
        PracticeCampaignServiceImpl service = newService();
        List<PracticeChapter> chapters = List.of(chapter(1L), chapter(2L));
        Map<Long, List<PracticeLevel>> levelsByChapterId = Map.of(
                1L, List.of(level(11L, 1L)),
                2L, List.of(level(21L, 2L))
        );

        List<Map<String, Object>> summaries = ReflectionTestUtils.invokeMethod(
                service,
                "buildChapterSummaries",
                chapters,
                levelsByChapterId,
                Map.<Long, UserLevelProgress>of()
        );

        assertThat(summaries).isNotNull();
        assertThat(summaries).extracting(item -> item.get("unlocked")).containsExactly(true, true);
    }

    @Test
    void levelNodesDefaultEveryUnfinishedLevelToAvailable() throws Exception {
        PracticeCampaignServiceImpl service = newService();

        List<Map<String, Object>> levels = ReflectionTestUtils.invokeMethod(
                service,
                "buildLevelNodes",
                List.of(level(11L, 1L), level(12L, 1L), level(13L, 1L)),
                Map.<Long, UserLevelProgress>of(),
                true
        );

        assertThat(levels).isNotNull();
        assertThat(levels).extracting(item -> item.get("status")).containsExactly("available", "available", "available");
    }

    private PracticeCampaignServiceImpl newService() throws Exception {
        Constructor<?> constructor = PracticeCampaignServiceImpl.class.getDeclaredConstructors()[0];
        Object[] args = new Object[constructor.getParameterCount()];
        return (PracticeCampaignServiceImpl) constructor.newInstance(args);
    }

    private PracticeChapter chapter(Long id) {
        PracticeChapter chapter = new PracticeChapter();
        chapter.setId(id);
        chapter.setWorldId(1L);
        chapter.setName("chapter-" + id);
        chapter.setEnabled(true);
        return chapter;
    }

    private PracticeLevel level(Long id, Long chapterId) {
        PracticeLevel level = new PracticeLevel();
        level.setId(id);
        level.setChapterId(chapterId);
        level.setQuestionId(id + 1000);
        level.setTitle("level-" + id);
        level.setEnabled(true);
        return level;
    }
}
