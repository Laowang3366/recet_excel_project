package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.PracticeQuestionSubmission;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionCategory;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.PracticeQuestionSubmissionService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
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

import java.time.LocalDateTime;
import java.util.Map;

import static com.excel.forum.util.QueryPageUtils.first;

@RestController
@RequestMapping("/api/admin/practice-submissions")
@RequiredArgsConstructor
public class AdminPracticeReviewController {
    private static final String USER_SUBMISSION_CATEGORY_NAME = "用户上传";
    private static final String USER_SUBMISSION_CATEGORY_GROUP = "用户投稿";

    private final PracticeQuestionSubmissionService practiceQuestionSubmissionService;
    private final QuestionCategoryService questionCategoryService;
    private final QuestionService questionService;
    private final QuestionExcelTemplateService questionExcelTemplateService;
    private final NotificationService notificationService;
    private final ExcelTemplateGradingService excelTemplateGradingService;
    private final PracticeCampaignService practiceCampaignService;

    @GetMapping
    public ResponseEntity<?> getPracticeSubmissions(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(defaultValue = "pending") String status) {
        return ResponseEntity.ok(practiceQuestionSubmissionService.getReviewPage(page, size, status));
    }

    @PutMapping("/{id}/review")
    @Transactional
    public ResponseEntity<?> reviewPracticeSubmission(
            @PathVariable Long id,
            @RequestAttribute("userId") Long reviewerId,
            @RequestBody Map<String, String> body) {
        PracticeQuestionSubmission submission = practiceQuestionSubmissionService.getById(id);
        if (submission == null) {
            return ResponseEntity.notFound().build();
        }
        if (!"pending".equalsIgnoreCase(String.valueOf(submission.getStatus()))) {
            return ResponseEntity.badRequest().body(Map.of("message", "该投稿已处理"));
        }

        String status = body.getOrDefault("status", "").trim();
        String reason = body.getOrDefault("reason", "").trim();
        if (!"approved".equals(status) && !"rejected".equals(status)) {
            return ResponseEntity.badRequest().body(Map.of("message", "无效的审核状态"));
        }
        if ("rejected".equals(status) && !StringUtils.hasText(reason)) {
            return ResponseEntity.badRequest().body(Map.of("message", "请填写驳回原因"));
        }

        if ("approved".equals(status)) {
            QuestionCategory targetCategory = ensureUserSubmissionQuestionCategory();
            Question question = new Question();
            question.setTitle(submission.getTitle());
            question.setType("excel_template");
            question.setQuestionCategoryId(targetCategory.getId());
            question.setDifficulty(submission.getDifficulty() == null ? 1 : submission.getDifficulty());
            question.setPoints(submission.getPoints() == null ? 0 : submission.getPoints());
            question.setExplanation(submission.getDescription());
            question.setEnabled(true);
            question.setOptions(null);
            question.setAnswer("");
            questionService.save(question);

            QuestionExcelTemplate template = new QuestionExcelTemplate();
            template.setQuestionId(question.getId());
            template.setTemplateFileUrl(submission.getTemplateFileUrl());
            template.setAnswerSheet(submission.getAnswerSheet());
            template.setAnswerRange(submission.getAnswerRange());
            template.setAnswerSnapshotJson(submission.getAnswerSnapshotJson());
            template.setCheckFormula(Boolean.TRUE.equals(submission.getCheckFormula()));
            template.setGradingRuleJson(excelTemplateGradingService.normalizeRuleJson(submission.getGradingRuleJson()));
            template.setExpectedSnapshotJson(submission.getExpectedSnapshotJson());
            template.setSheetCountLimit(submission.getSheetCountLimit() == null || submission.getSheetCountLimit() < 1 ? 5 : submission.getSheetCountLimit());
            template.setVersion(submission.getVersion() == null || submission.getVersion() < 1 ? 1 : submission.getVersion());
            questionExcelTemplateService.save(template);
            practiceCampaignService.syncCampaignCatalog();

            submission.setReviewNote("已完成，已归属到【" + targetCategory.getName() + "】模块，入库题目 #" + question.getId());
        } else {
            submission.setReviewNote(reason);
        }

        submission.setStatus(status);
        submission.setReviewerId(reviewerId);
        submission.setReviewedTime(LocalDateTime.now());
        practiceQuestionSubmissionService.updateById(submission);

        if (submission.getUserId() != null) {
            String message = "approved".equals(status)
                    ? "您投稿的试题《" + submission.getTitle() + "》已通过审核"
                    : "您投稿的试题《" + submission.getTitle() + "》未通过审核，原因：" + reason;
            notificationService.createNotification(submission.getUserId(), "feedback_result", message, null);
        }

        return ResponseEntity.ok(Map.of("message", "审核完成"));
    }

    private QuestionCategory ensureUserSubmissionQuestionCategory() {
        QuestionCategory category = first(questionCategoryService, new QueryWrapper<QuestionCategory>()
                .eq("name", USER_SUBMISSION_CATEGORY_NAME)
                .orderByAsc("id"));
        if (category != null) {
            return category;
        }
        QuestionCategory created = new QuestionCategory();
        created.setName(USER_SUBMISSION_CATEGORY_NAME);
        created.setDescription("统一收纳用户投稿并审核通过的练习题。");
        created.setGroupName(USER_SUBMISSION_CATEGORY_GROUP);
        created.setSortOrder(999);
        created.setEnabled(true);
        questionCategoryService.save(created);
        return created;
    }
}
