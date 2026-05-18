package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.excel.forum.entity.Feedback;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.AdminFeedbackHandleRequest;
import com.excel.forum.service.FeedbackService;
import com.excel.forum.service.NotificationService;
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

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/feedback")
@RequiredArgsConstructor
public class AdminFeedbackController {
    private final UserService userService;
    private final FeedbackService feedbackService;
    private final NotificationService notificationService;

    @GetMapping
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

    @PutMapping("/{id}/handle")
    @Transactional
    public ResponseEntity<?> handleFeedback(
            @PathVariable Long id,
            @RequestAttribute Long userId,
            @RequestBody AdminFeedbackHandleRequest body) {
        Feedback feedback = feedbackService.getById(id);
        if (feedback == null) {
            return ResponseEntity.notFound().build();
        }

        String action = body == null || body.getAction() == null ? "" : body.getAction().trim();
        String note = body == null || body.getNote() == null ? "" : body.getNote().trim();
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
