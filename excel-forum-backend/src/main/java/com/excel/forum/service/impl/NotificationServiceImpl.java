package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.Notification;
import com.excel.forum.entity.SiteNotification;
import com.excel.forum.mapper.NotificationMapper;
import com.excel.forum.mapper.SiteNotificationMapper;
import com.excel.forum.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl extends ServiceImpl<NotificationMapper, Notification> implements NotificationService {
    private static final Set<String> CURRENT_NOTIFICATION_TYPES = Set.of("system", "site_notification", "feedback_result", "qa_case_answered");

    private final SiteNotificationMapper siteNotificationMapper;
    
    @Override
    public Map<String, Object> getUserNotifications(Long userId, String type, Integer page, Integer limit) {
        QueryWrapper<Notification> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId);
        
        if (type != null && !type.isEmpty()) {
            List<String> types = Arrays.stream(type.split(","))
                    .map(String::trim)
                    .filter(CURRENT_NOTIFICATION_TYPES::contains)
                    .toList();
            if (types.isEmpty()) {
                queryWrapper.eq("type", "__offline_legacy_notification__");
            } else if (types.size() == 1) {
                queryWrapper.eq("type", types.get(0));
            } else {
                queryWrapper.in("type", types);
            }
        } else {
            queryWrapper.in("type", CURRENT_NOTIFICATION_TYPES);
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
                    .eq("user_id", userId)
                    .in("type", CURRENT_NOTIFICATION_TYPES);
        update(updateWrapper);
    }

    @Override
    public void markAllAsRead(Long userId) {
        UpdateWrapper<Notification> updateWrapper = new UpdateWrapper<>();
        updateWrapper.set("is_read", 1)
                    .eq("user_id", userId)
                    .eq("is_read", 0)
                    .in("type", CURRENT_NOTIFICATION_TYPES);
        update(updateWrapper);
    }

    @Override
    public void createNotification(Long userId, String type, String content, Long relatedId) {
        if (userId == null || type == null || type.isBlank()) {
            return;
        }
        String normalizedType = type.trim();
        if (!CURRENT_NOTIFICATION_TYPES.contains(normalizedType)) {
            return;
        }

        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(normalizedType);
        notification.setContent(content);
        notification.setRelatedId(relatedId);
        notification.setIsRead(0);
        save(notification);
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
        queryWrapper.eq("id", notificationId)
                .eq("user_id", userId)
                .in("type", CURRENT_NOTIFICATION_TYPES);
        remove(queryWrapper);
    }

    @Override
    public void deleteBatch(Long userId, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return;
        QueryWrapper<Notification> queryWrapper = new QueryWrapper<>();
        queryWrapper.in("id", ids)
                .eq("user_id", userId)
                .in("type", CURRENT_NOTIFICATION_TYPES);
        remove(queryWrapper);
    }

    @Override
    public Map<String, Object> getCountsByType(Long userId) {
        long all = count(new QueryWrapper<Notification>().eq("user_id", userId).in("type", CURRENT_NOTIFICATION_TYPES));
        long points = count(new QueryWrapper<Notification>().eq("user_id", userId).eq("type", "system"));
        long announcements = count(new QueryWrapper<Notification>().eq("user_id", userId).eq("type", "site_notification"));
        long qa = count(new QueryWrapper<Notification>().eq("user_id", userId).eq("type", "qa_case_answered"));

        Map<String, Object> result = new HashMap<>();
        result.put("all", all);
        result.put("system", points);
        result.put("points", points);
        result.put("announcements", announcements);
        result.put("qa", qa);
        return result;
    }
}
