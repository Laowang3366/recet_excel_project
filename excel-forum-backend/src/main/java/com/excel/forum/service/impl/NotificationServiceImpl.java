package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.Notification;
import com.excel.forum.entity.SiteNotification;
import com.excel.forum.mapper.NotificationMapper;
import com.excel.forum.mapper.SiteNotificationMapper;
import com.excel.forum.service.ForumEventService;
import com.excel.forum.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationServiceImpl extends ServiceImpl<NotificationMapper, Notification> implements NotificationService {
    private static final Set<String> SENDER_RATE_LIMIT_TYPES = new HashSet<>(Arrays.asList("MENTION", "reply", "like", "favorite", "follow", "message"));
    private static final int SAME_EVENT_TTL_SECONDS = 90;
    private static final int SENDER_RATE_TTL_SECONDS = 60;
    private static final int SENDER_RATE_LIMIT = 20;
    private static final int MENTION_RATE_LIMIT = 5;

    private final ForumEventService forumEventService;
    private final StringRedisTemplate redisTemplate;
    private final SiteNotificationMapper siteNotificationMapper;
    
    @Override
    public Map<String, Object> getUserNotifications(Long userId, String type, Integer page, Integer limit) {
        QueryWrapper<Notification> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId);
        
        if (type != null && !type.isEmpty()) {
            String[] types = type.split(",");
            if (types.length == 1) {
                queryWrapper.eq("type", types[0]);
            } else {
                queryWrapper.in("type", Arrays.asList(types));
            }
        }
        
        queryWrapper.orderByDesc("create_time");
        
        Page<Notification> pageRequest = new Page<>(page, limit);
        Page<Notification> result = page(pageRequest, queryWrapper);
        
        Map<Long, SiteNotification> siteNotificationMap = loadSiteNotificationMap(result.getRecords());

        List<Map<String, Object>> records = result.getRecords().stream()
                .map(notification -> buildNotificationPayload(notification, siteNotificationMap.get(notification.getRelatedId())))
                .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("notifications", records);
        response.put("total", result.getTotal());
        
        return response;
    }

    @Override
    public void markAsRead(Long userId, Long notificationId) {
        UpdateWrapper<Notification> updateWrapper = new UpdateWrapper<>();
        updateWrapper.set("is_read", 1)
                    .eq("id", notificationId)
                    .eq("user_id", userId);
        update(updateWrapper);
    }

    @Override
    public void markAllAsRead(Long userId) {
        UpdateWrapper<Notification> updateWrapper = new UpdateWrapper<>();
        updateWrapper.set("is_read", 1)
                    .eq("user_id", userId)
                    .eq("is_read", 0);
        update(updateWrapper);
    }

    @Override
    public void createNotification(Long userId, String type, String content, Long relatedId) {
        createNotification(userId, type, content, relatedId, null, null);
    }

    @Override
    public void createNotification(Long userId, String type, String content, Long relatedId, Long senderId) {
        createNotification(userId, type, content, relatedId, null, senderId);
    }

    @Override
    public void createNotification(Long userId, String type, String content, Long relatedId, Long replyId, Long senderId) {
        if (shouldSuppressNotification(userId, type, relatedId, replyId, senderId)) {
            return;
        }

        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setContent(content);
        notification.setRelatedId(relatedId);
        notification.setReplyId(replyId);
        notification.setSenderId(senderId);
        notification.setIsRead(0);
        save(notification);

        // 通过 WebSocket 推送通知事件给目标用户
        try {
            forumEventService.publishNotificationEvent(userId, notification);
        } catch (Exception e) {
            log.warn("WebSocket推送通知失败: {}", e.getMessage());
        }
    }

    private boolean shouldSuppressNotification(Long userId, String type, Long relatedId, Long replyId, Long senderId) {
        if (userId == null || type == null || type.isBlank()) {
            return true;
        }
        if (senderId == null || !SENDER_RATE_LIMIT_TYPES.contains(type)) {
            return false;
        }
        try {
            String dedupeKey = "notify:dedupe:" + type + ":" + userId + ":" + senderId + ":" + normalizeKeyPart(relatedId) + ":" + normalizeKeyPart(replyId);
            Boolean firstSeen = redisTemplate.opsForValue().setIfAbsent(dedupeKey, "1", SAME_EVENT_TTL_SECONDS, TimeUnit.SECONDS);
            if (Boolean.FALSE.equals(firstSeen)) {
                return true;
            }

            String rateKey = "notify:rate:" + type + ":" + userId + ":" + senderId;
            Long sentCount = redisTemplate.opsForValue().increment(rateKey);
            if (sentCount != null && sentCount == 1L) {
                redisTemplate.expire(rateKey, SENDER_RATE_TTL_SECONDS, TimeUnit.SECONDS);
            }
            int limit = "MENTION".equals(type) ? MENTION_RATE_LIMIT : SENDER_RATE_LIMIT;
            return sentCount != null && sentCount > limit;
        } catch (Exception e) {
            log.warn("通知频率限制检查失败: {}", e.getMessage());
            return false;
        }
    }

    private String normalizeKeyPart(Long value) {
        return value == null ? "none" : value.toString();
    }

    private Map<Long, SiteNotification> loadSiteNotificationMap(List<Notification> notifications) {
        List<Long> siteNotificationIds = notifications.stream()
                .filter(item -> "site_notification".equalsIgnoreCase(item.getType()))
                .map(Notification::getRelatedId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (siteNotificationIds.isEmpty()) {
            return Map.of();
        }
        return siteNotificationMapper.selectBatchIds(siteNotificationIds).stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(SiteNotification::getId, item -> item, (left, right) -> left));
    }

    private Map<String, Object> buildNotificationPayload(Notification notification, SiteNotification siteNotification) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", notification.getId());
        item.put("userId", notification.getUserId());
        item.put("type", notification.getType());
        item.put("content", notification.getContent());
        item.put("relatedId", notification.getRelatedId());
        item.put("replyId", notification.getReplyId());
        item.put("senderId", notification.getSenderId());
        item.put("isRead", notification.getIsRead());
        item.put("createTime", notification.getCreateTime());

        if (siteNotification != null) {
            item.put("title", siteNotification.getTitle());
            item.put("detailContent", siteNotification.getContent());
            item.put("announcementType", siteNotification.getType());
            item.put("attachments", siteNotification.getAttachments());
            item.put("sendTime", siteNotification.getSendTime());
        }

        return item;
    }

    @Override
    public void deleteNotification(Long userId, Long notificationId) {
        QueryWrapper<Notification> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("id", notificationId).eq("user_id", userId);
        remove(queryWrapper);
    }

    @Override
    public void deleteBatch(Long userId, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return;
        QueryWrapper<Notification> queryWrapper = new QueryWrapper<>();
        queryWrapper.in("id", ids).eq("user_id", userId);
        remove(queryWrapper);
    }

    @Override
    public Map<String, Object> getCountsByType(Long userId) {
        long all = count(new QueryWrapper<Notification>().eq("user_id", userId));
        long current = count(new QueryWrapper<Notification>().eq("user_id", userId).in("type", "system", "site_notification", "feedback_result"));
        long points = count(new QueryWrapper<Notification>().eq("user_id", userId).eq("type", "system"));
        long announcements = count(new QueryWrapper<Notification>().eq("user_id", userId).eq("type", "site_notification"));
        long legacy = count(new QueryWrapper<Notification>().eq("user_id", userId).in("type",
                "follow", "level_up", "reply", "like", "favorite", "MENTION", "message",
                "post_deleted", "reply_deleted", "report_delete", "post_review", "review_request"));

        Map<String, Object> result = new HashMap<>();
        result.put("all", all);
        result.put("system", current);
        result.put("points", points);
        result.put("announcements", announcements);
        result.put("legacy", legacy);
        return result;
    }
}
