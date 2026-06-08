package com.excel.forum.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.entity.SiteNotification;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.SiteNotificationService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class NotificationControllerTest {

    @Mock
    private NotificationService notificationService;
    @Mock
    private SiteNotificationService siteNotificationService;
    @Mock
    private UserService userService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new NotificationController(notificationService, siteNotificationService, userService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void deleteBatchRejectsNonNumericIds() throws Exception {
        mockMvc.perform(delete("/api/notifications/batch")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids":["abc"]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("通知ID格式不正确"));

        verify(notificationService, never()).deleteBatch(anyLong(), anyList());
    }

    @Test
    void deleteBatchRejectsNonPositiveIds() throws Exception {
        mockMvc.perform(delete("/api/notifications/batch")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids":[1,0]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("通知ID格式不正确"));

        verify(notificationService, never()).deleteBatch(anyLong(), anyList());
    }

    @Test
    void deleteBatchRejectsDecimalIds() throws Exception {
        mockMvc.perform(delete("/api/notifications/batch")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids":[1.5]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("通知ID格式不正确"));

        verify(notificationService, never()).deleteBatch(anyLong(), anyList());
    }

    @Test
    void deleteBatchAcceptsNumericAndStringIds() throws Exception {
        mockMvc.perform(delete("/api/notifications/batch")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids":[1,"2"]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("删除成功"));

        verify(notificationService).deleteBatch(eq(7L), eq(java.util.List.of(1L, 2L)));
    }

    @Test
    void deleteBatchSkipsMissingIdsAsNoop() throws Exception {
        mockMvc.perform(delete("/api/notifications/batch")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("删除成功"));

        verify(notificationService, never()).deleteBatch(anyLong(), anyList());
    }

    @Test
    void deleteBatchRejectsTooManyIds() throws Exception {
        String ids = java.util.stream.LongStream.rangeClosed(1, 101)
                .mapToObj(Long::toString)
                .collect(java.util.stream.Collectors.joining(","));

        mockMvc.perform(delete("/api/notifications/batch")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[" + ids + "]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("批量删除最多支持 100 条"));

        verify(notificationService, never()).deleteBatch(anyLong(), anyList());
    }

    @Test
    void getNotificationsClampsInvalidPagination() throws Exception {
        mockMvc.perform(get("/api/notifications")
                        .requestAttr("userId", 7L)
                        .param("page", "-5")
                        .param("limit", "10000"))
                .andExpect(status().isOk());

        verify(notificationService).getUserNotifications(7L, null, 1, 50);
    }

    @Test
    void getAnnouncementsClampsPublicPagination() throws Exception {
        when(siteNotificationService.page(
                org.mockito.ArgumentMatchers.<Page<SiteNotification>>any(),
                org.mockito.ArgumentMatchers.any()
        )).thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(get("/api/notifications/announcements")
                        .param("page", "-3")
                        .param("size", "10000"))
                .andExpect(status().isOk());

        verify(siteNotificationService).page(
                argThat(page -> page.getCurrent() == 1L && page.getSize() == 50L),
                org.mockito.ArgumentMatchers.any()
        );
    }
}
