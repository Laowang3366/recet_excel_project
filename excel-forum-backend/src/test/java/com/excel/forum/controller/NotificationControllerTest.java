package com.excel.forum.controller;

import com.excel.forum.config.GlobalExceptionHandler;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
}
