package com.excel.forum.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.excel.forum.entity.Notification;

import java.util.List;
import java.util.Map;

public interface NotificationService extends IService<Notification> {
    Map<String, Object> getUserNotifications(Long userId, String type, Integer page, Integer limit);
    void markAsRead(Long userId, Long notificationId);
    void markAllAsRead(Long userId);
    void createNotification(Long userId, String type, String content, Long relatedId);
    void deleteNotification(Long userId, Long notificationId);
    void deleteBatch(Long userId, List<Long> ids);
    Map<String, Object> getCountsByType(Long userId);
}
