package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.PracticeAnswer;
import com.excel.forum.entity.PracticeAttempt;
import com.excel.forum.entity.PracticeChapter;
import com.excel.forum.entity.PracticeLevel;
import com.excel.forum.entity.PracticeRecord;
import com.excel.forum.entity.PracticeWorld;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.UserChapterProgress;
import com.excel.forum.entity.UserLevelProgress;
import com.excel.forum.entity.UserWrongQuestion;
import com.excel.forum.entity.dto.PracticeCampaignStartRequest;
import com.excel.forum.entity.dto.PracticeCampaignSubmitRequest;
import com.excel.forum.entity.dto.PracticeSubmitAnswerRequest;
import com.excel.forum.entity.dto.PracticeSubmitRequest;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeAttemptMapper;
import com.excel.forum.mapper.PracticeChapterMapper;
import com.excel.forum.mapper.PracticeLevelMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.mapper.PracticeWorldMapper;
import com.excel.forum.mapper.UserChapterProgressMapper;
import com.excel.forum.mapper.UserLevelProgressMapper;
import com.excel.forum.mapper.UserWrongQuestionMapper;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.PracticeService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Comparator;
import java.util.stream.Collectors;

import static com.excel.forum.util.QueryPageUtils.first;

@Service
@RequiredArgsConstructor
public class PracticeCampaignServiceImpl implements PracticeCampaignService {
    private final PracticeWorldMapper practiceWorldMapper;
    private final PracticeChapterMapper practiceChapterMapper;
    private final PracticeLevelMapper practiceLevelMapper;
    private final PracticeAttemptMapper practiceAttemptMapper;
    private final PracticeRecordMapper practiceRecordMapper;
    private final PracticeAnswerMapper practiceAnswerMapper;
    private final UserLevelProgressMapper userLevelProgressMapper;
    private final UserChapterProgressMapper userChapterProgressMapper;
    private final UserWrongQuestionMapper userWrongQuestionMapper;
    private final PracticeService practiceService;
    private final QuestionService questionService;
    private final QuestionCategoryService questionCategoryService;
    private final UserService userService;
    private final PracticeCampaignCatalogSyncService catalogSyncService;
    private final PracticeCampaignRewardService rewardService;

    @Override
    public void syncCampaignCatalog() {
        catalogSyncService.syncCampaignCatalog();
    }

