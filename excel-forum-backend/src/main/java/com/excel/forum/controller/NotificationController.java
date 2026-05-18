package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.excel.forum.entity.Notification;
import com.excel.forum.entity.SiteNotification;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.NotificationBatchDeleteRequest;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.SiteNotificationService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private static final List<String> CURRENT_NOTIFICATION_TYPES = List.of("system", "site_notification", "feedback_result");

    private final NotificationService notificationService;
    private final SiteNotificationService siteNotificationService;
    private final UserService userService;

    @GetMapping("/announcements")
    public ResponseEntity<?> getAnnouncements(
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        Page<SiteNotification> pageParam = new Page<>(page, size);
        QueryWrapper<SiteNotification> wrapper = new QueryWrapper<>();
        wrapper.eq("status", "sent");
        if (type != null && !type.isEmpty()) {
            wrapper.eq("type", type);
        }
        wrapper.orderByDesc("send_time");
        Page<SiteNotification> result = siteNotificationService.page(pageParam, wrapper);
        return ResponseEntity.ok(Map.of("records", result.getRecords(), "total", result.getTotal()));
    }

    @GetMapping("/announcements/{id}")
    public ResponseEntity<?> getAnnouncementDetail(@PathVariable Long id) {
        SiteNotification notification = siteNotificationService.getById(id);
        if (notification == null || !"sent".equals(notification.getStatus())) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("id", notification.getId());
        response.put("title", notification.getTitle());
        response.put("content", notification.getContent());
        response.put("type", notification.getType());
        response.put("status", notification.getStatus());
        response.put("targetType", notification.getTargetType());
        response.put("targetRoles", notification.getTargetRoles());
        response.put("readCount", notification.getReadCount());
        response.put("totalCount", notification.getTotalCount());
        response.put("attachments", notification.getAttachments());
        response.put("sendTime", notification.getSendTime());
        response.put("createTime", notification.getCreateTime());
        response.put("updateTime", notification.getUpdateTime());
        response.put("targetLink", null);
        response.put("isAnnouncement", true);

        if (notification.getCreatedBy() != null) {
            User creator = userService.getById(notification.getCreatedBy());
            if (creator != null) {
                Map<String, Object> sender = new HashMap<>();
                sender.put("id", creator.getId());
                sender.put("username", creator.getUsername());
                sender.put("avatar", creator.getAvatar());
                sender.put("role", creator.getRole());
                response.put("sender", sender);
            }
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(
            @RequestAttribute Long userId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer limit) {

        Map<String, Object> notifications = notificationService.getUserNotifications(userId, type, page, limit);
        return ResponseEntity.ok(notifications);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getNotificationDetail(@RequestAttribute Long userId, @PathVariable Long id) {
        Notification notification = notificationService.getById(id);
        if (notification == null
                || !notification.getUserId().equals(userId)
                || !CURRENT_NOTIFICATION_TYPES.contains(notification.getType())) {
            return ResponseEntity.notFound().build();
        }

        if ("site_notification".equals(notification.getType()) && notification.getRelatedId() != null) {
            SiteNotification siteNotification = siteNotificationService.getById(notification.getRelatedId());
            if (siteNotification != null) {
                Map<String, Object> response = new HashMap<>();
                response.put("id", notification.getId());
                response.put("title", siteNotification.getTitle());
                response.put("content", siteNotification.getContent());
                response.put("type", siteNotification.getType());
                response.put("relatedId", notification.getRelatedId());
                response.put("replyId", notification.getReplyId());
                response.put("isRead", notification.getIsRead());
                response.put("createTime", notification.getCreateTime());
                response.put("sendTime", siteNotification.getSendTime() != null ? siteNotification.getSendTime() : notification.getCreateTime());
                response.put("targetLink", "/notification/" + siteNotification.getId());
                response.put("isAnnouncement", true);
                response.put("readCount", siteNotification.getReadCount());
                response.put("totalCount", siteNotification.getTotalCount());
                response.put("targetType", siteNotification.getTargetType());
                response.put("targetRoles", siteNotification.getTargetRoles());
                response.put("attachments", siteNotification.getAttachments());

                if (siteNotification.getCreatedBy() != null) {
                    User sender = userService.getById(siteNotification.getCreatedBy());
                    if (sender != null) {
                        Map<String, Object> senderPayload = new HashMap<>();
                        senderPayload.put("id", sender.getId());
                        senderPayload.put("username", sender.getUsername());
                        senderPayload.put("avatar", sender.getAvatar());
                        senderPayload.put("role", sender.getRole());
                        response.put("sender", senderPayload);
                    }
                }

                return ResponseEntity.ok(response);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("id", notification.getId());
        response.put("title", buildNotificationTitle(notification));
        response.put("content", notification.getContent());
        response.put("type", notification.getType());
        response.put("relatedId", notification.getRelatedId());
        response.put("replyId", notification.getReplyId());
        response.put("isRead", notification.getIsRead());
        response.put("createTime", notification.getCreateTime());
        response.put("sendTime", notification.getCreateTime());
        response.put("targetLink", resolveNotificationTargetLink(notification));
        response.put("isAnnouncement", false);
        response.put("readCount", notification.getIsRead() != null && notification.getIsRead() == 1 ? 1 : 0);
        response.put("totalCount", 1);
        response.put("targetType", "single_user");
        response.put("targetRoles", null);
        response.put("attachments", null);

        if (notification.getSenderId() != null) {
            User sender = userService.getById(notification.getSenderId());
            if (sender != null) {
                Map<String, Object> senderPayload = new HashMap<>();
                senderPayload.put("id", sender.getId());
                senderPayload.put("username", sender.getUsername());
                senderPayload.put("avatar", sender.getAvatar());
                senderPayload.put("role", sender.getRole());
                response.put("sender", senderPayload);
            }
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(@RequestAttribute Long userId) {
        QueryWrapper<Notification> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId)
                .eq("is_read", 0)
                .in("type", CURRENT_NOTIFICATION_TYPES);
        long count = notificationService.count(queryWrapper);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @GetMapping("/counts")
    public ResponseEntity<?> getCounts(@RequestAttribute Long userId) {
        return ResponseEntity.ok(notificationService.getCountsByType(userId));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@RequestAttribute Long userId, @PathVariable Long id) {
        Notification notification = notificationService.getById(id);
        if (notification != null
                && notification.getUserId().equals(userId)
                && CURRENT_NOTIFICATION_TYPES.contains(notification.getType())) {
            notificationService.markAsRead(userId, id);

            // 如果是站内公告，递增 readCount
            if ("site_notification".equals(notification.getType()) && notification.getRelatedId() != null) {
                siteNotificationService.incrementReadCount(notification.getRelatedId());
            }
        }
        return ResponseEntity.ok("标记成功");
    }

    @PutMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(@RequestAttribute Long userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok("全部标记成功");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNotification(@RequestAttribute Long userId, @PathVariable Long id) {
        notificationService.deleteNotification(userId, id);
        return ResponseEntity.ok(Map.of("message", "删除成功"));
    }

    @DeleteMapping("/batch")
    public ResponseEntity<?> deleteBatch(@RequestAttribute Long userId, @RequestBody NotificationBatchDeleteRequest body) {
        List<Long> ids = parseNotificationIds(body == null ? null : body.getIds());
        if (ids == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "通知ID格式不正确"));
        }
        if (!ids.isEmpty()) {
            notificationService.deleteBatch(userId, ids);
        }
        return ResponseEntity.ok(Map.of("message", "删除成功"));
    }

    private List<Long> parseNotificationIds(List<Object> rawIds) {
        if (rawIds == null) {
            return List.of();
        }
        java.util.ArrayList<Long> ids = new java.util.ArrayList<>();
        for (Object rawId : rawIds) {
            if (rawId instanceof Number number) {
                ids.add(number.longValue());
                continue;
            }
            if (rawId instanceof String text && !text.isBlank()) {
                try {
                    ids.add(Long.parseLong(text.trim()));
                    continue;
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
            return null;
        }
        return ids;
    }

    private String buildNotificationTitle(Notification notification) {
        String type = notification.getType() == null ? "" : notification.getType();
        return switch (type) {
            case "system" -> "积分发放通知";
            case "feedback_result" -> "反馈处理结果";
            case "site_notification" -> "站内通知";
            default -> "通知详情";
        };
    }

    private String resolveNotificationTargetLink(Notification notification) {
        if (notification == null || notification.getType() == null) {
            return null;
        }
        return switch (notification.getType()) {
            case "site_notification" -> notification.getRelatedId() == null ? null : "/notification/" + notification.getRelatedId();
            default -> null;
        };
    }
}
