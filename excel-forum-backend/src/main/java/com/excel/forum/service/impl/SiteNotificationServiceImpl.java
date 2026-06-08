package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.SiteNotification;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.SiteNotificationMapper;
import com.excel.forum.service.SiteNotificationService;
import com.excel.forum.service.UserService;
import com.excel.forum.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SiteNotificationServiceImpl extends ServiceImpl<SiteNotificationMapper, SiteNotification> implements SiteNotificationService {
    private static final int MAX_PAGE_SIZE = 50;
    
    private final UserService userService;
    private final NotificationService notificationService;

    @Override
    public Map<String, Object> getNotificationsPage(int page, int size) {
        Page<SiteNotification> pageParam = new Page<>(safePage(page), safePageSize(size));
        QueryWrapper<SiteNotification> queryWrapper = new QueryWrapper<>();
        queryWrapper.orderByDesc("pinned").orderByDesc("create_time");
        
        Page<SiteNotification> result = page(pageParam, queryWrapper);
        
        Map<String, Object> response = new HashMap<>();
        response.put("records", result.getRecords());
        response.put("total", result.getTotal());
        return response;
    }

    private int safePage(int page) {
        return page < 1 ? 1 : page;
    }

    private int safePageSize(int size) {
        return size < 1 ? 10 : Math.min(size, MAX_PAGE_SIZE);
    }

    @Override
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        
        stats.put("total", count());
        
        QueryWrapper<SiteNotification> sentWrapper = new QueryWrapper<>();
        sentWrapper.eq("status", "sent");
        stats.put("sent", count(sentWrapper));
        
        QueryWrapper<SiteNotification> draftWrapper = new QueryWrapper<>();
        draftWrapper.eq("status", "draft");
        stats.put("draft", count(draftWrapper));

        QueryWrapper<SiteNotification> scheduledWrapper = new QueryWrapper<>();
        scheduledWrapper.eq("status", "scheduled");
        stats.put("scheduled", count(scheduledWrapper));
        
        QueryWrapper<User> userWrapper = new QueryWrapper<>();
        userWrapper.eq("status", 0);
        stats.put("totalUsers", userService.count(userWrapper));
        
        return stats;
    }

    @Override
    public void sendNotification(Long id) {
        SiteNotification notification = getById(id);
        if (notification == null) return;
        if ("sent".equals(notification.getStatus())
                && notification.getSendTime() != null
                && notification.getTotalCount() != null
                && notification.getTotalCount() > 0) {
            return;
        }
        
        notification.setStatus("sent");
        notification.setSendTime(LocalDateTime.now());
        notification.setScheduledTime(null);
        
        QueryWrapper<User> userWrapper = new QueryWrapper<>();
        userWrapper.eq("status", 0);
        
        if ("role".equals(notification.getTargetType()) && notification.getTargetRoles() != null) {
            userWrapper.in("role", (Object[]) notification.getTargetRoles().split(","));
        } else if ("user".equals(notification.getTargetType())) {
            List<Long> targetUserIds = parseTargetUserIds(notification.getTargetUserIds());
            if (targetUserIds.isEmpty()) {
                userWrapper.eq("id", -1L);
            } else {
                userWrapper.in("id", targetUserIds);
            }
        }
        
        List<User> users = userService.list(userWrapper);
        notification.setTotalCount(users.size());
        
        updateById(notification);
        
        for (User user : users) {
            notificationService.createNotification(
                user.getId(),
                "site_notification",
                notification.getTitle(),
                notification.getId()
            );
        }
    }

    @Override
    public int sendDueScheduledNotifications(LocalDateTime now) {
        QueryWrapper<SiteNotification> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("status", "scheduled")
                .isNotNull("scheduled_time")
                .le("scheduled_time", now);

        List<SiteNotification> dueNotifications = list(queryWrapper);
        for (SiteNotification notification : dueNotifications) {
            sendNotification(notification.getId());
        }
        return dueNotifications.size();
    }

    @Override
    public int expirePinnedNotifications(LocalDateTime now) {
        UpdateWrapper<SiteNotification> updateWrapper = new UpdateWrapper<>();
        updateWrapper.eq("pinned", true)
                .isNotNull("pinned_until")
                .le("pinned_until", now)
                .set("pinned", false)
                .set("pinned_until", null);
        return baseMapper.update(null, updateWrapper);
    }

    @Override
    public void incrementReadCount(Long siteNotificationId) {
        SiteNotification sn = getById(siteNotificationId);
        if (sn != null) {
            sn.setReadCount(sn.getReadCount() == null ? 1 : sn.getReadCount() + 1);
            updateById(sn);
        }
    }

    private List<Long> parseTargetUserIds(String rawIds) {
        if (rawIds == null || rawIds.isBlank()) {
            return List.of();
        }
        return Arrays.stream(rawIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> {
                    try {
                        return Long.parseLong(value);
                    } catch (NumberFormatException invalidUserId) {
                        // Keep malformed target ids from blocking delivery to the remaining valid users.
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }
}