    @Override
    public Map<String, Object> getCampaignOverview(Long userId) {
        List<PracticeChapter> chapters = listEnabledChapters();
        Map<Long, List<PracticeLevel>> levelsByChapterId = listEnabledLevelsByChapterId();
        Map<Long, UserLevelProgress> progressMap = findUserLevelProgressMap(userId);
        List<Map<String, Object>> chapterSummaries = buildChapterSummaries(chapters, levelsByChapterId, progressMap);
        Map<String, Object> currentChapter = chapterSummaries.stream()
                .filter(item -> Boolean.TRUE.equals(item.get("unlocked")))
                .findFirst()
                .orElse(chapterSummaries.stream().findFirst().orElse(null));

        Map<String, Object> currentLevel = null;
        if (currentChapter != null) {
            Long chapterId = toLong(currentChapter.get("id"));
            List<Map<String, Object>> levels = buildLevelNodes(
                    levelsByChapterId.getOrDefault(chapterId, List.of()),
                    progressMap,
                    Boolean.TRUE.equals(currentChapter.get("unlocked"))
            );
            currentLevel = levels.stream()
                    .filter(item -> "available".equals(item.get("status")))
                    .findFirst()
                    .orElse(levels.stream().findFirst().orElse(null));
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalStars", progressMap.values().stream().map(UserLevelProgress::getStars).filter(Objects::nonNull).mapToInt(Integer::intValue).sum());
        summary.put("clearedLevels", progressMap.values().stream().filter(item -> !"locked".equals(item.getStatus())).count());
        summary.put("perfectLevels", progressMap.values().stream().filter(item -> item.getStars() != null && item.getStars() >= 3).count());
        summary.put("currentStreak", calculateCurrentStreak(chapters, levelsByChapterId, progressMap));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("world", buildWorldPayload());
        response.put("currentChapter", currentChapter);
        response.put("currentLevel", currentLevel);
        response.put("dailyChallenge", buildDailyChallengePayload(userId));
        response.put("summary", summary);
        return response;
    }

    @Override
    public Map<String, Object> getCampaignChapters(Long userId) {
        List<PracticeChapter> chapters = listEnabledChapters();
        Map<Long, List<PracticeLevel>> levelsByChapterId = listEnabledLevelsByChapterId();
        Map<Long, UserLevelProgress> progressMap = findUserLevelProgressMap(userId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("world", buildWorldPayload());
        response.put("chapters", buildChapterSummaries(chapters, levelsByChapterId, progressMap));
        return response;
    }

    @Override
    public Map<String, Object> getCampaignChapterDetail(Long chapterId, Long userId) {
        PracticeChapter chapter = practiceChapterMapper.selectById(chapterId);
        if (chapter == null || !Boolean.TRUE.equals(chapter.getEnabled())) {
            throw new IllegalArgumentException("章节不存在");
        }

        List<PracticeChapter> allChapters = listEnabledChapters();
        Map<Long, List<PracticeLevel>> levelsByChapterId = listEnabledLevelsByChapterId();
        Map<Long, UserLevelProgress> progressMap = findUserLevelProgressMap(userId);
        Map<Long, Map<String, Object>> chapterSummaryMap = buildChapterSummaries(allChapters, levelsByChapterId, progressMap)
                .stream()
                .collect(Collectors.toMap(item -> toLong(item.get("id")), item -> item, (left, right) -> left, LinkedHashMap::new));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("chapter", chapterSummaryMap.get(chapterId));
        List<PracticeLevel> chapterLevels = levelsByChapterId.getOrDefault(chapterId, List.of());
        response.put("levels", buildLevelNodes(
                chapterLevels,
                progressMap,
                Boolean.TRUE.equals(chapterSummaryMap.getOrDefault(chapterId, Map.of()).get("unlocked")),
                findAttemptStatsByLevelIds(chapterLevels)
        ));
        return response;
    }

    @Override
    public Map<String, Object> getCampaignLevelDetail(Long levelId, Long userId) {
        PracticeLevel level = practiceLevelMapper.selectById(levelId);
        if (level == null || !Boolean.TRUE.equals(level.getEnabled())) {
            throw new IllegalArgumentException("关卡不存在");
        }

        PracticeChapter chapter = practiceChapterMapper.selectById(level.getChapterId());
        Question question = questionService.getById(level.getQuestionId());
        Map<Long, UserLevelProgress> progressMap = findUserLevelProgressMap(userId);
        List<PracticeChapter> allChapters = listEnabledChapters();
        Map<Long, List<PracticeLevel>> levelsByChapterId = listEnabledLevelsByChapterId();
        Map<Long, Map<String, Object>> chapterSummaryMap = buildChapterSummaries(allChapters, levelsByChapterId, progressMap)
                .stream()
                .collect(Collectors.toMap(item -> toLong(item.get("id")), item -> item, (left, right) -> left, LinkedHashMap::new));
        boolean chapterUnlocked = Boolean.TRUE.equals(chapterSummaryMap.getOrDefault(level.getChapterId(), Map.of()).get("unlocked"));
        List<PracticeLevel> chapterLevels = levelsByChapterId.getOrDefault(level.getChapterId(), List.of());
        Map<String, Object> levelNode = buildLevelNodes(chapterLevels, progressMap, chapterUnlocked, findAttemptStatsByLevelIds(chapterLevels))
                .stream()
                .filter(item -> levelId.equals(toLong(item.get("id"))))
                .findFirst()
                .orElse(Map.of());

        Map<String, Object> questionPayload = new LinkedHashMap<>();
        if (question != null && question.getDeletedAt() == null) {
            questionPayload.put("id", question.getId());
            questionPayload.put("title", question.getTitle());
            questionPayload.put("difficulty", question.getDifficulty());
            questionPayload.put("points", question.getPoints());
            questionPayload.put("questionCategoryId", question.getQuestionCategoryId());
            questionPayload.put("questionCategoryName", resolveQuestionCategoryName(question.getQuestionCategoryId()));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("chapter", chapterSummaryMap.get(level.getChapterId()));
        response.put("level", levelNode);
        response.put("question", questionPayload);
        return response;
    }

    @Override
    public Map<String, Object> getDailyChallenge(Long userId) {
        Map<String, Object> payload = buildDailyChallengePayload(userId);
        if (payload == null) {
            Map<Long, UserLevelProgress> progressMap = findUserLevelProgressMap(userId);
            List<PracticeChapter> chapters = listEnabledChapters();
            Map<Long, List<PracticeLevel>> levelsByChapterId = listEnabledLevelsByChapterId();
            List<Map<String, Object>> summaries = buildChapterSummaries(chapters, levelsByChapterId, progressMap);
            Map<String, Object> currentChapter = summaries.stream()
                    .filter(item -> Boolean.TRUE.equals(item.get("unlocked")))
                    .findFirst()
                    .orElse(null);
            if (currentChapter != null) {
                List<Map<String, Object>> levels = buildLevelNodes(
                        levelsByChapterId.getOrDefault(toLong(currentChapter.get("id")), List.of()),
                        progressMap,
                        true
                );
                Map<String, Object> available = levels.stream()
                        .filter(item -> "available".equals(item.get("status")) || "cleared".equals(item.get("status")) || "perfect".equals(item.get("status")))
                        .findFirst()
                        .orElse(null);
                if (available != null) {
                    payload = new LinkedHashMap<>();
                    payload.put("configured", false);
                    payload.put("levelId", available.get("id"));
                    payload.put("title", available.get("title"));
                    payload.put("rewardExp", available.get("rewardExp"));
                    payload.put("rewardPoints", available.get("rewardPoints"));
                }
            }
        }
        if (payload == null) {
            payload = Map.of();
        }
        return Map.of("challenge", payload);
    }

    @Override
    public Map<String, Object> getCampaignWrongQuestions(Long userId) {
        if (userId == null) {
            throw new IllegalStateException("未登录");
        }
        QueryWrapper<UserWrongQuestion> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).eq("resolved", false).orderByDesc("last_wrong_time");
        List<UserWrongQuestion> wrongs = userWrongQuestionMapper.selectList(queryWrapper);
        List<Long> questionIds = wrongs.stream().map(UserWrongQuestion::getQuestionId).filter(Objects::nonNull).toList();
        Map<Long, Question> questionMap = questionIds.isEmpty()
                ? Map.of()
                : questionService.listByIds(questionIds).stream().collect(Collectors.toMap(Question::getId, item -> item, (left, right) -> left));

        List<Map<String, Object>> records = wrongs.stream().map(item -> {
            Question question = questionMap.get(item.getQuestionId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId());
            row.put("questionId", item.getQuestionId());
            row.put("levelId", item.getLevelId());
            row.put("title", question == null ? "未知题目" : question.getTitle());
            row.put("wrongCount", item.getWrongCount());
            row.put("lastWrongTime", item.getLastWrongTime());
            row.put("recommendedLevelId", item.getLevelId());
            row.put("difficulty", question == null ? 1 : question.getDifficulty());
            return row;
        }).toList();

        return Map.of("records", records);
    }

    @Override
    public Map<String, Object> resolveWrongQuestion(Long userId, Long wrongQuestionId) {
        if (userId == null) {
            throw new IllegalStateException("未登录");
        }
        UserWrongQuestion wrongQuestion = userWrongQuestionMapper.selectById(wrongQuestionId);
        if (wrongQuestion == null || !Objects.equals(wrongQuestion.getUserId(), userId)) {
            throw new IllegalArgumentException("错题记录不存在");
        }
        wrongQuestion.setResolved(true);
        userWrongQuestionMapper.updateById(wrongQuestion);
        return Map.of("message", "错题已标记为已掌握");
    }

    @Override
    public Map<String, Object> getCampaignRankings(String scope) {
        String normalizedScope = scope == null || scope.isBlank() ? "all" : scope.trim().toLowerCase();
        if ("all".equals(normalizedScope)) {
            QueryWrapper<UserLevelProgress> queryWrapper = new QueryWrapper<>();
            queryWrapper.ne("status", "locked");
            List<UserLevelProgress> progressList = userLevelProgressMapper.selectList(queryWrapper);
            if (progressList.isEmpty()) {
                return Map.of("scope", normalizedScope, "records", List.of());
            }

            Map<Long, List<UserLevelProgress>> progressByUser = progressList.stream()
                    .collect(Collectors.groupingBy(UserLevelProgress::getUserId, LinkedHashMap::new, Collectors.toCollection(ArrayList::new)));
            Map<Long, com.excel.forum.entity.User> userMap = userService.listByIds(progressByUser.keySet()).stream()
                    .collect(Collectors.toMap(com.excel.forum.entity.User::getId, item -> item, (left, right) -> left));

            List<Map<String, Object>> records = progressByUser.entrySet().stream()
                    .map(entry -> {
                        long cleared = entry.getValue().stream().filter(item -> item.getStars() != null && item.getStars() > 0).count();
                        long perfect = entry.getValue().stream().filter(item -> item.getStars() != null && item.getStars() >= 3).count();
                        int totalStars = entry.getValue().stream().map(UserLevelProgress::getStars).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
                        int totalScore = entry.getValue().stream().map(UserLevelProgress::getBestScore).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
                        var user = userMap.get(entry.getKey());
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("userId", entry.getKey());
                        row.put("username", user == null ? "匿名用户" : user.getUsername());
                        row.put("avatar", user == null ? null : user.getAvatar());
                        row.put("clearedLevels", cleared);
                        row.put("perfectLevels", perfect);
                        row.put("totalStars", totalStars);
                        row.put("totalScore", totalScore);
                        return row;
                    })
                    .sorted(
                            Comparator.<Map<String, Object>, Integer>comparing(item -> toInt(item.get("totalStars"))).reversed()
                                    .thenComparing(item -> toInt(item.get("perfectLevels")), Comparator.reverseOrder())
                                    .thenComparing(item -> toInt(item.get("totalScore")), Comparator.reverseOrder())
                    )
                    .limit(20)
                    .collect(Collectors.toCollection(ArrayList::new));

            for (int index = 0; index < records.size(); index += 1) {
                records.get(index).put("rank", index + 1);
            }
            return Map.of("scope", normalizedScope, "records", records);
        }

        QueryWrapper<PracticeAttempt> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("result_status", "passed");
        if ("daily".equals(normalizedScope)) {
            queryWrapper.ge("submit_time", LocalDate.now().atStartOfDay());
        } else if ("weekly".equals(normalizedScope)) {
            queryWrapper.ge("submit_time", LocalDate.now().minusDays(6).atStartOfDay());
        }
        List<PracticeAttempt> attempts = practiceAttemptMapper.selectList(queryWrapper);
        if (attempts.isEmpty()) {
            return Map.of("scope", normalizedScope, "records", List.of());
        }

        Map<Long, com.excel.forum.entity.User> userMap = userService.listByIds(
                attempts.stream().map(PracticeAttempt::getUserId).filter(Objects::nonNull).collect(Collectors.toSet())
        ).stream().collect(Collectors.toMap(com.excel.forum.entity.User::getId, item -> item, (left, right) -> left));

        List<Map<String, Object>> records = attempts.stream()
                .collect(Collectors.groupingBy(PracticeAttempt::getUserId, LinkedHashMap::new, Collectors.toCollection(ArrayList::new)))
                .entrySet().stream()
                .map(entry -> {
                    long cleared = entry.getValue().stream().filter(item -> item.getStars() != null && item.getStars() > 0).count();
                    long perfect = entry.getValue().stream().filter(item -> item.getStars() != null && item.getStars() >= 3).count();
                    int totalStars = entry.getValue().stream().map(PracticeAttempt::getStars).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
                    int totalScore = entry.getValue().stream().map(PracticeAttempt::getScore).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
                    var user = userMap.get(entry.getKey());
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("userId", entry.getKey());
                    row.put("username", user == null ? "匿名用户" : user.getUsername());
                    row.put("avatar", user == null ? null : user.getAvatar());
                    row.put("clearedLevels", cleared);
                    row.put("perfectLevels", perfect);
                    row.put("totalStars", totalStars);
                    row.put("totalScore", totalScore);
                    return row;
                })
                .sorted(
                        Comparator.<Map<String, Object>, Integer>comparing(item -> toInt(item.get("totalStars"))).reversed()
                                .thenComparing(item -> toInt(item.get("perfectLevels")), Comparator.reverseOrder())
                                .thenComparing(item -> toInt(item.get("totalScore")), Comparator.reverseOrder())
                )
                .limit(20)
                .collect(Collectors.toCollection(ArrayList::new));

        for (int index = 0; index < records.size(); index += 1) {
            records.get(index).put("rank", index + 1);
        }
        return Map.of("scope", normalizedScope, "records", records);
    }

    @Override
    public Map<String, Object> startCampaignLevel(Long levelId, Long userId, PracticeCampaignStartRequest request) {
        if (userId == null) {
            throw new IllegalStateException("未登录");
        }
        PracticeLevel level = practiceLevelMapper.selectById(levelId);
        if (level == null || !Boolean.TRUE.equals(level.getEnabled())) {
            throw new IllegalArgumentException("关卡不存在");
        }

        PracticeAttempt attempt = new PracticeAttempt();
        attempt.setUserId(userId);
        attempt.setLevelId(level.getId());
        attempt.setQuestionId(level.getQuestionId());
        attempt.setAttemptType(request == null || request.getAttemptType() == null || request.getAttemptType().isBlank()
                ? "campaign"
                : request.getAttemptType());
        attempt.setResultStatus("started");
        attempt.setScore(0);
        attempt.setStars(0);
        attempt.setErrorCount(0);
        attempt.setGainedExp(0);
        attempt.setGainedPoints(0);
        attempt.setIsFirstPass(false);
        practiceAttemptMapper.insert(attempt);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("attemptId", attempt.getId());
        response.put("levelId", level.getId());
        response.put("targetTimeSeconds", level.getTargetTimeSeconds());
        response.put("startTime", attempt.getSubmitTime());
        return response;
    }

    @Override
    public Map<String, Object> submitCampaignLevel(Long levelId, Long userId, PracticeCampaignSubmitRequest request) {
        if (userId == null) {
            throw new IllegalStateException("未登录");
        }
        if (request == null || request.getAttemptId() == null) {
            throw new IllegalArgumentException("挑战参数不完整");
        }
        PracticeAttempt attempt = practiceAttemptMapper.selectById(request.getAttemptId());
        if (attempt == null || !Objects.equals(attempt.getUserId(), userId) || !Objects.equals(attempt.getLevelId(), levelId)) {
            throw new IllegalArgumentException("挑战记录不存在");
        }
        if (!"started".equals(attempt.getResultStatus())) {
            throw new IllegalStateException("挑战已提交，请返回题目列表刷新进度");
        }
        PracticeLevel level = practiceLevelMapper.selectById(levelId);
        if (level == null || !Boolean.TRUE.equals(level.getEnabled())) {
            throw new IllegalArgumentException("关卡不存在");
        }
        QueryWrapper<UserLevelProgress> existingProgressQuery = new QueryWrapper<>();
        existingProgressQuery.eq("user_id", userId).eq("level_id", levelId).orderByAsc("id");
        UserLevelProgress existingProgress = first(userLevelProgressMapper, existingProgressQuery);
        Question question = questionService.getById(level.getQuestionId());
        if (question == null || question.getDeletedAt() != null || !Boolean.TRUE.equals(question.getEnabled())) {
            throw new IllegalArgumentException("题目不存在");
        }

        PracticeSubmitAnswerRequest answerRequest = new PracticeSubmitAnswerRequest();
        answerRequest.setQuestionId(question.getId());
        answerRequest.setUserAnswer(request.getUserAnswer());

        PracticeSubmitRequest submitRequest = new PracticeSubmitRequest();
        submitRequest.setCategoryId(question.getQuestionCategoryId());
        submitRequest.setQuestionCategoryId(question.getQuestionCategoryId());
        submitRequest.setMode("campaign");
        submitRequest.setDifficulty(question.getDifficulty());
        int usedSeconds = resolveServerUsedSeconds(attempt, request.getUsedSeconds(), LocalDateTime.now());
        submitRequest.setDurationSeconds(usedSeconds);
        submitRequest.setAnswers(List.of(answerRequest));

        Map<String, Object> submitResult = practiceService.submitPractice(userId, submitRequest);
        boolean passed = toInt(submitResult.get("correctCount")) > 0;
        int targetSeconds = level.getTargetTimeSeconds() == null ? 0 : level.getTargetTimeSeconds();
        int stars = 0;
        if (passed) {
            stars = 1;
            if (targetSeconds <= 0 || usedSeconds <= targetSeconds) {
                stars = 2;
            }
            if (targetSeconds > 0 && usedSeconds > 0 && usedSeconds <= Math.max(1, Math.round(targetSeconds * 0.6f))) {
                stars = 3;
            }
        }

        attempt.setUsedSeconds(usedSeconds);
        attempt.setResultStatus(passed ? "passed" : "failed");
        attempt.setScore(toInt(submitResult.get("score")));
        attempt.setStars(stars);
        attempt.setErrorCount(passed ? 0 : 1);
        attempt.setGainedExp(toInt(submitResult.get("expGained")));
        attempt.setGainedPoints(toInt(submitResult.get("rewardPoints")));
        attempt.setIsFirstPass(Boolean.TRUE.equals(submitResult.get("firstPass")));
        practiceAttemptMapper.updateById(attempt);

        syncUserLevelProgress(userId, level, passed, stars, toInt(submitResult.get("score")), usedSeconds, Boolean.TRUE.equals(submitResult.get("firstPass")));
        syncUserChapterProgress(userId);
        syncUserWrongQuestion(userId, level, passed);
        int firstPassBonusAwarded = rewardService.awardLevelFirstPassBonus(userId, level, passed, existingProgress);
        Map<String, Object> dailyChallengeReward = passed
                ? rewardService.awardDailyChallengeIfNeeded(userId, level)
                : Map.of("applied", false, "completed", false, "rewardGranted", false);
        int dailyChallengePoints = toInt(dailyChallengeReward.get("rewardPoints"));
        int dailyChallengeExp = toInt(dailyChallengeReward.get("rewardExp"));
        int totalRewardPoints = toInt(submitResult.get("rewardPoints")) + firstPassBonusAwarded + dailyChallengePoints;
        int totalExpGained = toInt(submitResult.get("expGained")) + dailyChallengeExp;

        Long nextLevelId = findNextLevelId(level, userId);
        Map<String, Object> response = new LinkedHashMap<>(submitResult);
        response.put("passed", passed);
        response.put("stars", stars);
        response.put("attemptId", attempt.getId());
        response.put("levelId", level.getId());
        response.put("nextLevelId", nextLevelId);
        response.put("firstPassBonusAwarded", firstPassBonusAwarded);
        response.put("totalRewardPoints", totalRewardPoints);
        response.put("totalExpGained", totalExpGained);
        response.put("dailyChallenge", dailyChallengeReward);
        return response;
    }

    private Map<String, Object> buildWorldPayload() {
        QueryWrapper<PracticeWorld> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("enabled", true).orderByAsc("sort_order").orderByAsc("id");
        PracticeWorld world = practiceWorldMapper.selectOne(queryWrapper);
        if (world == null) {
            return Map.of("id", 1, "name", "Excel 闯关", "description", "从基础到进阶，逐步攻克 Excel 关卡试炼");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", world.getId());
        payload.put("name", world.getName());
        payload.put("description", world.getDescription());
        return payload;
    }

    private List<PracticeChapter> listEnabledChapters() {
        QueryWrapper<PracticeChapter> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("enabled", true).orderByAsc("sort_order").orderByAsc("id");
        return practiceChapterMapper.selectList(queryWrapper);
    }

    private Map<Long, List<PracticeLevel>> listEnabledLevelsByChapterId() {
        QueryWrapper<PracticeLevel> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("enabled", true).orderByAsc("sort_order").orderByAsc("id");
        return practiceLevelMapper.selectList(queryWrapper).stream()
                .collect(Collectors.groupingBy(PracticeLevel::getChapterId, LinkedHashMap::new, Collectors.toCollection(ArrayList::new)));
    }

    private List<Map<String, Object>> buildChapterSummaries(
            List<PracticeChapter> chapters,
            Map<Long, List<PracticeLevel>> levelsByChapterId,
            Map<Long, UserLevelProgress> progressMap) {
        List<Map<String, Object>> result = new ArrayList<>();

        for (PracticeChapter chapter : chapters) {
            List<PracticeLevel> levels = levelsByChapterId.getOrDefault(chapter.getId(), List.of());
            int totalLevels = levels.size();
            int clearedLevels = (int) levels.stream()
                    .filter(item -> {
                        UserLevelProgress progress = progressMap.get(item.getId());
                        return progress != null && progress.getStars() != null && progress.getStars() > 0;
                    })
                    .count();
            int totalStars = levels.stream()
                    .map(PracticeLevel::getId)
                    .map(progressMap::get)
                    .filter(Objects::nonNull)
                    .map(UserLevelProgress::getStars)
                    .filter(Objects::nonNull)
                    .mapToInt(Integer::intValue)
                    .sum();
            boolean completed = totalLevels > 0 && clearedLevels >= totalLevels;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", chapter.getId());
            item.put("worldId", chapter.getWorldId());
            item.put("name", chapter.getName());
            item.put("description", chapter.getDescription());
            item.put("unlockStar", chapter.getUnlockStar());
            item.put("requiredLevel", chapter.getRequiredLevel());
            item.put("unlocked", true);
            item.put("completed", completed);
            item.put("totalLevels", totalLevels);
            item.put("clearedLevels", clearedLevels);
            item.put("totalStars", totalStars);
            item.put("maxStars", totalLevels * 3);
            item.put("progress", totalLevels == 0 ? 0 : Math.round((clearedLevels * 100f) / totalLevels));
            result.add(item);
        }

        return result;
    }

    private List<Map<String, Object>> buildLevelNodes(List<PracticeLevel> levels, Map<Long, UserLevelProgress> progressMap, boolean chapterUnlocked) {
        return buildLevelNodes(levels, progressMap, chapterUnlocked, Map.of());
    }

    private List<Map<String, Object>> buildLevelNodes(
            List<PracticeLevel> levels,
            Map<Long, UserLevelProgress> progressMap,
            boolean chapterUnlocked,
            Map<Long, LevelAttemptStats> statsMap) {
        List<Map<String, Object>> result = new ArrayList<>();

        for (PracticeLevel level : levels) {
            UserLevelProgress progress = progressMap.get(level.getId());
            LevelAttemptStats attemptStats = statsMap.getOrDefault(level.getId(), LevelAttemptStats.empty());
            boolean cleared = progress != null && progress.getStars() != null && progress.getStars() > 0;
            String status;
            if (progress != null && progress.getStars() != null && progress.getStars() >= 3) {
                status = "perfect";
            } else if (cleared) {
                status = "cleared";
            } else {
                status = "available";
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", level.getId());
            item.put("chapterId", level.getChapterId());
            item.put("questionId", level.getQuestionId());
            item.put("title", level.getTitle());
            item.put("levelType", level.getLevelType());
            item.put("difficulty", level.getDifficulty());
            item.put("status", status);
            item.put("stars", progress == null || progress.getStars() == null ? 0 : progress.getStars());
            item.put("targetTimeSeconds", level.getTargetTimeSeconds());
            item.put("rewardExp", level.getRewardExp());
            item.put("rewardPoints", level.getRewardPoints());
            item.put("firstPassBonus", level.getFirstPassBonus());
            item.put("sortOrder", level.getSortOrder());
            item.put("participantCount", attemptStats.participantCount());
            item.put("passedCount", attemptStats.passedCount());
            item.put("passRate", attemptStats.passRate());
            result.add(item);
        }

        return result;
    }

    private Map<Long, LevelAttemptStats> findAttemptStatsByLevelIds(List<PracticeLevel> levels) {
        List<Long> levelIds = levels.stream()
                .map(PracticeLevel::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (levelIds.isEmpty()) {
            return Map.of();
        }

        QueryWrapper<PracticeAttempt> queryWrapper = new QueryWrapper<>();
        queryWrapper
                .select(
                        "level_id",
                        "COUNT(DISTINCT user_id) AS participant_count",
                        "COUNT(DISTINCT CASE WHEN result_status = 'passed' THEN user_id END) AS passed_count"
                )
                .in("level_id", levelIds)
                .groupBy("level_id");
        List<Map<String, Object>> rows = practiceAttemptMapper.selectMaps(queryWrapper);
        Map<Long, LevelAttemptStats> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Long levelId = readOptionalLong(row, "level_id", "levelId");
            if (levelId == null) {
                continue;
            }
            result.put(levelId, new LevelAttemptStats(
                    readLongOrZero(row, "participant_count", "participantCount"),
                    readLongOrZero(row, "passed_count", "passedCount")
            ));
        }
        return result;
    }

    private Map<String, Object> buildDailyChallengePayload(Long userId) {
        return rewardService.buildDailyChallengePayload(userId);
    }

    private int calculateCurrentStreak(
            List<PracticeChapter> chapters,
            Map<Long, List<PracticeLevel>> levelsByChapterId,
            Map<Long, UserLevelProgress> progressMap) {
        int streak = 0;
        for (PracticeChapter chapter : chapters) {
            for (PracticeLevel level : levelsByChapterId.getOrDefault(chapter.getId(), List.of())) {
                UserLevelProgress progress = progressMap.get(level.getId());
                if (progress != null && progress.getStars() != null && progress.getStars() > 0) {
                    streak += 1;
                } else {
                    return streak;
                }
            }
        }
        return streak;
    }

    private Map<Long, UserLevelProgress> findUserLevelProgressMap(Long userId) {
        if (userId == null) {
            return Map.of();
        }
        QueryWrapper<UserLevelProgress> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId);
        return userLevelProgressMapper.selectList(queryWrapper).stream()
                .filter(item -> item.getLevelId() != null)
                .collect(Collectors.toMap(UserLevelProgress::getLevelId, item -> item, (left, right) -> left, LinkedHashMap::new));
    }

    private String resolveQuestionCategoryName(Long questionCategoryId) {
        if (questionCategoryId == null) {
            return "未分类挑战";
        }
        var category = questionCategoryService.getById(questionCategoryId);
        return category == null ? "未分类挑战" : category.getName();
    }

    private Long findNextLevelId(PracticeLevel currentLevel, Long userId) {
        List<PracticeLevel> levels = listEnabledLevelsByChapterId().getOrDefault(currentLevel.getChapterId(), List.of());
        for (int i = 0; i < levels.size(); i += 1) {
            if (Objects.equals(levels.get(i).getId(), currentLevel.getId())) {
                if (i + 1 < levels.size()) {
                    return levels.get(i + 1).getId();
                }
                break;
            }
        }
        List<PracticeChapter> chapters = listEnabledChapters();
        Map<Long, List<PracticeLevel>> levelsByChapterId = listEnabledLevelsByChapterId();
        Map<Long, UserLevelProgress> progressMap = findUserLevelProgressMap(userId);
        List<Map<String, Object>> chapterSummaries = buildChapterSummaries(chapters, levelsByChapterId, progressMap);
        Long currentChapterId = currentLevel.getChapterId();
        for (int i = 0; i < chapterSummaries.size(); i += 1) {
          if (Objects.equals(toLong(chapterSummaries.get(i).get("id")), currentChapterId) && i + 1 < chapterSummaries.size()) {
              Map<String, Object> nextChapter = chapterSummaries.get(i + 1);
              if (Boolean.TRUE.equals(nextChapter.get("unlocked"))) {
                  List<PracticeLevel> nextLevels = levelsByChapterId.getOrDefault(toLong(nextChapter.get("id")), List.of());
                  return nextLevels.isEmpty() ? null : nextLevels.get(0).getId();
              }
          }
        }
        return null;
    }

    private void syncUserLevelProgress(Long userId, PracticeLevel level, boolean passed, int stars, int score, int usedSeconds, boolean firstPass) {
        QueryWrapper<UserLevelProgress> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).eq("level_id", level.getId()).orderByAsc("id");
        UserLevelProgress progress = first(userLevelProgressMapper, queryWrapper);
        if (progress == null) {
            progress = new UserLevelProgress();
            progress.setUserId(userId);
            progress.setLevelId(level.getId());
            progress.setStatus("locked");
            progress.setStars(0);
            progress.setBestScore(0);
            progress.setPassCount(0);
            progress.setFailCount(0);
        }
        progress.setLastAttemptTime(java.time.LocalDateTime.now());
        progress.setBestScore(Math.max(progress.getBestScore() == null ? 0 : progress.getBestScore(), score));
        if (usedSeconds > 0 && (progress.getBestTimeSeconds() == null || progress.getBestTimeSeconds() <= 0 || usedSeconds < progress.getBestTimeSeconds())) {
            progress.setBestTimeSeconds(usedSeconds);
        }
        if (passed) {
            progress.setStatus(stars >= 3 ? "perfect" : "cleared");
            progress.setStars(Math.max(progress.getStars() == null ? 0 : progress.getStars(), stars));
            progress.setPassCount((progress.getPassCount() == null ? 0 : progress.getPassCount()) + 1);
            if (firstPass && progress.getFirstPassTime() == null) {
                progress.setFirstPassTime(java.time.LocalDateTime.now());
            }
        } else {
            progress.setFailCount((progress.getFailCount() == null ? 0 : progress.getFailCount()) + 1);
            if (!"cleared".equals(progress.getStatus()) && !"perfect".equals(progress.getStatus())) {
                progress.setStatus("available");
            }
        }
        if (progress.getId() == null) {
            userLevelProgressMapper.insert(progress);
        } else {
            userLevelProgressMapper.updateById(progress);
        }
    }

    private void syncUserChapterProgress(Long userId) {
        List<PracticeChapter> chapters = listEnabledChapters();
        Map<Long, List<PracticeLevel>> levelsByChapterId = listEnabledLevelsByChapterId();
        Map<Long, UserLevelProgress> progressMap = findUserLevelProgressMap(userId);
        List<Map<String, Object>> summaries = buildChapterSummaries(chapters, levelsByChapterId, progressMap);

        for (Map<String, Object> summary : summaries) {
            Long chapterId = toLong(summary.get("id"));
            QueryWrapper<UserChapterProgress> queryWrapper = new QueryWrapper<>();
            queryWrapper.eq("user_id", userId).eq("chapter_id", chapterId).orderByAsc("id");
            UserChapterProgress progress = first(userChapterProgressMapper, queryWrapper);
            if (progress == null) {
                progress = new UserChapterProgress();
                progress.setUserId(userId);
                progress.setChapterId(chapterId);
            }
            progress.setUnlocked(Boolean.TRUE.equals(summary.get("unlocked")));
            progress.setCompleted(Boolean.TRUE.equals(summary.get("completed")));
            progress.setTotalStars(toInt(summary.get("totalStars")));
            progress.setClearedLevels(toInt(summary.get("clearedLevels")));
            if (progress.getId() == null) {
                userChapterProgressMapper.insert(progress);
            } else {
                userChapterProgressMapper.updateById(progress);
            }
        }
    }

    private void syncUserWrongQuestion(Long userId, PracticeLevel level, boolean passed) {
        QueryWrapper<UserWrongQuestion> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).eq("question_id", level.getQuestionId()).orderByAsc("id");
        UserWrongQuestion wrong = first(userWrongQuestionMapper, queryWrapper);
        if (passed) {
            if (wrong != null) {
                wrong.setResolved(true);
                userWrongQuestionMapper.updateById(wrong);
            }
            return;
        }

        if (wrong == null) {
            wrong = new UserWrongQuestion();
            wrong.setUserId(userId);
            wrong.setQuestionId(level.getQuestionId());
            wrong.setLevelId(level.getId());
            wrong.setWrongCount(1);
            wrong.setResolved(false);
            wrong.setLastWrongTime(java.time.LocalDateTime.now());
            userWrongQuestionMapper.insert(wrong);
        } else {
            wrong.setResolved(false);
            wrong.setLevelId(level.getId());
            wrong.setWrongCount((wrong.getWrongCount() == null ? 0 : wrong.getWrongCount()) + 1);
            wrong.setLastWrongTime(java.time.LocalDateTime.now());
            userWrongQuestionMapper.updateById(wrong);
        }
    }

    private int toInt(Object value) {
        if (value == null) {
            return 0;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(String.valueOf(value));
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    static int resolveServerUsedSeconds(PracticeAttempt attempt, Integer clientUsedSeconds, LocalDateTime now) {
        if (attempt != null && attempt.getSubmitTime() != null && now != null) {
            long elapsed = ChronoUnit.SECONDS.between(attempt.getSubmitTime(), now);
            if (elapsed > 0) {
                return (int) Math.min(elapsed, 6 * 60 * 60);
            }
        }
        if (clientUsedSeconds == null || clientUsedSeconds <= 0) {
            return 0;
        }
        return Math.min(clientUsedSeconds, 6 * 60 * 60);
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private Long readOptionalLong(Map<String, Object> row, String snakeKey, String camelKey) {
        Object value = row.get(snakeKey);
        if (value == null) {
            value = row.get(camelKey);
        }
        if (value == null) {
            value = row.get(snakeKey.toUpperCase());
        }
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private long readLongOrZero(Map<String, Object> row, String snakeKey, String camelKey) {
        Long value = readOptionalLong(row, snakeKey, camelKey);
        return value == null ? 0L : value;
    }

    private record LevelAttemptStats(long participantCount, long passedCount) {
        static LevelAttemptStats empty() {
            return new LevelAttemptStats(0L, 0L);
        }

        double passRate() {
            if (participantCount <= 0) {
                return 0.0;
            }
            return Math.round((passedCount * 1000.0) / participantCount) / 10.0;
        }
    }
}
