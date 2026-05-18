package com.excel.forum.controller;

import com.excel.forum.entity.Feedback;
import com.excel.forum.entity.dto.FeedbackSubmitRequest;
import com.excel.forum.service.FeedbackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "performance_optimization",
            "feature_optimization",
            "new_feature",
            "other"
    );

    private final FeedbackService feedbackService;

    @PostMapping
    public ResponseEntity<?> submitFeedback(@RequestAttribute Long userId, @RequestBody FeedbackSubmitRequest body) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "未登录"));
        }

        String type = body == null || body.getType() == null ? "" : body.getType().trim();
        String content = body == null || body.getContent() == null ? "" : body.getContent().trim();

        if (!ALLOWED_TYPES.contains(type)) {
            return ResponseEntity.badRequest().body(Map.of("message", "反馈类型无效"));
        }
        if (content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "请填写反馈内容"));
        }
        if (content.length() > 1000) {
            return ResponseEntity.badRequest().body(Map.of("message", "反馈内容不能超过1000字"));
        }

        Feedback feedback = new Feedback();
        feedback.setUserId(userId);
        feedback.setType(type);
        feedback.setContent(content);
        feedback.setStatus(0);
        feedbackService.save(feedback);

        return ResponseEntity.ok(Map.of(
                "message", "反馈已提交",
                "id", feedback.getId()
        ));
    }
}
