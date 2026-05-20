package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.PracticeChapter;
import com.excel.forum.entity.PracticeLevel;
import com.excel.forum.entity.PracticeWorld;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionCategory;
import com.excel.forum.mapper.PracticeChapterMapper;
import com.excel.forum.mapper.PracticeLevelMapper;
import com.excel.forum.mapper.PracticeWorldMapper;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static com.excel.forum.util.QueryPageUtils.first;

@Service
@RequiredArgsConstructor
class PracticeCampaignCatalogSyncService {
    private static final String DEFAULT_WORLD_NAME = "Excel 闯关";
    private static final String UNCATEGORIZED_CHAPTER_NAME = "未分类挑战";

    private final PracticeWorldMapper practiceWorldMapper;
    private final PracticeChapterMapper practiceChapterMapper;
    private final PracticeLevelMapper practiceLevelMapper;
    private final QuestionService questionService;
    private final QuestionCategoryService questionCategoryService;

    synchronized void syncCampaignCatalog() {
        Long worldId = ensurePracticeWorldId();
        List<Question> campaignQuestions = questionService.list(new QueryWrapper<Question>()
                .eq("type", "excel_template")
                .isNull("deleted_at"));
        Map<Long, QuestionCategory> categoryMap = questionCategoryService.list().stream()
                .collect(Collectors.toMap(QuestionCategory::getId, item -> item, (left, right) -> left, LinkedHashMap::new));

        Map<Long, List<Question>> questionsByCategoryId = campaignQuestions.stream()
                .filter(item -> item.getQuestionCategoryId() != null)
                .collect(Collectors.groupingBy(Question::getQuestionCategoryId, LinkedHashMap::new, Collectors.toCollection(ArrayList::new)));
        boolean hasEnabledUncategorized = campaignQuestions.stream()
                .anyMatch(item -> Boolean.TRUE.equals(item.getEnabled()) && item.getQuestionCategoryId() == null);
        Map<Long, PracticeLevel> levelByQuestionId = practiceLevelMapper.selectList(new QueryWrapper<PracticeLevel>())
                .stream()
                .filter(item -> item.getQuestionId() != null)
                .collect(Collectors.toMap(PracticeLevel::getQuestionId, item -> item, (left, right) -> left, LinkedHashMap::new));

        Map<Long, PracticeChapter> chapterByCategoryId = new LinkedHashMap<>();
        for (QuestionCategory category : categoryMap.values()) {
            if (category == null || !Boolean.TRUE.equals(category.getEnabled())) {
                continue;
            }
            PracticeChapter chapter = findOrCreateChapterForCategory(
                    worldId,
                    category,
                    questionsByCategoryId.getOrDefault(category.getId(), List.of()),
                    levelByQuestionId
            );
            chapter.setWorldId(worldId);
            chapter.setName(category.getName());
            chapter.setDescription(defaultText(category.getDescription(), category.getName() + "练习章节"));
            chapter.setUnlockStar(0);
            chapter.setRequiredLevel(0);
            chapter.setSortOrder(category.getSortOrder() == null ? 0 : category.getSortOrder());
            chapter.setEnabled(true);
            saveChapter(chapter);
            chapterByCategoryId.put(category.getId(), chapter);
        }

        PracticeChapter uncategorizedChapter = null;
        if (hasEnabledUncategorized) {
            uncategorizedChapter = findOrCreateChapterByName(worldId, UNCATEGORIZED_CHAPTER_NAME);
            uncategorizedChapter.setWorldId(worldId);
            uncategorizedChapter.setName(UNCATEGORIZED_CHAPTER_NAME);
            uncategorizedChapter.setDescription("未归类题目的练习章节");
            uncategorizedChapter.setUnlockStar(0);
            uncategorizedChapter.setRequiredLevel(0);
            uncategorizedChapter.setSortOrder(999999);
            uncategorizedChapter.setEnabled(true);
            saveChapter(uncategorizedChapter);
        }

        List<PracticeChapter> existingChapters = practiceChapterMapper.selectList(new QueryWrapper<PracticeChapter>()
                .eq("world_id", worldId)
                .orderByAsc("sort_order")
                .orderByAsc("id"));
        Set<Long> activeChapterIds = new LinkedHashSet<>(chapterByCategoryId.values().stream()
                .map(PracticeChapter::getId)
                .filter(Objects::nonNull)
                .toList());
        if (uncategorizedChapter != null && uncategorizedChapter.getId() != null) {
            activeChapterIds.add(uncategorizedChapter.getId());
        }
        for (PracticeChapter chapter : existingChapters) {
            if (!activeChapterIds.contains(chapter.getId())) {
                chapter.setEnabled(false);
                practiceChapterMapper.updateById(chapter);
            }
        }

        for (Question question : campaignQuestions) {
            PracticeLevel level = levelByQuestionId.get(question.getId());
            boolean validCampaignQuestion = Boolean.TRUE.equals(question.getEnabled())
                    && (question.getQuestionCategoryId() == null
                    || (categoryMap.containsKey(question.getQuestionCategoryId())
                    && Boolean.TRUE.equals(categoryMap.get(question.getQuestionCategoryId()).getEnabled())));

            if (!validCampaignQuestion) {
                if (level != null && Boolean.TRUE.equals(level.getEnabled())) {
                    level.setEnabled(false);
                    practiceLevelMapper.updateById(level);
                }
                continue;
            }

            PracticeChapter targetChapter = question.getQuestionCategoryId() == null
                    ? uncategorizedChapter
                    : chapterByCategoryId.get(question.getQuestionCategoryId());
            if (targetChapter == null || targetChapter.getId() == null) {
                continue;
            }

            if (level == null) {
                level = new PracticeLevel();
                level.setQuestionId(question.getId());
                level.setTitle(defaultText(question.getTitle(), "关卡 " + question.getId()));
                level.setLevelType(resolveLevelType(question.getDifficulty()));
                level.setDifficulty(resolveLevelDifficulty(question.getDifficulty()));
                level.setTargetTimeSeconds(resolveTargetTimeSeconds(question.getDifficulty()));
                level.setRewardExp(resolveRewardExp(question.getDifficulty()));
                level.setRewardPoints(question.getPoints() == null || question.getPoints() <= 0 ? 5 : question.getPoints());
                level.setFirstPassBonus(0);
                level.setSortOrder(question.getId().intValue());
                level.setEnabled(true);
            }
            level.setChapterId(targetChapter.getId());
            if (!Boolean.TRUE.equals(level.getEnabled()) && Boolean.TRUE.equals(question.getEnabled())) {
                level.setEnabled(true);
            }
            if (level.getId() == null) {
                practiceLevelMapper.insert(level);
            } else {
                practiceLevelMapper.updateById(level);
            }
        }
    }

