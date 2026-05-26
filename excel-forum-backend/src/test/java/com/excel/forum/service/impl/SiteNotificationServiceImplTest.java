package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.SiteNotification;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.SiteNotificationMapper;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SiteNotificationServiceImplTest {

    @Mock
    private SiteNotificationMapper siteNotificationMapper;
    @Mock
    private UserService userService;
    @Mock
    private NotificationService notificationService;

    private SiteNotificationServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new SiteNotificationServiceImpl(userService, notificationService);
        ReflectionTestUtils.setField(service, "baseMapper", siteNotificationMapper);
    }

    @Test
    void sendNotificationTargetsSpecificUsersOnly() {
        SiteNotification notification = notification(9L, "draft");
        notification.setTargetType("user");
        notification.setTargetUserIds("3,5");
        User first = user(3L);
        User second = user(5L);

        when(siteNotificationMapper.selectById(9L)).thenReturn(notification);
        when(userService.list(any(QueryWrapper.class))).thenReturn(List.of(first, second));
        when(siteNotificationMapper.updateById(any(SiteNotification.class))).thenReturn(1);

        service.sendNotification(9L);

        ArgumentCaptor<QueryWrapper<User>> wrapperCaptor = ArgumentCaptor.forClass(QueryWrapper.class);
        verify(userService).list(wrapperCaptor.capture());
        assertThat(wrapperCaptor.getValue().getSqlSegment()).contains("id");
        verify(notificationService).createNotification(3L, "site_notification", "通知标题", 9L);
        verify(notificationService).createNotification(5L, "site_notification", "通知标题", 9L);

        ArgumentCaptor<SiteNotification> notificationCaptor = ArgumentCaptor.forClass(SiteNotification.class);
        verify(siteNotificationMapper).updateById(notificationCaptor.capture());
        assertThat(notificationCaptor.getValue().getStatus()).isEqualTo("sent");
        assertThat(notificationCaptor.getValue().getTotalCount()).isEqualTo(2);
    }

    @Test
    void sendNotificationDoesNotDuplicateAlreadySentNotification() {
        SiteNotification notification = notification(9L, "sent");
        notification.setSendTime(LocalDateTime.now().minusMinutes(10));
        notification.setTotalCount(2);

        when(siteNotificationMapper.selectById(9L)).thenReturn(notification);

        service.sendNotification(9L);

        verify(userService, never()).list(any(QueryWrapper.class));
        verify(notificationService, never()).createNotification(any(), any(), any(), any());
        verify(siteNotificationMapper, never()).updateById(any(SiteNotification.class));
    }

    @Test
    void sendDueScheduledNotificationsSendsOnlyDueRecords() {
        LocalDateTime now = LocalDateTime.parse("2026-05-26T12:00:00");
        SiteNotification due = notification(11L, "scheduled");
        due.setTargetType("all");
        due.setScheduledTime(now.minusMinutes(1));
        User user = user(8L);

        when(siteNotificationMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(due));
        when(siteNotificationMapper.selectById(11L)).thenReturn(due);
        when(userService.list(any(QueryWrapper.class))).thenReturn(List.of(user));
        when(siteNotificationMapper.updateById(any(SiteNotification.class))).thenReturn(1);

        int sent = service.sendDueScheduledNotifications(now);

        assertThat(sent).isEqualTo(1);
        verify(notificationService).createNotification(8L, "site_notification", "通知标题", 11L);
    }

    private static SiteNotification notification(Long id, String status) {
        SiteNotification notification = new SiteNotification();
        notification.setId(id);
        notification.setTitle("通知标题");
        notification.setContent("通知内容");
        notification.setStatus(status);
        notification.setTargetType("all");
        return notification;
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setStatus(0);
        return user;
    }
}
