package com.excel.forum.controller;

import com.excel.forum.config.PublicCacheHeaders;
import com.excel.forum.config.PublicJsonCache;
import com.excel.forum.entity.dto.PracticeSubmitRequest;
import com.excel.forum.entity.dto.PracticeQuestionSubmissionRequest;
import com.excel.forum.entity.dto.PracticeQuestionWorkbookFile;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.PracticeService;
import com.excel.forum.service.PracticeWorkbookLinkService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/practice")
@RequiredArgsConstructor
public class PracticeController {
    private final PracticeService practiceService;
    private final ExcelTemplateGradingService excelTemplateGradingService;
    private final PublicJsonCache publicJsonCache;
    private final PracticeWorkbookLinkService practiceWorkbookLinkService;
    private final RateLimitService rateLimitService;

    @GetMapping("/categories")
    public ResponseEntity<String> getCategories() {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(PublicCacheHeaders.SHORT_PUBLIC_CACHE)
                .body(publicJsonCache.get("practice:categories", practiceService::getPracticeCategories));
    }

    @GetMapping("/question-list")
    public ResponseEntity<?> getQuestionList(
            @RequestParam(required = false) Long questionCategoryId,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(practiceService.getPracticeQuestionList(questionCategoryId, userId));
    }

    @GetMapping("/questions")
    public ResponseEntity<?> getQuestions(
            @RequestParam(required = false) Long questionCategoryId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "10") Integer count,
            @RequestParam(required = false) Integer difficulty) {
        return ResponseEntity.ok(practiceService.getPracticeQuestions(
                questionCategoryId != null ? questionCategoryId : categoryId,
                count,
                difficulty
        ));
    }

    @GetMapping("/questions/{questionId}")
    public ResponseEntity<?> getQuestionDetail(@PathVariable Long questionId) {
        try {
            return ResponseEntity.ok(practiceService.getPracticeQuestionDetail(questionId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/questions/{questionId}/external-open-url")
    public ResponseEntity<?> createQuestionWorkbookExternalOpenUrl(
            @RequestAttribute Long userId,
            @PathVariable Long questionId) {
        String ticket = practiceWorkbookLinkService.createTicket(questionId, userId);
        return ResponseEntity.ok(Map.of(
                "url", "/api/practice/questions/" + questionId + "/file/excelcc-practice-question.xlsx?ticket=" + ticket,
                "expiresInSeconds", 600
        ));
    }

    @GetMapping("/questions/{questionId}/file")
    public ResponseEntity<?> downloadQuestionWorkbookFile(
            @RequestAttribute(value = "userId", required = false) Long userId,
            @PathVariable Long questionId,
            @RequestParam(required = false) String ticket) {
        return buildQuestionWorkbookFileResponse(userId, questionId, ticket);
    }

    @GetMapping("/questions/{questionId}/file/{fileName}")
    public ResponseEntity<?> downloadQuestionWorkbookFileForOffice(
            @RequestAttribute(value = "userId", required = false) Long userId,
            @PathVariable Long questionId,
            @PathVariable String fileName,
            @RequestParam(required = false) String ticket) {
        return buildQuestionWorkbookFileResponse(userId, questionId, ticket);
    }

    @GetMapping("/questions/{questionId}/template-snapshot")
    public ResponseEntity<?> getQuestionTemplateSnapshot(
            @RequestAttribute Long userId,
            @PathVariable Long questionId) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "practice:template-snapshot:user:" + userId + ":question:" + questionId,
                30,
                Duration.ofMinutes(1),
                "模板预览过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        try {
            return ResponseEntity.ok(practiceService.getPracticeQuestionTemplateSnapshot(questionId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private ResponseEntity<?> buildQuestionWorkbookFileResponse(Long userId, Long questionId, String ticket) {
        if (userId == null && !practiceWorkbookLinkService.isValid(questionId, ticket)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "未登录"));
        }
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "download:practice-question:" + (userId == null ? "ticket" : "user:" + userId) + ":question:" + questionId,
                30,
                Duration.ofMinutes(1),
                "文件下载过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        try {
            PracticeQuestionWorkbookFile workbookFile = practiceService.buildPracticeQuestionWorkbookFile(questionId);
            ByteArrayResource resource = new ByteArrayResource(workbookFile.content());
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(workbookFile.contentType()))
                    .contentLength(workbookFile.content().length)
                    .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                            .filename(workbookFile.fileName(), StandardCharsets.UTF_8)
                            .build()
                            .toString())
                    .body(resource);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/template-snapshot")
    public ResponseEntity<?> getTemplateSnapshot(@RequestParam String fileUrl) {
        try {
            return ResponseEntity.ok(excelTemplateGradingService.loadWorkbookSnapshot(fileUrl));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<?> getLeaderboard(
            @RequestParam(required = false) Long questionCategoryId,
            @RequestParam(defaultValue = "10") Integer limit) {
        return ResponseEntity.ok(practiceService.getPracticeLeaderboard(questionCategoryId, limit));
    }

    @PostMapping("/submit")
    public ResponseEntity<?> submitPractice(
            @RequestAttribute Long userId,
            @RequestBody PracticeSubmitRequest request) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "practice:submit:user:" + userId,
                30,
                Duration.ofMinutes(1),
                "答题提交过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        limited = checkQuestionSubmitLimits(userId, request);
        if (limited != null) {
            return limited;
        }
        try {
            return ResponseEntity.ok(practiceService.submitPractice(userId, request));
        } catch (IllegalArgumentException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/submissions")
    public ResponseEntity<?> submitPracticeQuestion(
            @RequestAttribute Long userId,
            @RequestBody PracticeQuestionSubmissionRequest request) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "practice:question-submission:user:" + userId,
                10,
                Duration.ofMinutes(1),
                "投稿提交过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        try {
            return ResponseEntity.ok(practiceService.submitPracticeQuestion(userId, request));
        } catch (IllegalArgumentException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/submissions/mine")
    public ResponseEntity<?> getMyPracticeSubmissions(
            @RequestAttribute Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(practiceService.getPracticeSubmissionProgress(userId, page, size));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(
            @RequestAttribute Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(practiceService.getPracticeHistory(userId, page, size));
    }

    @GetMapping("/history/{id}")
    public ResponseEntity<?> getHistoryDetail(@RequestAttribute Long userId, @PathVariable Long id) {
        Map<String, Object> detail = practiceService.getPracticeHistoryDetail(userId, id);
        if (detail == null) {
            return ResponseEntity.status(404).body(Map.of("message", "练习记录不存在"));
        }
        return ResponseEntity.ok(detail);
    }

    private boolean isLoginRequired(RuntimeException e) {
        String message = e.getMessage();
        return "未登录".equals(message) || "请先登录".equals(message);
    }

    private ResponseEntity<?> checkQuestionSubmitLimits(Long userId, PracticeSubmitRequest request) {
        if (request == null || request.getAnswers() == null || request.getAnswers().isEmpty()) {
            return null;
        }
        Set<Long> checkedQuestionIds = new HashSet<>();
        for (var answer : request.getAnswers()) {
            if (answer == null || answer.getQuestionId() == null || !checkedQuestionIds.add(answer.getQuestionId())) {
                continue;
            }
            ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                    "practice:submit:user:" + userId + ":question:" + answer.getQuestionId(),
                    6,
                    Duration.ofMinutes(1),
                    "该题提交过于频繁，请稍后再试"
            ));
            if (limited != null) {
                return limited;
            }
        }
        return null;
    }

    private ResponseEntity<?> toLimitResponse(RateLimitResult result) {
        if (result == null || result.allowed()) {
            return null;
        }
        return ResponseEntity.status(429).body(Map.of(
                "message", result.message(),
                "retryAfterSeconds", result.retryAfterSeconds()
        ));
    }
}
