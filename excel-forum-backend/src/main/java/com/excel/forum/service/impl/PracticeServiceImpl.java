package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.excel.forum.entity.PracticeAnswer;
import com.excel.forum.entity.PracticeQuestionSubmission;
import com.excel.forum.entity.PracticeRecord;
import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionCategory;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.ExcelTemplateEvaluation;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.entity.dto.PracticeQuestionSubmissionRequest;
import com.excel.forum.entity.dto.PracticeQuestionWorkbookFile;
import com.excel.forum.entity.dto.PracticeSubmitAnswerRequest;
import com.excel.forum.entity.dto.PracticeSubmitRequest;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.ExperienceRuleService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.PointsTaskService;
import com.excel.forum.service.PracticeService;
import com.excel.forum.service.PracticeQuestionSubmissionService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.UserService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PracticeServiceImpl implements PracticeService {
    private static final String TASK_PRACTICE_QUESTION_PASS = "practice_question_pass";
    private static final String UNCATEGORIZED_LABEL = "未分类";
    private static final String UNCATEGORIZED_DESCRIPTION = "未绑定题目分类的练习题";
    private static final String USER_SUBMISSION_CATEGORY_NAME = "用户上传";

    private final QuestionCategoryService questionCategoryService;
    private final QuestionService questionService;
    private final PracticeRecordMapper practiceRecordMapper;
    private final PracticeAnswerMapper practiceAnswerMapper;
    private final ObjectMapper objectMapper;
    private final ExperienceService experienceService;
    private final ExperienceRuleService experienceRuleService;
    private final PointsRecordService pointsRecordService;
    private final PointsTaskService pointsTaskService;
    private final QuestionExcelTemplateService questionExcelTemplateService;
    private final ExcelTemplateGradingService excelTemplateGradingService;
    private final UserService userService;
    private final PracticeQuestionSubmissionService practiceQuestionSubmissionService;

    @Override
    public Map<String, Object> getPracticeCategories() {
        QueryWrapper<Question> questionQuery = new QueryWrapper<>();
        questionQuery.eq("enabled", true).eq("type", "excel_template").isNull("deleted_at");
        List<Question> practiceQuestions = questionService.list(questionQuery);
        if (practiceQuestions.isEmpty()) {
            return Map.of("categories", List.of());
        }

        List<QuestionCategory> categories = questionCategoryService.listWithQuestionCount(true);
        Map<Long, QuestionCategory> categoryMap = categories.stream()
                .filter(category -> category.getId() != null)
                .collect(Collectors.toMap(QuestionCategory::getId, item -> item, (left, right) -> left));
        Map<Long, Long> questionCountMap = practiceQuestions.stream()
                .map(Question::getQuestionCategoryId)
                .filter(Objects::nonNull)
                .filter(categoryMap::containsKey)
                .collect(Collectors.groupingBy(item -> item, Collectors.counting()));
        long uncategorizedCount = practiceQuestions.stream()
                .filter(question -> question.getQuestionCategoryId() == null || !categoryMap.containsKey(question.getQuestionCategoryId()))
                .count();

        List<Map<String, Object>> records = categories.stream()
                .map(category -> {
                    long questionCount = questionCountMap.getOrDefault(category.getId(), 0L);
                    if (questionCount <= 0) {
                        return null;
                    }
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", category.getId());
                    item.put("name", category.getName());
                    item.put("description", category.getDescription());
                    item.put("groupName", category.getGroupName());
                    item.put("questionCount", questionCount);
                    return item;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(ArrayList::new));

        if (uncategorizedCount > 0) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", null);
            item.put("name", UNCATEGORIZED_LABEL);
            item.put("description", UNCATEGORIZED_DESCRIPTION);
            item.put("groupName", "默认分组");
            item.put("questionCount", uncategorizedCount);
            records.add(item);
        }

        return Map.of("categories", records);
    }

    @Override
    public Map<String, Object> getPracticeQuestionList(Long questionCategoryId, Long userId) {
        QueryWrapper<Question> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("enabled", true).eq("type", "excel_template").isNull("deleted_at");
        if (questionCategoryId != null) {
            queryWrapper.eq("question_category_id", questionCategoryId);
        }
        queryWrapper.orderByAsc("difficulty").orderByDesc("id");

        List<Question> questions = questionService.list(queryWrapper);
        QuestionCategory category = questionCategoryId == null ? null : questionCategoryService.getById(questionCategoryId);

        Map<Long, QuestionExcelTemplate> templateMap = questionExcelTemplateService.mapByQuestionIds(
                questions.stream()
                        .filter(item -> "excel_template".equals(item.getType()))
                        .map(Question::getId)
                        .toList()
        );
        Set<Long> completedQuestionIds = findPassedQuestionIds(userId);

        List<Map<String, Object>> records = questions.stream()
                .map(question -> {
                    Map<String, Object> payload = buildPracticeQuestionPayload(question, templateMap.get(question.getId()), false);
                    boolean completed = completedQuestionIds.contains(question.getId());
                    payload.put("completed", completed);
                    payload.put("actionText", completed ? "再试一下" : "开始练习");
                    return payload;
                })
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questionCategoryId", questionCategoryId);
        response.put("questionCategoryName", category == null ? "全部题目" : category.getName());
        response.put("categoryName", category == null ? "全部题目" : category.getName());
        response.put("total", records.size());
        response.put("questions", records);
        return response;
    }

    @Override
    public Map<String, Object> getPracticeQuestions(Long questionCategoryId, Integer count, Integer difficulty) {
        int safeCount = count == null || count < 1 ? 10 : Math.min(count, 30);

        QueryWrapper<Question> questionQuery = new QueryWrapper<>();
        questionQuery.eq("enabled", true).eq("type", "excel_template").isNull("deleted_at");
        if (questionCategoryId != null) {
            questionQuery.eq("question_category_id", questionCategoryId);
        }
        if (difficulty != null && difficulty > 0) {
            questionQuery.eq("difficulty", difficulty);
        }
        List<Question> questions = new ArrayList<>(questionService.list(questionQuery));
        if (questions.isEmpty()) {
            throw new IllegalArgumentException("当前分类下暂无可练习题目");
        }

        Collections.shuffle(questions);
        QuestionCategory category = questionCategoryId == null ? null : questionCategoryService.getById(questionCategoryId);
        Map<Long, QuestionExcelTemplate> templateMap = questionExcelTemplateService.mapByQuestionIds(
                questions.stream()
                        .filter(item -> "excel_template".equals(item.getType()))
                        .map(Question::getId)
                        .toList()
        );

        List<Map<String, Object>> resultQuestions = new ArrayList<>();
        for (Question question : questions) {
            if (resultQuestions.size() >= safeCount) {
                break;
            }
            try {
                    resultQuestions.add(buildPracticeQuestionPayload(question, templateMap.get(question.getId()), true));
            } catch (IllegalArgumentException ex) {
                // 历史模板文件缺失时跳过该题，避免整轮练习直接失败。
            }
        }

        if (resultQuestions.isEmpty()) {
            throw new IllegalArgumentException("当前分类下暂无可练习题目");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questionCategoryId", questionCategoryId);
        response.put("questionCategoryName", category == null ? "全部题目" : category.getName());
        response.put("categoryId", questionCategoryId);
        response.put("categoryName", category == null ? "全部题目" : category.getName());
        response.put("count", resultQuestions.size());
        response.put("questions", resultQuestions);
        return response;
    }

    @Override
    public Map<String, Object> getPracticeQuestionDetail(Long questionId) {
        if (questionId == null) {
            throw new IllegalArgumentException("题目参数无效");
        }
        QueryWrapper<Question> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("id", questionId).eq("enabled", true).eq("type", "excel_template").isNull("deleted_at");
        Question question = questionService.getOne(queryWrapper, false);
        if (question == null) {
            throw new IllegalArgumentException("题目不存在或已停用");
        }
        QuestionExcelTemplate template = questionExcelTemplateService.getByQuestionId(questionId);
        if (template == null) {
            throw new IllegalArgumentException("题目模板不存在");
        }
        Map<String, Object> response = buildPracticeQuestionPayload(question, template, true);
        Long questionCategoryId = question.getQuestionCategoryId();
        QuestionCategory category = questionCategoryId == null ? null : questionCategoryService.getById(questionCategoryId);
        response.put("questionCategoryId", questionCategoryId);
        response.put("questionCategoryName", category == null ? "全部题目" : category.getName());
        response.put("categoryId", questionCategoryId);
        response.put("categoryName", category == null ? "全部题目" : category.getName());
        return response;
    }

    @Override
    public PracticeQuestionWorkbookFile buildPracticeQuestionWorkbookFile(Long questionId) {
        if (questionId == null) {
            throw new IllegalArgumentException("题目参数无效");
        }
        QueryWrapper<Question> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("id", questionId).eq("enabled", true).eq("type", "excel_template").isNull("deleted_at");
        Question question = questionService.getOne(queryWrapper, false);
        if (question == null) {
            throw new IllegalArgumentException("题目不存在或已停用");
        }
        QuestionExcelTemplate template = questionExcelTemplateService.getByQuestionId(questionId);
        if (template == null || !StringUtils.hasText(template.getTemplateFileUrl())) {
            throw new IllegalArgumentException("题目模板不存在");
        }
        byte[] content = excelTemplateGradingService.buildStudentWorkbookFile(
                template.getTemplateFileUrl(),
                template.getAnswerSheet(),
                template.getAnswerRange()
        );
        String extension = resolveWorkbookExtension(template.getTemplateFileUrl());
        String fileName = sanitizeDownloadFileName(question.getTitle()) + extension;
        return new PracticeQuestionWorkbookFile(fileName, resolveWorkbookContentType(extension), content);
    }

    @Override
    public Map<String, Object> getPracticeLeaderboard(Long questionCategoryId, Integer limit) {
        int safeLimit = limit == null || limit < 1 ? 10 : Math.min(limit, 20);

        QueryWrapper<PracticeRecord> recordQuery = new QueryWrapper<>();
        recordQuery.eq("status", "submitted");
        if (questionCategoryId != null) {
            recordQuery.and(wrapper -> wrapper
                    .eq("question_category_id", questionCategoryId)
                    .or()
                    .eq("category_id", questionCategoryId));
        }

        List<PracticeRecord> records = practiceRecordMapper.selectList(recordQuery);
        QuestionCategory category = questionCategoryId == null ? null : questionCategoryService.getById(questionCategoryId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questionCategoryId", questionCategoryId);
        response.put("questionCategoryName", category == null ? "全部题目" : category.getName());
        response.put("records", List.of());

        if (records.isEmpty()) {
            return response;
        }

        Map<Long, Long> recordUserMap = records.stream()
                .filter(record -> record.getId() != null && record.getUserId() != null)
                .collect(Collectors.toMap(PracticeRecord::getId, PracticeRecord::getUserId, (a, b) -> a));
        if (recordUserMap.isEmpty()) {
            return response;
        }

        QueryWrapper<PracticeAnswer> answerQuery = new QueryWrapper<>();
        answerQuery.in("record_id", recordUserMap.keySet());
        answerQuery.eq("is_correct", true);
        List<PracticeAnswer> answers = practiceAnswerMapper.selectList(answerQuery);
        if (answers.isEmpty()) {
            return response;
        }

        Map<Long, LeaderboardStats> leaderboardMap = new HashMap<>();
        Map<Long, Integer> totalQuestionCountMap = new HashMap<>();
        for (PracticeAnswer answer : answers) {
            Long userId = recordUserMap.get(answer.getRecordId());
            if (userId == null || answer.getQuestionId() == null) {
                continue;
            }
            LeaderboardStats stats = leaderboardMap.computeIfAbsent(userId, ignored -> new LeaderboardStats());
            stats.totalScore += safeInt(answer.getScore(), 0);
            stats.correctQuestionIds.add(answer.getQuestionId());
        }
        for (PracticeRecord record : records) {
            if (record.getUserId() == null) {
                continue;
            }
            totalQuestionCountMap.merge(record.getUserId(), safeInt(record.getQuestionCount(), 0), Integer::sum);
        }

        Map<Long, User> userMap = userService.listByIds(leaderboardMap.keySet()).stream()
                .collect(Collectors.toMap(User::getId, item -> item, (a, b) -> a));

        List<Map<String, Object>> rankedRecords = leaderboardMap.entrySet().stream()
                .map(entry -> {
                    User user = userMap.get(entry.getKey());
                    LeaderboardStats stats = entry.getValue();
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("userId", entry.getKey());
                    item.put("username", user == null ? "匿名用户" : user.getUsername());
                    item.put("avatar", user == null ? null : user.getAvatar());
                    item.put("completedQuestionCount", stats.correctQuestionIds.size());
                    item.put("totalQuestionCount", totalQuestionCountMap.getOrDefault(entry.getKey(), 0));
                    item.put("accuracy", totalQuestionCountMap.getOrDefault(entry.getKey(), 0) == 0
                            ? 0
                            : Math.round((stats.correctQuestionIds.size() * 100f) / totalQuestionCountMap.getOrDefault(entry.getKey(), 1)));
                    item.put("totalScore", stats.totalScore);
                    return item;
                })
                .sorted(Comparator
                        .comparingInt((Map<String, Object> item) -> safeInt((Integer) item.get("completedQuestionCount"), 0)).reversed()
                        .thenComparingInt((Map<String, Object> item) -> safeInt((Integer) item.get("accuracy"), 0)).reversed()
                        .thenComparing((Map<String, Object> item) -> safeInt((Integer) item.get("totalScore"), 0), Comparator.reverseOrder())
                        .thenComparing(item -> Long.parseLong(String.valueOf(item.get("userId")))))
                .limit(safeLimit)
                .toList();

        List<Map<String, Object>> finalRecords = new ArrayList<>();
        for (int index = 0; index < rankedRecords.size(); index += 1) {
            Map<String, Object> item = new LinkedHashMap<>(rankedRecords.get(index));
            item.put("rank", index + 1);
            finalRecords.add(item);
        }

        response.put("records", finalRecords);
        return response;
    }

    @Override
    @Transactional
    public Map<String, Object> submitPractice(Long userId, PracticeSubmitRequest request) {
        if (userId == null) {
            throw new IllegalStateException("未登录");
        }
        if (request == null || request.getAnswers() == null || request.getAnswers().isEmpty()) {
            throw new IllegalArgumentException("提交内容不能为空");
        }

        List<Long> questionIds = request.getAnswers().stream()
                .map(PracticeSubmitAnswerRequest::getQuestionId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (questionIds.isEmpty()) {
            throw new IllegalArgumentException("题目参数无效");
        }

        QueryWrapper<Question> questionQuery = new QueryWrapper<>();
        questionQuery.in("id", questionIds).eq("enabled", true).isNull("deleted_at");
        List<Question> questions = questionService.list(questionQuery);
        if (questions.size() != questionIds.size()) {
            throw new IllegalArgumentException("部分题目不存在或已停用");
        }
        Map<Long, Question> questionMap = questions.stream()
                .collect(Collectors.toMap(Question::getId, item -> item));
        LocalDateTime now = LocalDateTime.now();
        PracticeRecord record = new PracticeRecord();
        Long resolvedQuestionCategoryId = request.getQuestionCategoryId() != null ? request.getQuestionCategoryId() : request.getCategoryId();
        record.setUserId(userId);
        record.setCategoryId(request.getCategoryId());
        record.setQuestionCategoryId(resolvedQuestionCategoryId);
        record.setMode(safeMode(request.getMode()));
        record.setDifficulty(request.getDifficulty());
        record.setQuestionCount(request.getAnswers().size());
        record.setCorrectCount(0);
        record.setScore(0);
        record.setStatus("submitted");
        record.setDurationSeconds(safeInt(request.getDurationSeconds(), 0));
        record.setStartTime(now.minusSeconds(Math.max(safeInt(request.getDurationSeconds(), 0), 0)));
        record.setSubmitTime(now);
        practiceRecordMapper.insert(record);

        int correctCount = 0;
        int totalScore = 0;
        int rewardPoints = 0;
        boolean firstPass = false;
        List<Map<String, Object>> answerSummaries = new ArrayList<>();

        for (int index = 0; index < request.getAnswers().size(); index += 1) {
            PracticeSubmitAnswerRequest answerRequest = request.getAnswers().get(index);
            Question question = questionMap.get(answerRequest.getQuestionId());
            if (question == null) {
                continue;
            }

            AnswerEvaluation evaluation = evaluateAnswer(question, answerRequest.getUserAnswer());
            if (evaluation.correct()) {
                correctCount += 1;
                totalScore += evaluation.score();
            }
            RewardEvaluation rewardEvaluation = resolveQuestionReward(userId, question, evaluation.correct());
            rewardPoints += rewardEvaluation.rewardPoints();
            firstPass = firstPass || rewardEvaluation.firstPass();

            PracticeAnswer practiceAnswer = new PracticeAnswer();
            practiceAnswer.setRecordId(record.getId());
            practiceAnswer.setQuestionId(question.getId());
            practiceAnswer.setQuestionType(question.getType());
            practiceAnswer.setQuestionTitle(question.getTitle());
            practiceAnswer.setQuestionOptions(question.getOptions());
            practiceAnswer.setQuestionExplanation(question.getExplanation());
            practiceAnswer.setUserAnswer(evaluation.normalizedUserAnswer());
            practiceAnswer.setCorrectAnswer(evaluation.normalizedCorrectAnswer());
            practiceAnswer.setGradingDetail(evaluation.gradingDetail());
            practiceAnswer.setIsCorrect(evaluation.correct());
            practiceAnswer.setScore(evaluation.score());
            practiceAnswer.setRewardPoints(rewardEvaluation.rewardPoints());
            practiceAnswer.setRewardGranted(rewardEvaluation.rewardGranted());
            practiceAnswer.setSortOrder(index + 1);
            practiceAnswerMapper.insert(practiceAnswer);

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("questionId", question.getId());
            summary.put("questionTitle", question.getTitle());
            summary.put("questionType", question.getType());
            summary.put("isCorrect", evaluation.correct());
            summary.put("rewardPoints", rewardEvaluation.rewardPoints());
            summary.put("rewardGranted", rewardEvaluation.rewardGranted());
            summary.put("firstPass", rewardEvaluation.firstPass());
            summary.put("alreadyPassedBefore", rewardEvaluation.alreadyPassedBefore());
            summary.put("correctAnswer", parseAnswerForOutput(question.getType(), evaluation.normalizedCorrectAnswer()));
            summary.put("analysis", question.getExplanation());
            if (evaluation.gradingDetail() != null && !evaluation.gradingDetail().isBlank()) {
                summary.put("gradingDetail", parseJsonObject(evaluation.gradingDetail()));
            }
            answerSummaries.add(summary);
        }

        record.setCorrectCount(correctCount);
        record.setScore(totalScore);
        practiceRecordMapper.updateById(record);

        int expGained = experienceRuleService.resolveFixedExp(ExperienceService.BIZ_PRACTICE_COMPLETE, 2);
        experienceService.awardPracticeComplete(userId, record.getId());
        List<Map<String, Object>> pointsRewards = new ArrayList<>();
        collectReward(pointsRewards, pointsTaskService.awardTask(userId, PointsTaskService.TASK_DAILY_PRACTICE, record.getId(), "完成今日练习"));
        collectReward(pointsRewards, pointsTaskService.awardTask(userId, PointsTaskService.TASK_FIRST_PRACTICE, null, "完成首次练习"));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("recordId", record.getId());
        response.put("questionCount", record.getQuestionCount());
        response.put("correctCount", correctCount);
        response.put("score", totalScore);
        response.put("submitTime", record.getSubmitTime());
        response.put("expGained", expGained);
        response.put("rewardPoints", rewardPoints);
        response.put("firstPass", firstPass);
        response.put("alreadyPassedBefore", correctCount > 0 && !firstPass);
        if (!pointsRewards.isEmpty()) {
            response.put("pointsRewards", pointsRewards);
        }
        response.put("answers", answerSummaries);
        return response;
    }

    @Override
    @Transactional
    public Map<String, Object> submitPracticeQuestion(Long userId, PracticeQuestionSubmissionRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("未登录");
        }
        if (request == null) {
            throw new IllegalArgumentException("题目参数不能为空");
        }
        if (!StringUtils.hasText(request.getTitle())) {
            throw new IllegalArgumentException("题目标题不能为空");
        }
        if (!StringUtils.hasText(request.getTemplateFileUrl())) {
            throw new IllegalArgumentException("请先上传试题模板文件");
        }
        if (request.getQuestionCategoryId() != null && questionCategoryService.getById(request.getQuestionCategoryId()) == null) {
            throw new IllegalArgumentException("题目分类不存在");
        }
        if (!StringUtils.hasText(request.getAnswerSheet())) {
            throw new IllegalArgumentException("答题工作表不能为空");
        }
        if (!StringUtils.hasText(request.getAnswerRange())) {
            throw new IllegalArgumentException("答题区域不能为空");
        }
        if (!StringUtils.hasText(request.getAnswerSnapshotJson())) {
            throw new IllegalArgumentException("标准答案不能为空");
        }
        validatePracticeSubmissionTemplate(request);

        PracticeQuestionSubmission submission = new PracticeQuestionSubmission();
        submission.setUserId(userId);
        submission.setQuestionCategoryId(request.getQuestionCategoryId());
        submission.setTitle(request.getTitle().trim());
        submission.setDescription(request.getDescription() == null ? null : request.getDescription().trim());
        submission.setDifficulty(request.getDifficulty() == null ? 1 : Math.max(1, Math.min(request.getDifficulty(), 5)));
        submission.setPoints(request.getPoints() == null ? 0 : Math.max(0, request.getPoints()));
        submission.setTemplateFileUrl(request.getTemplateFileUrl().trim());
        submission.setAnswerSheet(request.getAnswerSheet().trim());
        submission.setAnswerRange(request.getAnswerRange().trim().toUpperCase(Locale.ROOT));
        submission.setAnswerSnapshotJson(request.getAnswerSnapshotJson());
        submission.setCheckFormula(Boolean.TRUE.equals(request.getCheckFormula()));
        submission.setGradingRuleJson(request.getGradingRuleJson());
        submission.setExpectedSnapshotJson(request.getExpectedSnapshotJson());
        submission.setSheetCountLimit(request.getSheetCountLimit() == null || request.getSheetCountLimit() < 1 ? 5 : request.getSheetCountLimit());
        submission.setVersion(request.getVersion() == null || request.getVersion() < 1 ? 1 : request.getVersion());
        submission.setStatus("pending");
        practiceQuestionSubmissionService.save(submission);

        return Map.of(
                "message", "试题投稿已提交，等待管理员审核",
                "id", submission.getId(),
                "status", submission.getStatus()
        );
    }

    private void validatePracticeSubmissionTemplate(PracticeQuestionSubmissionRequest request) {
        try {
            excelTemplateGradingService.validateAnswerArea(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange()
            );
            String normalizedAnswerSnapshot = excelTemplateGradingService.normalizeAnswerSnapshotJson(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange(),
                    request.getCheckFormula(),
                    request.getAnswerSnapshotJson()
            );
            request.setAnswerSnapshotJson(normalizedAnswerSnapshot);
            request.setGradingRuleJson(excelTemplateGradingService.buildRuleJson(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange(),
                    request.getCheckFormula(),
                    request.getGradingRuleJson()
            ));
            request.setExpectedSnapshotJson(excelTemplateGradingService.buildExpectedSnapshotJson(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange(),
                    request.getCheckFormula(),
                    normalizedAnswerSnapshot,
                    request.getGradingRuleJson(),
                    request.getExpectedSnapshotJson()
            ));
            request.setSheetCountLimit(request.getSheetCountLimit() == null || request.getSheetCountLimit() < 1 ? 5 : request.getSheetCountLimit());
            request.setVersion(request.getVersion() == null || request.getVersion() < 1 ? 1 : request.getVersion());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(e.getMessage());
        }
    }

    @Override
    public Map<String, Object> getPracticeSubmissionProgress(Long userId, Integer page, Integer size) {
        int safePage = page == null || page < 1 ? 1 : page;
        int safeSize = size == null || size < 1 ? 10 : Math.min(size, 20);
        Page<PracticeQuestionSubmission> pageRequest = new Page<>(safePage, safeSize);
        QueryWrapper<PracticeQuestionSubmission> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).orderByDesc("create_time");
        Page<PracticeQuestionSubmission> result = practiceQuestionSubmissionService.page(pageRequest, queryWrapper);

        Set<Long> categoryIds = result.getRecords().stream()
                .map(PracticeQuestionSubmission::getQuestionCategoryId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, QuestionCategory> categoryMap = categoryIds.isEmpty()
                ? Map.of()
                : questionCategoryService.listByIds(categoryIds).stream()
                .collect(Collectors.toMap(QuestionCategory::getId, item -> item, (left, right) -> left));

        List<Map<String, Object>> records = result.getRecords().stream().map(item -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId());
            row.put("title", item.getTitle());
            row.put("description", item.getDescription());
            row.put("difficulty", item.getDifficulty());
            row.put("points", item.getPoints());
            row.put("status", item.getStatus());
            row.put("reviewNote", item.getReviewNote());
            row.put("createTime", item.getCreateTime());
            row.put("reviewedTime", item.getReviewedTime());
            row.put("templateFileUrl", item.getTemplateFileUrl());
            row.put("answerSheet", item.getAnswerSheet());
            row.put("answerRange", item.getAnswerRange());
            QuestionCategory category = item.getQuestionCategoryId() == null ? null : categoryMap.get(item.getQuestionCategoryId());
            row.put("questionCategoryId", item.getQuestionCategoryId());
            row.put("questionCategoryName", "approved".equalsIgnoreCase(String.valueOf(item.getStatus()))
                    ? USER_SUBMISSION_CATEGORY_NAME
                    : category == null ? "未分类" : category.getName());
            return row;
        }).toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("records", records);
        response.put("total", result.getTotal());
        response.put("current", result.getCurrent());
        response.put("size", result.getSize());
        response.put("pages", result.getPages());
        return response;
    }

    @Override
    public Map<String, Object> getPracticeHistory(Long userId, Integer page, Integer size) {
        int safePage = page == null || page < 1 ? 1 : page;
        int safeSize = size == null || size < 1 ? 10 : Math.min(size, 20);
        Page<PracticeRecord> pageRequest = new Page<>(safePage, safeSize);
        QueryWrapper<PracticeRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).orderByDesc("submit_time");
        Page<PracticeRecord> result = practiceRecordMapper.selectPage(pageRequest, queryWrapper);
        Map<Long, PracticeAnswer> firstAnswerMap = findFirstAnswerMap(result.getRecords());

        List<Map<String, Object>> records = result.getRecords().stream()
                .map(record -> toHistoryItem(record, firstAnswerMap.get(record.getId())))
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("records", records);
        response.put("total", result.getTotal());
        response.put("current", result.getCurrent());
        response.put("size", result.getSize());
        response.put("pages", result.getPages());
        return response;
    }

    @Override
    public Map<String, Object> getPracticeHistoryDetail(Long userId, Long recordId) {
        PracticeRecord record = practiceRecordMapper.selectById(recordId);
        if (record == null || !Objects.equals(record.getUserId(), userId)) {
            return null;
        }

        QueryWrapper<PracticeAnswer> answerQuery = new QueryWrapper<>();
        answerQuery.eq("record_id", recordId).orderByAsc("sort_order");
        List<PracticeAnswer> answers = practiceAnswerMapper.selectList(answerQuery);

        QuestionCategory category = resolveQuestionCategory(record);
        PracticeAnswer firstAnswer = answers.isEmpty() ? null : answers.get(0);
        Map<String, Object> response = new LinkedHashMap<>(toHistoryItem(record, firstAnswer));
        response.put("mode", record.getMode());
        response.put("difficulty", record.getDifficulty());
        response.put("durationSeconds", safeInt(record.getDurationSeconds(), 0));
        response.put("questionCategoryId", resolveQuestionCategoryId(record));
        response.put("questionCategoryName", category == null ? "全部题目" : category.getName());
        response.put("categoryId", resolveQuestionCategoryId(record));
        response.put("categoryName", category == null ? "全部题目" : category.getName());
        response.put("rewardPoints", answers.stream().map(PracticeAnswer::getRewardPoints).filter(Objects::nonNull).mapToInt(Integer::intValue).sum());
        response.put("firstPass", answers.stream().anyMatch(item -> Boolean.TRUE.equals(item.getRewardGranted())));
        response.put("answers", answers.stream().map(this::toAnswerDetail).toList());
        return response;
    }

    private Map<Long, PracticeAnswer> findFirstAnswerMap(List<PracticeRecord> records) {
        List<Long> recordIds = records.stream().map(PracticeRecord::getId).filter(Objects::nonNull).toList();
        if (recordIds.isEmpty()) {
            return Map.of();
        }
        QueryWrapper<PracticeAnswer> queryWrapper = new QueryWrapper<>();
        queryWrapper.in("record_id", recordIds).orderByAsc("sort_order").orderByAsc("id");
        return practiceAnswerMapper.selectList(queryWrapper).stream()
                .filter(item -> item.getRecordId() != null)
                .collect(Collectors.toMap(PracticeAnswer::getRecordId, item -> item, (left, right) -> left));
    }

    private Map<String, Object> toHistoryItem(PracticeRecord record, PracticeAnswer firstAnswer) {
        QuestionCategory category = resolveQuestionCategory(record);
        int questionCount = safeInt(record.getQuestionCount(), 0);
        int correctCount = safeInt(record.getCorrectCount(), 0);
        int accuracy = questionCount <= 0 ? 0 : Math.round((correctCount * 100f) / questionCount);

        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", record.getId());
        item.put("questionCategoryId", resolveQuestionCategoryId(record));
        item.put("questionCategoryName", category == null ? "全部题目" : category.getName());
        item.put("categoryId", resolveQuestionCategoryId(record));
        item.put("categoryName", category == null ? "全部题目" : category.getName());
        item.put("questionCount", questionCount);
        item.put("correctCount", correctCount);
        item.put("score", safeInt(record.getScore(), 0));
        item.put("accuracy", accuracy);
        item.put("questionId", firstAnswer == null ? null : firstAnswer.getQuestionId());
        item.put("questionTitle", firstAnswer == null ? null : firstAnswer.getQuestionTitle());
        item.put("rewardPoints", firstAnswer == null ? 0 : safeInt(firstAnswer.getRewardPoints(), 0));
        item.put("rewardGranted", firstAnswer != null && Boolean.TRUE.equals(firstAnswer.getRewardGranted()));
        item.put("submitTime", record.getSubmitTime());
        item.put("durationSeconds", safeInt(record.getDurationSeconds(), 0));
        return item;
    }

    private Long resolveQuestionCategoryId(PracticeRecord record) {
        if (record == null) {
            return null;
        }
        return record.getQuestionCategoryId() != null ? record.getQuestionCategoryId() : record.getCategoryId();
    }

    private QuestionCategory resolveQuestionCategory(PracticeRecord record) {
        Long questionCategoryId = resolveQuestionCategoryId(record);
        return questionCategoryId == null ? null : questionCategoryService.getById(questionCategoryId);
    }

    private Map<String, Object> toAnswerDetail(PracticeAnswer answer) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", answer.getId());
        item.put("questionId", answer.getQuestionId());
        item.put("questionType", answer.getQuestionType());
        item.put("questionTitle", answer.getQuestionTitle());
        item.put("options", parseOptions(answer.getQuestionOptions()));
        item.put("questionExplanation", answer.getQuestionExplanation());
        item.put("userAnswer", parseAnswerForOutput(answer.getQuestionType(), answer.getUserAnswer()));
        item.put("correctAnswer", parseAnswerForOutput(answer.getQuestionType(), answer.getCorrectAnswer()));
        item.put("gradingDetail", parseJsonObject(answer.getGradingDetail()));
        item.put("isCorrect", Boolean.TRUE.equals(answer.getIsCorrect()));
        item.put("score", safeInt(answer.getScore(), 0));
        item.put("rewardPoints", safeInt(answer.getRewardPoints(), 0));
        item.put("rewardGranted", Boolean.TRUE.equals(answer.getRewardGranted()));
        item.put("sortOrder", safeInt(answer.getSortOrder(), 0));
        return item;
    }

    private AnswerEvaluation evaluateAnswer(Question question, Object userAnswer) {
        String type = question.getType() == null ? "single" : question.getType();
        int questionScore = safeInt(question.getPoints(), 10);
        return switch (type) {
            case "excel_template" -> evaluateExcelTemplate(question.getId(), userAnswer, questionScore);
            case "multiple", "multiple_choice" -> evaluateMultipleChoice(question.getAnswer(), userAnswer, questionScore);
            case "fill" -> evaluateFill(question.getAnswer(), userAnswer, questionScore);
            case "true_false", "judge" -> evaluateSimple(question.getAnswer(), userAnswer, questionScore);
            case "single", "single_choice" -> evaluateSimple(question.getAnswer(), userAnswer, questionScore);
            default -> evaluateSimple(question.getAnswer(), userAnswer, questionScore);
        };
    }

    private AnswerEvaluation evaluateSimple(String correctAnswer, Object userAnswer, int questionScore) {
        String normalizedCorrect = normalizeSimpleText(correctAnswer);
        String normalizedUser = normalizeSimpleText(userAnswer);
        boolean correct = normalizedCorrect.equalsIgnoreCase(normalizedUser);
        return new AnswerEvaluation(normalizedUser, normalizedCorrect, correct, correct ? questionScore : 0);
    }

    private AnswerEvaluation evaluateMultipleChoice(String correctAnswer, Object userAnswer, int questionScore) {
        List<String> normalizedCorrect = normalizeAnswerList(correctAnswer);
        List<String> normalizedUser = normalizeAnswerList(userAnswer);
        boolean correct = normalizedCorrect.equals(normalizedUser);
        return new AnswerEvaluation(toJson(normalizedUser), toJson(normalizedCorrect), correct, correct ? questionScore : 0);
    }

    private AnswerEvaluation evaluateFill(String correctAnswer, Object userAnswer, int questionScore) {
        String normalizedUser = normalizeSimpleText(userAnswer);
        List<String> acceptedAnswers = normalizeFillAnswers(correctAnswer);
        boolean correct = acceptedAnswers.stream().anyMatch(answer -> answer.equalsIgnoreCase(normalizedUser));
        return new AnswerEvaluation(normalizedUser, String.join("|", acceptedAnswers), correct, correct ? questionScore : 0);
    }

    private AnswerEvaluation evaluateExcelTemplate(Long questionId, Object userAnswer, int questionScore) {
        QuestionExcelTemplate template = questionExcelTemplateService.getByQuestionId(questionId);
        if (template == null) {
            return new AnswerEvaluation("", "", false, 0, null);
        }

        ExcelWorkbookSnapshot submission = objectMapper.convertValue(userAnswer, ExcelWorkbookSnapshot.class);
        boolean dynamicArrayGrading = hasDynamicArrayGradingRules(template.getGradingRuleJson());
        ExcelWorkbookSnapshot materializedSubmission = dynamicArrayGrading
                ? null
                : excelTemplateGradingService.materializeSubmission(template.getTemplateFileUrl(), submission);
        String expectedSnapshotJson = excelTemplateGradingService.buildExpectedSnapshotJson(
                template.getTemplateFileUrl(),
                template.getAnswerSheet(),
                template.getAnswerRange(),
                template.getCheckFormula(),
                template.getAnswerSnapshotJson(),
                template.getGradingRuleJson(),
                template.getExpectedSnapshotJson()
        );
        ExcelWorkbookSnapshot gradingSubmission = materializedSubmission == null ? submission : materializedSubmission;
        ExcelTemplateEvaluation evaluation = excelTemplateGradingService.grade(
                gradingSubmission,
                template.getGradingRuleJson(),
                expectedSnapshotJson
        );
        int finalScore = questionScore > 0 && evaluation.getTotalScore() > 0
                ? Math.min(questionScore, Math.round((evaluation.getScore() * questionScore) / (float) evaluation.getTotalScore()))
                : evaluation.getScore();
        return new AnswerEvaluation(
                evaluation.getNormalizedUserAnswer(),
                evaluation.getNormalizedCorrectAnswer(),
                evaluation.isPassed(),
                finalScore,
                toJsonObject(Map.of(
                        "feedback", evaluation.getFeedback(),
                        "score", finalScore,
                        "rawScore", evaluation.getScore(),
                        "totalScore", evaluation.getTotalScore(),
                        "ruleResults", evaluation.getRuleResults()
                ))
        );
    }

    private boolean hasDynamicArrayGradingRules(String gradingRuleJson) {
        if (!StringUtils.hasText(gradingRuleJson)) {
            return false;
        }
        try {
            JsonNode dynamicArrayRules = objectMapper.readTree(gradingRuleJson).path("dynamicArrayRules");
            return dynamicArrayRules.isArray() && dynamicArrayRules.size() > 0;
        } catch (JsonProcessingException exception) {
            log.debug("Invalid grading rule JSON while detecting dynamic array rules", exception);
            return false;
        }
    }

    private RewardEvaluation resolveQuestionReward(Long userId, Question question, boolean correct) {
        if (!correct || userId == null || question == null || question.getId() == null) {
            return RewardEvaluation.NONE;
        }
        int rewardPoints = Math.max(safeInt(question.getPoints(), 0), 0);
        if (rewardPoints <= 0) {
            return RewardEvaluation.NONE;
        }
        boolean alreadyPassedBefore = hasUserPassedQuestion(userId, question.getId());
        if (alreadyPassedBefore || hasQuestionRewardRecord(userId, question.getId())) {
            return new RewardEvaluation(0, false, false, true);
        }
        pointsRecordService.addTaskPointsRecord(
                userId,
                null,
                "题目首通奖励",
                TASK_PRACTICE_QUESTION_PASS,
                question.getId(),
                null,
                rewardPoints,
                "首次完成题目《" + question.getTitle() + "》"
        );
        return new RewardEvaluation(rewardPoints, true, true, false);
    }

    private List<String> parseOptions(String options) {
        if (options == null || options.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(options, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException exception) {
            log.debug("Invalid question options JSON, using empty options", exception);
            return List.of();
        }
    }

    private Object parseAnswerForOutput(String type, String answer) {
        if (answer == null || answer.isBlank()) {
            if ("multiple".equals(type) || "multiple_choice".equals(type)) {
                return List.of();
            }
            if ("excel_template".equals(type)) {
                return Map.of();
            }
            return "";
        }
        if ("excel_template".equals(type)) {
            return parseJsonObject(answer);
        }
        if ("multiple".equals(type) || "multiple_choice".equals(type)) {
            return normalizeAnswerList(answer);
        }
        return answer;
    }

    private Map<String, Object> buildPracticeQuestionPayload(Question question, QuestionExcelTemplate template, boolean includeWorkbook) {
        Map<String, Object> item = new LinkedHashMap<>();
        QuestionCategory category = question.getQuestionCategoryId() == null ? null : questionCategoryService.getById(question.getQuestionCategoryId());
        String categoryName = category == null ? UNCATEGORIZED_LABEL : category.getName();
        item.put("id", question.getId());
        item.put("type", question.getType());
        item.put("title", question.getTitle());
        item.put("score", safeInt(question.getPoints(), 10));
        item.put("difficulty", safeInt(question.getDifficulty(), 1));
        item.put("options", parseOptions(question.getOptions()));
        item.put("questionCategoryId", question.getQuestionCategoryId());
        item.put("questionCategoryName", categoryName);
        item.put("categoryId", question.getQuestionCategoryId());
        item.put("categoryName", categoryName);
        if (template != null) {
            item.put("templateFileUrl", template.getTemplateFileUrl());
            item.put("answerSheet", template.getAnswerSheet());
            item.put("answerRange", template.getAnswerRange());
            item.put("checkFormula", Boolean.TRUE.equals(template.getCheckFormula()));
            item.put("sheetCountLimit", safeInt(template.getSheetCountLimit(), 5));
            item.put("version", safeInt(template.getVersion(), 1));
            item.put("gradingRuleSummary", excelTemplateGradingService.buildRuleSummary(template.getGradingRuleJson()));
            if (includeWorkbook) {
                item.put("templateWorkbook", loadStudentWorkbookSnapshot(template));
            }
        }
        return item;
    }

    private ExcelWorkbookSnapshot loadStudentWorkbookSnapshot(QuestionExcelTemplate template) {
        ExcelWorkbookSnapshot workbook = excelTemplateGradingService.loadWorkbookSnapshot(template.getTemplateFileUrl());
        return clearWorkbookRange(workbook, template.getAnswerSheet(), template.getAnswerRange());
    }

    private ExcelWorkbookSnapshot clearWorkbookRange(ExcelWorkbookSnapshot workbook, String sheetName, String rangeRef) {
        ExcelWorkbookSnapshot next = cloneWorkbookSnapshot(workbook);
        RangeRef range = parseRangeRef(rangeRef);
        if (range == null || !StringUtils.hasText(sheetName)) {
            return next;
        }
        ExcelWorkbookSnapshot.SheetSnapshot sheet = next.getSheets().stream()
                .filter(item -> sheetName.equals(item.getName()))
                .findFirst()
                .orElse(null);
        if (sheet == null || sheet.getCells() == null) {
            return next;
        }
        for (int row = range.startRow(); row <= range.endRow(); row += 1) {
            for (int col = range.startCol(); col <= range.endCol(); col += 1) {
                sheet.getCells().remove(toCellRef(row, col));
            }
        }
        return next;
    }

    private ExcelWorkbookSnapshot cloneWorkbookSnapshot(ExcelWorkbookSnapshot workbook) {
        ExcelWorkbookSnapshot next = new ExcelWorkbookSnapshot();
        if (workbook == null || workbook.getSheets() == null) {
            return next;
        }
        for (ExcelWorkbookSnapshot.SheetSnapshot sourceSheet : workbook.getSheets()) {
            ExcelWorkbookSnapshot.SheetSnapshot targetSheet = new ExcelWorkbookSnapshot.SheetSnapshot();
            targetSheet.setName(sourceSheet.getName());
            targetSheet.setRowCount(sourceSheet.getRowCount());
            targetSheet.setColumnCount(sourceSheet.getColumnCount());
            Map<String, ExcelWorkbookSnapshot.CellSnapshot> sourceCells = sourceSheet.getCells();
            if (sourceCells != null) {
                sourceCells.forEach((cellRef, sourceCell) -> {
                    ExcelWorkbookSnapshot.CellSnapshot targetCell = new ExcelWorkbookSnapshot.CellSnapshot();
                    targetCell.setValue(sourceCell.getValue());
                    targetCell.setFormula(sourceCell.getFormula());
                    targetCell.setDisplay(sourceCell.getDisplay());
                    targetSheet.getCells().put(cellRef, targetCell);
                });
            }
            next.getSheets().add(targetSheet);
        }
        return next;
    }

    private RangeRef parseRangeRef(String rangeRef) {
        if (!StringUtils.hasText(rangeRef)) {
            return null;
        }
        String normalized = rangeRef.trim();
        int sheetSeparator = normalized.lastIndexOf('!');
        if (sheetSeparator >= 0 && sheetSeparator + 1 < normalized.length()) {
            normalized = normalized.substring(sheetSeparator + 1);
        }
        normalized = normalized.replace("$", "").toUpperCase(Locale.ROOT);
        String[] parts = normalized.split(":");
        CellRef start = parseCellRef(parts[0]);
        CellRef end = parseCellRef(parts.length > 1 ? parts[1] : parts[0]);
        if (start == null || end == null) {
            return null;
        }
        return new RangeRef(
                Math.min(start.row(), end.row()),
                Math.min(start.col(), end.col()),
                Math.max(start.row(), end.row()),
                Math.max(start.col(), end.col())
        );
    }

    private CellRef parseCellRef(String cellRef) {
        if (!StringUtils.hasText(cellRef)) {
            return null;
        }
        String normalized = cellRef.trim().toUpperCase(Locale.ROOT);
        int index = 0;
        int col = 0;
        while (index < normalized.length() && Character.isLetter(normalized.charAt(index))) {
            col = col * 26 + (normalized.charAt(index) - 'A' + 1);
            index += 1;
        }
        if (index == 0 || index >= normalized.length()) {
            return null;
        }
        int row;
        try {
            row = Integer.parseInt(normalized.substring(index));
        } catch (NumberFormatException exception) {
            return null;
        }
        if (row < 1 || col < 1) {
            return null;
        }
        return new CellRef(row, col);
    }

    private String toCellRef(int row, int col) {
        StringBuilder column = new StringBuilder();
        int current = col;
        while (current > 0) {
            int remainder = (current - 1) % 26;
            column.insert(0, (char) ('A' + remainder));
            current = (current - 1) / 26;
        }
        return column + String.valueOf(row);
    }

    private String resolveWorkbookExtension(String fileUrl) {
        String value = fileUrl == null ? "" : fileUrl.trim().toLowerCase(Locale.ROOT);
        int queryIndex = value.indexOf('?');
        if (queryIndex >= 0) {
            value = value.substring(0, queryIndex);
        }
        return value.endsWith(".xls") && !value.endsWith(".xlsx") ? ".xls" : ".xlsx";
    }

    private String resolveWorkbookContentType(String extension) {
        return ".xls".equals(extension)
                ? "application/vnd.ms-excel"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    private String sanitizeDownloadFileName(String title) {
        String normalized = title == null ? "" : title.trim();
        if (normalized.isBlank()) {
            return "excelcc-practice-question";
        }
        normalized = normalized.replaceAll("[\\\\/:*?\"<>|]+", "-")
                .replaceAll("\\s+", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");
        return normalized.isBlank() ? "excelcc-practice-question" : normalized;
    }

    private record RangeRef(int startRow, int startCol, int endRow, int endCol) {
    }

    private record CellRef(int row, int col) {
    }

    private boolean hasUserPassedQuestion(Long userId, Long questionId) {
        QueryWrapper<PracticeRecord> recordQuery = new QueryWrapper<>();
        recordQuery.eq("user_id", userId).eq("status", "submitted").select("id");
        List<Long> recordIds = practiceRecordMapper.selectList(recordQuery).stream()
                .map(PracticeRecord::getId)
                .filter(Objects::nonNull)
                .toList();
        if (recordIds.isEmpty()) {
            return false;
        }
        QueryWrapper<PracticeAnswer> answerQuery = new QueryWrapper<>();
        answerQuery.in("record_id", recordIds).eq("question_id", questionId).eq("is_correct", true);
        return practiceAnswerMapper.selectCount(answerQuery) > 0;
    }

    private Set<Long> findPassedQuestionIds(Long userId) {
        if (userId == null) {
            return Set.of();
        }
        QueryWrapper<PracticeRecord> recordQuery = new QueryWrapper<>();
        recordQuery.eq("user_id", userId).eq("status", "submitted").select("id");
        List<Long> recordIds = practiceRecordMapper.selectList(recordQuery).stream()
                .map(PracticeRecord::getId)
                .filter(Objects::nonNull)
                .toList();
        if (recordIds.isEmpty()) {
            return Set.of();
        }
        QueryWrapper<PracticeAnswer> answerQuery = new QueryWrapper<>();
        answerQuery.in("record_id", recordIds)
                .eq("is_correct", true)
                .select("question_id");
        return practiceAnswerMapper.selectList(answerQuery).stream()
                .map(PracticeAnswer::getQuestionId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private boolean hasQuestionRewardRecord(Long userId, Long questionId) {
        QueryWrapper<PointsRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).eq("task_key", TASK_PRACTICE_QUESTION_PASS).eq("biz_id", questionId);
        return pointsRecordService.count(queryWrapper) > 0;
    }

    private List<String> normalizeAnswerList(Object value) {
        LinkedHashSet<String> items = new LinkedHashSet<>();
        if (value instanceof Collection<?> collection) {
            for (Object item : collection) {
                String normalized = normalizeChoiceToken(item);
                if (!normalized.isBlank()) {
                    items.add(normalized);
                }
            }
        } else if (value instanceof String text) {
            String trimmed = text.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                try {
                    List<String> parsed = objectMapper.readValue(trimmed, new TypeReference<List<String>>() {});
                    for (String item : parsed) {
                        String normalized = normalizeChoiceToken(item);
                        if (!normalized.isBlank()) {
                            items.add(normalized);
                        }
                    }
                } catch (JsonProcessingException exception) {
                    log.debug("Multiple-choice answer is not JSON array, falling back to split text: {}", trimmed, exception);
                    splitChoiceText(trimmed).forEach(item -> {
                        String normalized = normalizeChoiceToken(item);
                        if (!normalized.isBlank()) {
                            items.add(normalized);
                        }
                    });
                }
            } else {
                splitChoiceText(trimmed).forEach(item -> {
                    String normalized = normalizeChoiceToken(item);
                    if (!normalized.isBlank()) {
                        items.add(normalized);
                    }
                });
            }
        }
        return items.stream().sorted(Comparator.naturalOrder()).toList();
    }

    private List<String> splitChoiceText(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        if (text.contains(",")) {
            return List.of(text.split(","));
        }
        if (text.contains("|")) {
            return List.of(text.split("\\|"));
        }
        return text.chars()
                .mapToObj(value -> String.valueOf((char) value))
                .filter(item -> !item.isBlank())
                .toList();
    }

    private List<String> normalizeFillAnswers(String correctAnswer) {
        if (correctAnswer == null || correctAnswer.isBlank()) {
            return List.of();
        }
        return List.of(correctAnswer.split("\\|")).stream()
                .map(this::normalizeSimpleText)
                .filter(item -> !item.isBlank())
                .distinct()
                .toList();
    }

    private String normalizeSimpleText(Object value) {
        if (value == null) {
            return "";
        }
        return value.toString().trim();
    }

    private String normalizeChoiceToken(Object value) {
        return normalizeSimpleText(value).toUpperCase(Locale.ROOT);
    }

    private String toJson(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            log.warn("Failed to serialize practice answer list", exception);
            return "[]";
        }
    }

    private Object parseJsonObject(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException exception) {
            log.debug("Practice answer is not a JSON object, returning raw value", exception);
            return json;
        }
    }

    private String toJsonObject(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            log.warn("Failed to serialize practice answer object", exception);
            return null;
        }
    }

    private int safeInt(Integer value, int defaultValue) {
        return value == null ? defaultValue : value;
    }

    private String safeMode(String mode) {
        return (mode == null || mode.isBlank()) ? "practice" : mode;
    }

    private void collectReward(List<Map<String, Object>> rewards, Map<String, Object> reward) {
        if (reward != null) {
            rewards.add(reward);
        }
    }

    private static class LeaderboardStats {
        private final LinkedHashSet<Long> correctQuestionIds = new LinkedHashSet<>();
        private int totalScore;
    }

    private record RewardEvaluation(int rewardPoints, boolean rewardGranted, boolean firstPass, boolean alreadyPassedBefore) {
        private static final RewardEvaluation NONE = new RewardEvaluation(0, false, false, false);
    }

    private record AnswerEvaluation(String normalizedUserAnswer, String normalizedCorrectAnswer, boolean correct, int score, String gradingDetail) {
        private AnswerEvaluation(String normalizedUserAnswer, String normalizedCorrectAnswer, boolean correct, int score) {
            this(normalizedUserAnswer, normalizedCorrectAnswer, correct, score, null);
        }
    }
}
