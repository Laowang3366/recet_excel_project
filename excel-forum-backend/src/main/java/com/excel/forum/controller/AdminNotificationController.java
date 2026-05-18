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
        if (notification.getTitle() == null || notification.getTitle().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "标题不能为空"));
        }
        if (notification.getContent() == null || notification.getContent().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "内容不能为空"));
        }

        notification.setCreatedBy(userId);
        notification.setReadCount(0);

        if ("sent".equals(notification.getStatus())) {
            notification.setSendTime(java.time.LocalDateTime.now());
        }

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
        notification.setAttachments(body == null ? null : stringValue(body.getAttachments()));

        if ("sent".equals(notification.getStatus())) {
            if (notification.getSendTime() == null) {
                notification.setSendTime(java.time.LocalDateTime.now());
            }
        } else {
            notification.setSendTime(null);
        }

        return notification;
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
}
