package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.excel.forum.entity.Notification;
import com.excel.forum.mapper.NotificationMapper;
import com.excel.forum.mapper.SiteNotificationMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplMutationTest {

    @Mock
    private NotificationMapper notificationMapper;
    @Mock
    private SiteNotificationMapper siteNotificationMapper;

    private NotificationServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new NotificationServiceImpl(siteNotificationMapper);
        ReflectionTestUtils.setField(service, "baseMapper", notificationMapper);
    }

    @Test
    void markAllAsReadOnlyTouchesCurrentNotificationTypes() {
        when(notificationMapper.update(isNull(), any(UpdateWrapper.class))).thenReturn(1);

        service.markAllAsRead(7L);

        ArgumentCaptor<UpdateWrapper<Notification>> wrapperCaptor = ArgumentCaptor.forClass(UpdateWrapper.class);
        verify(notificationMapper).update(isNull(), wrapperCaptor.capture());
        assertThat(wrapperCaptor.getValue().getSqlSegment()).contains("type");
    }

    @Test
    void deleteNotificationOnlyTouchesCurrentNotificationTypes() {
        when(notificationMapper.delete(any(QueryWrapper.class))).thenReturn(1);

        service.deleteNotification(7L, 12L);

        ArgumentCaptor<QueryWrapper<Notification>> wrapperCaptor = ArgumentCaptor.forClass(QueryWrapper.class);
        verify(notificationMapper).delete(wrapperCaptor.capture());
        assertThat(wrapperCaptor.getValue().getSqlSegment()).contains("type");
    }

    @Test
    void deleteBatchOnlyTouchesCurrentNotificationTypes() {
        when(notificationMapper.delete(any(QueryWrapper.class))).thenReturn(1);

        service.deleteBatch(7L, List.of(12L, 13L));

        ArgumentCaptor<QueryWrapper<Notification>> wrapperCaptor = ArgumentCaptor.forClass(QueryWrapper.class);
        verify(notificationMapper).delete(wrapperCaptor.capture());
        assertThat(wrapperCaptor.getValue().getSqlSegment()).contains("type");
    }

    @Test
    void createNotificationAllowsQaCaseAnswered() {
        when(notificationMapper.insert(any(Notification.class))).thenReturn(1);

        service.createNotification(7L, "qa_case_answered", "有人提交了答疑", 30L);

        verify(notificationMapper).insert(argThat(notification ->
                notification.getUserId().equals(7L)
                        && "qa_case_answered".equals(notification.getType())
                        && notification.getRelatedId().equals(30L)
        ));
    }

    @Test
    void getCountsByTypeKeepsSystemAndQaCountsSeparate() {
        when(notificationMapper.selectCount(any(QueryWrapper.class)))
                .thenReturn(4L, 2L, 1L, 1L);

        assertThat(service.getCountsByType(7L))
                .containsEntry("all", 4L)
                .containsEntry("system", 2L)
                .containsEntry("points", 2L)
                .containsEntry("announcements", 1L)
                .containsEntry("qa", 1L);
    }
}