    private Long ensurePracticeWorldId() {
        QueryWrapper<PracticeWorld> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("enabled", true).orderByAsc("sort_order").orderByAsc("id");
        PracticeWorld world = practiceWorldMapper.selectOne(queryWrapper);
        if (world != null) {
            return world.getId();
        }
        PracticeWorld created = new PracticeWorld();
        created.setName(DEFAULT_WORLD_NAME);
        created.setDescription("从基础到进阶，逐步攻克 Excel 关卡试炼");
        created.setSortOrder(1);
        created.setEnabled(true);
        practiceWorldMapper.insert(created);
        return created.getId();
    }

    private PracticeChapter findOrCreateChapterForCategory(
            Long worldId,
            QuestionCategory category,
            List<Question> questions,
            Map<Long, PracticeLevel> levelByQuestionId) {
        Set<Long> linkedChapterIds = questions.stream()
                .map(Question::getId)
                .map(levelByQuestionId::get)
                .filter(Objects::nonNull)
                .map(PracticeLevel::getChapterId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!linkedChapterIds.isEmpty()) {
            PracticeChapter chapter = practiceChapterMapper.selectById(linkedChapterIds.iterator().next());
            if (chapter != null) {
                return chapter;
            }
        }
        return findOrCreateChapterByName(worldId, category.getName());
    }

    private PracticeChapter findOrCreateChapterByName(Long worldId, String chapterName) {
        QueryWrapper<PracticeChapter> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("world_id", worldId).eq("name", chapterName).orderByAsc("id");
        PracticeChapter chapter = first(practiceChapterMapper, queryWrapper);
        return chapter == null ? new PracticeChapter() : chapter;
    }

    private void saveChapter(PracticeChapter chapter) {
        if (chapter.getId() == null) {
            practiceChapterMapper.insert(chapter);
        } else {
            practiceChapterMapper.updateById(chapter);
        }
    }

    private String resolveLevelType(Integer difficulty) {
        int value = difficulty == null ? 1 : difficulty;
        if (value >= 4) {
            return "boss";
        }
        if (value == 3) {
            return "elite";
        }
        return "normal";
    }

    private String resolveLevelDifficulty(Integer difficulty) {
        int value = difficulty == null ? 1 : difficulty;
        if (value >= 4) {
            return "expert";
        }
        if (value == 3) {
            return "hard";
        }
        if (value == 2) {
            return "medium";
        }
        return "easy";
    }

    private Integer resolveTargetTimeSeconds(Integer difficulty) {
        int value = difficulty == null ? 1 : difficulty;
        if (value >= 4) {
            return 720;
        }
        if (value == 3) {
            return 540;
        }
        if (value == 2) {
            return 420;
        }
        return 300;
    }

    private Integer resolveRewardExp(Integer difficulty) {
        int value = difficulty == null ? 1 : difficulty;
        if (value >= 4) {
            return 50;
        }
        if (value == 3) {
            return 35;
        }
        if (value == 2) {
            return 20;
        }
        return 10;
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
