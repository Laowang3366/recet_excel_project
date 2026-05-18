package com.excel.forum.controller;

import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.service.SiteNotificationService;
import com.excel.forum.util.HtmlSanitizer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class RequestParsingErrorTest {

    @Mock
    private SiteNotificationService siteNotificationService;
    @Mock
    private HtmlSanitizer htmlSanitizer;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AdminNotificationController notificationController = new AdminNotificationController(siteNotificationService, htmlSanitizer);
        mockMvc = MockMvcBuilders.standaloneSetup(notificationController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void malformedAdminNotificationJsonReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/admin/notifications")
                        .requestAttr("userId", 3L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"broken\","))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("请求体格式错误"));
    }
}
