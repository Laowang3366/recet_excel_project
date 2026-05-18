package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.config.ExperienceProperties;
import com.excel.forum.config.PublicCacheHeaders;
import com.excel.forum.config.PublicJsonCache;
import com.excel.forum.entity.ExperienceLevelRule;
import com.excel.forum.entity.PracticeAnswer;
import com.excel.forum.entity.PracticeRecord;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.service.ExperienceLevelRuleService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;

import static com.excel.forum.util.QueryPageUtils.limit;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {

    private final UserService userService;
    private final QuestionService questionService;
    private final PracticeRecordMapper practiceRecordMapper;
    private final PracticeAnswerMapper practiceAnswerMapper;
    private final ExperienceLevelRuleService experienceLevelRuleService;
    private final ExperienceProperties experienceProperties;
    private final PublicJsonCache publicJsonCache;

    @GetMapping
    public ResponseEntity<String> getPublicOverview() {
        return getHomeOverview();
    }

    @GetMapping("/home-overview")
    public ResponseEntity<String> getHomeOverview() {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(PublicCacheHeaders.SHORT_PUBLIC_CACHE)
                .body(publicJsonCache.get("public:home-overview", this::buildHomeOverviewPayload));
    }

    private Map<String, Object> buildHomeOverviewPayload() {
        QueryWrapper<User> userQuery = new QueryWrapper<>();
        userQuery.eq("status", 0);

        QueryWrapper<User> onlineQuery = new QueryWrapper<>();
        onlineQuery.eq("is_online", true);
        onlineQuery.and(wrapper -> wrapper.eq("show_online_status", true).or().isNull("show_online_status"));

        QueryWrapper<User> topUserQuery = new QueryWrapper<>();
        topUserQuery.eq("status", 0)
                .select("id", "username", "avatar", "bio", "level", "points", "role")
                .orderByDesc("points");

        QueryWrapper<Question> enabledQuestionQuery = new QueryWrapper<>();
        enabledQuestionQuery.eq("enabled", true).eq("type", "excel_template");

        QueryWrapper<PracticeAnswer> practiceAnswerCountQuery = new QueryWrapper<>();
        practiceAnswerCountQuery.select("id");

        QueryWrapper<PracticeAnswer> passedAnswerCountQuery = new QueryWrapper<>();
        passedAnswerCountQuery.eq("is_correct", true).select("id");

        QueryWrapper<PracticeRecord> recentPracticeQuery = new QueryWrapper<>();
        recentPracticeQuery.eq("status", "submitted")
                .ge("submit_time", LocalDateTime.now().minusMinutes(30))
                .isNotNull("user_id")
                .select("DISTINCT user_id");

        long questionCount = questionService.count(enabledQuestionQuery);
        long totalPracticeAnswers = practiceAnswerMapper.selectCount(practiceAnswerCountQuery);
        long passedAnswerCount = practiceAnswerMapper.selectCount(passedAnswerCountQuery);
        int passRate = totalPracticeAnswers == 0 ? 0 : Math.round((passedAnswerCount * 100f) / totalPracticeAnswers);
        long activePracticeUserCount = practiceRecordMapper.selectObjs(recentPracticeQuery).size();

        List<User> topUsers = limit(userService, topUserQuery, 5);
        return Map.of(
                "stats", Map.of(
                        "questionCount", questionCount,
                        "userCount", userService.count(userQuery),
                        "onlineCount", userService.count(onlineQuery)
                ),
                "practiceStats", Map.of(
                        "questionCount", questionCount,
                        "passRate", passRate,
                        "activeUserCount", activePracticeUserCount
                ),
                "topUsers", topUsers
        );
    }

    @GetMapping("/level-rules")
    public ResponseEntity<String> getLevelRules() {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(PublicCacheHeaders.SHORT_PUBLIC_CACHE)
                .body(publicJsonCache.get("public:level-rules", this::buildLevelRulesPayload));
    }

    private Map<String, Object> buildLevelRulesPayload() {
        List<Map<String, Object>> rules = new ArrayList<>();
        List<ExperienceLevelRule> configuredRules = experienceLevelRuleService.listEnabledRules();
        if (!configuredRules.isEmpty()) {
            configuredRules.stream()
                    .sorted(Comparator
                            .comparingInt((ExperienceLevelRule rule) -> safeInt(rule.getThreshold()))
                            .thenComparingInt(rule -> safeInt(rule.getLevel())))
                    .forEach(rule -> rules.add(buildLevelRuleItem(rule.getLevel(), rule.getName(), rule.getThreshold())));
        } else {
            experienceProperties.getLevels().stream()
                    .sorted(Comparator
                            .comparingInt((ExperienceProperties.LevelRule rule) -> safeInt(rule.getThreshold()))
                            .thenComparingInt(rule -> safeInt(rule.getLevel())))
                    .forEach(rule -> rules.add(buildLevelRuleItem(rule.getLevel(), rule.getName(), rule.getThreshold())));
        }
        return Map.of("rules", rules);
    }

    private Map<String, Object> buildLevelRuleItem(Integer level, String name, Integer threshold) {
        Map<String, Object> item = new HashMap<>();
        item.put("level", safeInt(level));
        item.put("name", name == null || name.isBlank() ? "未命名等级" : name);
        item.put("threshold", safeInt(threshold));
        return item;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }
}
