package com.excel.forum.controller;

import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.entity.SiteNotification;
import com.excel.forum.service.SiteNotificationService;
import com.excel.forum.util.HtmlSanitizer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminNotificationControllerTest {

    @Mock
    private SiteNotificationService siteNotificationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new AdminNotificationController(siteNotificationService, new HtmlSanitizer()))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void createScheduledNotificationDoesNotSendImmediately() throws Exception {
        when(siteNotificationService.save(any(SiteNotification.class))).thenReturn(true);

        mockMvc.perform(post("/api/admin/notifications")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title":"定时通知",
                                  "content":"稍后发送",
                                  "type":"system",
                                  "status":"scheduled",
                                  "targetType":"all",
                                  "scheduledTime":"2026-05-27T10:00:00",
                                  "pinned":true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("scheduled"))
                .andExpect(jsonPath("$.pinned").value(true));

        ArgumentCaptor<SiteNotification> captor = ArgumentCaptor.forClass(SiteNotification.class);
        verify(siteNotificationService).save(captor.capture());
        SiteNotification notification = captor.getValue();
        assertThat(notification.getScheduledTime()).isEqualTo(LocalDateTime.parse("2026-05-27T10:00:00"));
        assertThat(notification.getPinned()).isTrue();
        assertThat(notification.getPinnedUntil()).isNotNull();
        verify(siteNotificationService, never()).sendNotification(anyLong());
    }

    @Test
    void createUserTargetNotificationStoresTargetUserIds() throws Exception {
        when(siteNotificationService.save(any(SiteNotification.class))).thenReturn(true);

        mockMvc.perform(post("/api/admin/notifications")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title":"指定用户通知",
                                  "content":"只给两个人",
                                  "type":"announcement",
                                  "status":"draft",
                                  "targetType":"user",
                                  "targetUserIds":[3,5],
                                  "targetRoles":"admin"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetType").value("user"))
                .andExpect(jsonPath("$.targetUserIds").value("3,5"))
                .andExpect(jsonPath("$.targetRoles").doesNotExist());

        ArgumentCaptor<SiteNotification> captor = ArgumentCaptor.forClass(SiteNotification.class);
        verify(siteNotificationService).save(captor.capture());
        assertThat(captor.getValue().getTargetUserIds()).isEqualTo("3,5");
        assertThat(captor.getValue().getTargetRoles()).isNull();
    }
}
