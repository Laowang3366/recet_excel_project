package com.excel.forum.controller;

import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.entity.User;
import com.excel.forum.service.CheckinService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.UserEntitlementService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    @Mock
    private ExperienceService experienceService;

    @Mock
    private UserEntitlementService userEntitlementService;

    @Mock
    private CheckinService checkinService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        UserController controller = new UserController(
                userService,
                experienceService,
                userEntitlementService,
                checkinService
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void updateProfileRejectsOtherUser() throws Exception {
        mockMvc.perform(put("/api/users/7")
                        .requestAttr("userId", 5L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bio\":\"changed\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("只能修改自己的资料"));
    }

    @Test
    void centerOverviewReturnsCurrentProfileDataOnly() throws Exception {
        User user = new User();
        user.setId(5L);
        user.setUsername("learner");
        user.setRole("user");
        user.setStatus(0);
        user.setExp(42);
        user.setPublicProfile(true);
        user.setShowOnlineStatus(false);

        when(userService.getById(5L)).thenReturn(user);
        when(experienceService.getProgress(42)).thenReturn(Map.of("level", 2, "remainingExp", 58));

        mockMvc.perform(get("/api/users/center/overview")
                        .requestAttr("userId", 5L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("learner"))
                .andExpect(jsonPath("$.privacy.publicProfile").value(true))
                .andExpect(jsonPath("$.privacy.showOnlineStatus").value(false))
                .andExpect(jsonPath("$.expProgress.level").value(2));

        verify(experienceService).getProgress(42);
    }
}
