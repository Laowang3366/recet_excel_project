package com.excel.forum.controller;

import com.excel.forum.entity.SiteNotification;
import com.excel.forum.entity.dto.AdminNotificationRequest;
import com.excel.forum.service.SiteNotificationService;
import com.excel.forum.util.HtmlSanitizer;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Map;
import java.util.stream.Collectors;

import static com.excel.forum.controller.AdminControllerSupport.defaultValue;
import static com.excel.forum.controller.AdminControllerSupport.stringValue;

@RestController
@RequestMapping("/api/admin/notifications")
@RequiredArgsConstructor
public class AdminNotificationController {
    private final SiteNotificationService siteNotificationService;
    private final HtmlSanitizer htmlSanitizer;

    @GetMapping
    public ResponseEntity<?> getNotifications(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(siteNotificationService.getNotificationsPage(page, size));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getNotificationStats() {
        return ResponseEntity.ok(siteNotificationService.getStats());
    }

    @PostMapping
    public ResponseEntity<?> createNotification(@RequestBody AdminNotificationRequest body, @RequestAttribute("userId") Long userId) {
        SiteNotification notification = buildSiteNotification(body, new SiteNotification());
        ResponseEntity<?> validationError = validateNotification(notification);
        if (validationError != null) {
            return validationError;
        }

        notification.setCreatedBy(userId);
        notification.setReadCount(0);

        siteNotificationService.save(notification);

        if ("sent".equals(notification.getStatus())) {
            siteNotificationService.sendNotification(notification.getId());
        }

        return ResponseEntity.ok(notification);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateNotification(@PathVariable Long id, @RequestBody AdminNotificationRequest body) {
        SiteNotification existing = siteNotificationService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        String previousStatus = existing.getStatus();
        SiteNotification notification = buildSiteNotification(body, existing);
        notification.setId(id);
        ResponseEntity<?> validationError = validateNotification(notification);
        if (validationError != null) {
            return validationError;
        }
        siteNotificationService.updateById(notification);
        if (!"sent".equals(previousStatus) && "sent".equals(notification.getStatus())) {
            siteNotificationService.sendNotification(id);
            notification = siteNotificationService.getById(id);
        }
        return ResponseEntity.ok(notification);
    }

    @PutMapping("/{id}/send")
    public ResponseEntity<?> sendNotification(@PathVariable Long id) {
        SiteNotification notification = siteNotificationService.getById(id);
        if (notification == null) {
            return ResponseEntity.notFound().build();
        }
        siteNotificationService.sendNotification(id);
        return ResponseEntity.ok(Map.of("message", "发送成功"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNotification(@PathVariable Long id) {
        siteNotificationService.removeById(id);
        return ResponseEntity.ok(Map.of("message", "通知已删除"));
    }

    private SiteNotification buildSiteNotification(AdminNotificationRequest body, SiteNotification notification) {
        notification.setTitle(body == null ? null : stringValue(body.getTitle()));
        notification.setContent(htmlSanitizer.sanitize(body == null ? null : stringValue(body.getContent())));
        notification.setType(defaultValue(body == null ? null : stringValue(body.getType()), "system"));
        notification.setStatus(defaultValue(body == null ? null : stringValue(body.getStatus()), "draft"));
        notification.setTargetType(defaultValue(body == null ? null : stringValue(body.getTargetType()), "all"));
        notification.setTargetRoles("role".equals(notification.getTargetType()) && body != null ? normalizeTargetRoles(body.getTargetRoles()) : null);
        notification.setTargetUserIds("user".equals(notification.getTargetType()) && body != null ? normalizeTargetIds(body.getTargetUserIds()) : null);
        notification.setAttachments(body == null ? null : stringValue(body.getAttachments()));
        notification.setScheduledTime(body == null ? null : body.getScheduledTime());
        notification.setPinned(Boolean.TRUE.equals(body == null ? null : body.getPinned()));
        notification.setPinnedUntil(Boolean.TRUE.equals(notification.getPinned()) ? LocalDateTime.now().plusDays(7) : null);

        if ("sent".equals(notification.getStatus())) {
            notification.setScheduledTime(null);
        } else {
            notification.setSendTime(null);
        }

        return notification;
    }

    private ResponseEntity<?> validateNotification(SiteNotification notification) {
        if (notification.getTitle() == null || notification.getTitle().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "标题不能为空"));
        }
        if (notification.getContent() == null || notification.getContent().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "内容不能为空"));
        }
        if (!"draft".equals(notification.getStatus())
                && !"scheduled".equals(notification.getStatus())
                && !"sent".equals(notification.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("message", "通知状态无效"));
        }
        if (!"all".equals(notification.getTargetType())
                && !"role".equals(notification.getTargetType())
                && !"user".equals(notification.getTargetType())) {
            return ResponseEntity.badRequest().body(Map.of("message", "发送目标无效"));
        }
        if ("role".equals(notification.getTargetType())
                && (notification.getTargetRoles() == null || notification.getTargetRoles().isBlank())) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择目标角色"));
        }
        if ("user".equals(notification.getTargetType())
                && (notification.getTargetUserIds() == null || notification.getTargetUserIds().isBlank())) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择目标用户"));
        }
        if ("scheduled".equals(notification.getStatus()) && notification.getScheduledTime() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择定时发送时间"));
        }
        if ("scheduled".equals(notification.getStatus())
                && notification.getScheduledTime().isBefore(LocalDateTime.now().minusMinutes(1))) {
            return ResponseEntity.badRequest().body(Map.of("message", "定时发送时间必须晚于当前时间"));
        }
        return null;
    }

    private String normalizeTargetRoles(Object rawTargetRoles) {
        if (rawTargetRoles == null) {
            return null;
        }
        if (rawTargetRoles instanceof String value) {
            String normalized = value.trim();
            return normalized.isEmpty() ? null : normalized;
        }
        if (rawTargetRoles instanceof Collection<?> values) {
            String normalized = values.stream()
                    .map(value -> value == null ? null : value.toString().trim())
                    .filter(value -> value != null && !value.isEmpty())
                    .collect(Collectors.joining(","));
            return normalized.isEmpty() ? null : normalized;
        }
        String normalized = rawTargetRoles.toString().trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeTargetIds(Object rawTargetIds) {
        if (rawTargetIds == null) {
            return null;
        }
        if (rawTargetIds instanceof String value) {
            return normalizeTargetIdsFromText(value);
        }
        if (rawTargetIds instanceof Collection<?> values) {
            String normalized = values.stream()
                    .map(value -> value == null ? null : normalizeTargetIdsFromText(value.toString()))
                    .filter(value -> value != null && !value.isEmpty())
                    .collect(Collectors.joining(","));
            return normalized.isEmpty() ? null : normalized;
        }
        return normalizeTargetIdsFromText(rawTargetIds.toString());
    }

    private String normalizeTargetIdsFromText(String rawText) {
        if (rawText == null) {
            return null;
        }
        String normalized = java.util.Arrays.stream(rawText.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> {
                    try {
                        long id = Long.parseLong(value);
                        return id > 0 ? Long.toString(id) : null;
                    } catch (NumberFormatException invalidId) {
                        // Invalid user ids are discarded during normalization; validation happens on the final id list.
                        return null;
                    }
                })
                .filter(value -> value != null && !value.isEmpty())
                .distinct()
                .collect(Collectors.joining(","));
        return normalized.isEmpty() ? null : normalized;
    }
}
