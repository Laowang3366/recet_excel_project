package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

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

    @GetMapping("/feedback")
    public ResponseEntity<?> getFeedback(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String keyword) {

        Page<Feedback> pageRequest = new Page<>(page, size);
        QueryWrapper<Feedback> queryWrapper = new QueryWrapper<>();

        if (StringUtils.hasText(status)) {
            if ("pending".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 0);
            } else if ("handled".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 1);
            } else if ("ignored".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 2);
            }
        }

        if (StringUtils.hasText(type)) {
            queryWrapper.eq("type", type.trim());
        }

        if (StringUtils.hasText(keyword)) {
            queryWrapper.like("content", keyword.trim());
        }

        queryWrapper.orderByDesc("create_time");

        Page<Feedback> result = feedbackService.page(pageRequest, queryWrapper);
        Set<Long> userIds = result.getRecords().stream()
                .flatMap(item -> java.util.stream.Stream.of(item.getUserId(), item.getHandlerId()))
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, User> userMap = userIds.isEmpty()
                ? Map.of()
                : userService.listByIds(userIds).stream().collect(Collectors.toMap(User::getId, item -> item, (a, b) -> a));

        List<Map<String, Object>> records = result.getRecords().stream().map(item -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", item.getId());
            map.put("type", item.getType());
            map.put("content", item.getContent());
            map.put("status", item.getStatus() == null || item.getStatus() == 0 ? "pending" : item.getStatus() == 1 ? "handled" : "ignored");
            map.put("createTime", item.getCreateTime());
            map.put("handleTime", item.getHandleTime());
            map.put("handleNote", item.getHandleNote());

            User author = userMap.get(item.getUserId());
            if (author != null) {
                Map<String, Object> userPayload = new HashMap<>();
                userPayload.put("id", author.getId());
                userPayload.put("username", author.getUsername());
                userPayload.put("avatar", author.getAvatar());
                map.put("user", userPayload);
            }

            User handler = userMap.get(item.getHandlerId());
            if (handler != null) {
                Map<String, Object> handlerPayload = new HashMap<>();
                handlerPayload.put("id", handler.getId());
                handlerPayload.put("username", handler.getUsername());
                map.put("handler", handlerPayload);
            }
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "records", records,
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize()
        ));
    }

    @PutMapping("/feedback/{id}/handle")
    @Transactional
    public ResponseEntity<?> handleFeedback(
            @PathVariable Long id,
            @RequestAttribute Long userId,
            @RequestBody Map<String, String> body) {
        Feedback feedback = feedbackService.getById(id);
        if (feedback == null) {
            return ResponseEntity.notFound().build();
        }

        String action = body.getOrDefault("action", "").trim();
        String note = body.getOrDefault("note", "").trim();
        if (!"handle".equals(action) && !"ignore".equals(action)) {
            return ResponseEntity.badRequest().body(Map.of("message", "处理动作无效"));
        }

        feedback.setStatus("handle".equals(action) ? 1 : 2);
        feedback.setHandlerId(userId);
        feedback.setHandleNote(note.isBlank() ? null : note);
        feedback.setHandleTime(LocalDateTime.now());
        feedbackService.updateById(feedback);

        if (feedback.getUserId() != null) {
            String message;
            if ("handle".equals(action)) {
                message = "您的反馈建议已处理";
            } else {
                message = "您的反馈建议已查看，当前暂未采纳";
            }
            if (StringUtils.hasText(note)) {
                message = message + "：" + note.trim();
            }
            notificationService.createNotification(feedback.getUserId(), "feedback_result", message, null);
        }

        return ResponseEntity.ok(Map.of("message", "反馈已处理"));
    }
}
