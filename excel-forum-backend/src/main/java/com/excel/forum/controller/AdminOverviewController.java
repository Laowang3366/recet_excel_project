package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.CheckinRecord;
import com.excel.forum.entity.ExperienceLevelRule;
import com.excel.forum.entity.ExperienceRule;
import com.excel.forum.entity.Feedback;
import com.excel.forum.entity.Notification;
import com.excel.forum.entity.PointsRule;
import com.excel.forum.entity.PracticeQuestionSubmission;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.CheckinRecordMapper;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.service.ExperienceLevelRuleService;
import com.excel.forum.service.ExperienceRuleService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.FeedbackService;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.PointsRuleOptionService;
import com.excel.forum.service.PointsRuleService;
import com.excel.forum.service.PracticeQuestionSubmissionService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.SiteNotificationService;
import com.excel.forum.service.UserEntitlementService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminOverviewController {
    private final UserService userService;
    private final FeedbackService feedbackService;
    private final NotificationService notificationService;
    private final SiteNotificationService siteNotificationService;
    private final QuestionService questionService;
    private final QuestionCategoryService questionCategoryService;
    private final QuestionExcelTemplateService questionExcelTemplateService;
    private final PracticeQuestionSubmissionService practiceQuestionSubmissionService;
    private final PointsRuleService pointsRuleService;
    private final PointsRuleOptionService pointsRuleOptionService;
    private final PointsRecordService pointsRecordService;
    private final ExperienceService experienceService;
    private final ExperienceRuleService experienceRuleService;
    private final ExperienceLevelRuleService experienceLevelRuleService;
    private final UserEntitlementService userEntitlementService;
    private final PracticeRecordMapper practiceRecordMapper;
    private final PracticeAnswerMapper practiceAnswerMapper;
    private final CheckinRecordMapper checkinRecordMapper;

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        Map<String, Object> stats = new HashMap<>();

        LocalDateTime todayStart = LocalDate.now().atStartOfDay();

        long userCount = userService.count();
        long onlineUserCount = userService.count(new QueryWrapper<User>().eq("is_online", true));
        long adminCount = userService.count(new QueryWrapper<User>().eq("role", "admin"));
        long operatorCount = userService.count(new QueryWrapper<User>().eq("role", "moderator"));
        long lockedUserCount = userService.count(new QueryWrapper<User>().eq("status", 1));
        long mutedUserCount = userService.count(new QueryWrapper<User>().eq("is_muted", true));
        long todayNewUsers = userService.count(new QueryWrapper<User>().ge("create_time", todayStart));

        long notificationCount = notificationService.count();
        long siteNotificationCount = siteNotificationService.count();
        long unreadNotificationCount = notificationService.count(new QueryWrapper<Notification>().eq("is_read", 0));

        long pendingFeedback = feedbackService.count(new QueryWrapper<Feedback>().eq("status", 0));
        long handledFeedback = feedbackService.count(new QueryWrapper<Feedback>().eq("status", 1));
        long ignoredFeedback = feedbackService.count(new QueryWrapper<Feedback>().eq("status", 2));

        long questionCount = questionService.count();
        long enabledQuestionCount = questionService.count(new QueryWrapper<Question>().eq("enabled", true));
        long questionCategoryCount = questionCategoryService.count();
        long questionTemplateCount = questionExcelTemplateService.count();
        long practiceRecordCount = practiceRecordMapper.selectCount(null);
        long practiceAnswerCount = practiceAnswerMapper.selectCount(null);
        long practiceSubmissionCount = practiceQuestionSubmissionService.count();
        long pendingPracticeSubmissionCount = practiceQuestionSubmissionService.count(new QueryWrapper<PracticeQuestionSubmission>().eq("status", "pending"));
        long approvedPracticeSubmissionCount = practiceQuestionSubmissionService.count(new QueryWrapper<PracticeQuestionSubmission>().eq("status", "approved"));
        long rejectedPracticeSubmissionCount = practiceQuestionSubmissionService.count(new QueryWrapper<PracticeQuestionSubmission>().eq("status", "rejected"));

        long pointsRuleCount = pointsRuleService.count();
        long enabledPointsRuleCount = pointsRuleService.count(new QueryWrapper<PointsRule>().eq("enabled", true));
        long pointsOptionCount = pointsRuleOptionService.count();
        long pointsRecordCount = pointsRecordService.count();

        long expRuleCount = experienceRuleService.count();
        long enabledExpRuleCount = experienceRuleService.count(new QueryWrapper<ExperienceRule>().eq("enabled", true));
        long levelRuleCount = experienceLevelRuleService.count();
        long enabledLevelRuleCount = experienceLevelRuleService.count(new QueryWrapper<ExperienceLevelRule>().eq("enabled", true));
        long expLogCount = experienceService.count();
        long entitlementCount = userEntitlementService.count();
        long todayCheckins = checkinRecordMapper.selectCount(new QueryWrapper<CheckinRecord>().ge("create_time", todayStart));

        stats.put("userCount", userCount);
        stats.put("pendingFeedback", pendingFeedback);

        stats.put("overview", Map.of(
                "onlineUsers", onlineUserCount,
                "todayNewUsers", todayNewUsers,
                "todayCheckins", todayCheckins
        ));
        stats.put("users", Map.of(
                "total", userCount,
                "online", onlineUserCount,
                "admins", adminCount,
                "operators", operatorCount,
                "locked", lockedUserCount,
                "muted", mutedUserCount
        ));
        stats.put("notifications", Map.of(
                "notifications", notificationCount,
                "total", notificationCount,
                "siteNotifications", siteNotificationCount,
                "unreadNotifications", unreadNotificationCount,
                "unread", unreadNotificationCount
        ));
        stats.put("moderation", Map.of(
                "pendingFeedback", pendingFeedback,
                "handledFeedback", handledFeedback,
                "ignoredFeedback", ignoredFeedback,
                "pendingPracticeSubmissions", pendingPracticeSubmissionCount
        ));
        stats.put("practice", Map.of(
                "questions", questionCount,
                "enabledQuestions", enabledQuestionCount,
                "questionCategories", questionCategoryCount,
                "questionTemplates", questionTemplateCount,
                "practiceRecords", practiceRecordCount,
                "practiceAnswers", practiceAnswerCount,
                "submissions", practiceSubmissionCount,
                "completedSubmissions", approvedPracticeSubmissionCount,
                "rejectedSubmissions", rejectedPracticeSubmissionCount
        ));
        stats.put("pointsAndLevels", Map.of(
                "pointsRules", pointsRuleCount,
                "enabledPointsRules", enabledPointsRuleCount,
                "pointsOptions", pointsOptionCount,
                "pointsRecords", pointsRecordCount,
                "expRules", expRuleCount,
                "enabledExpRules", enabledExpRuleCount,
                "levelRules", levelRuleCount,
                "enabledLevelRules", enabledLevelRuleCount,
                "expLogs", expLogCount,
                "entitlements", entitlementCount
        ));

        return ResponseEntity.ok(Map.of("stats", stats));
    }
}
