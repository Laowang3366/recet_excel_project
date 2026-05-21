package com.excel.forum.config;

import com.excel.forum.security.JwtAuthenticationFilter;
import com.excel.forum.mapper.AdminAuditLogMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SecurityConfigAccessTest.AdminProbeController.class)
@Import({SecurityConfig.class, FileStorageConfig.class, SecurityConfigAccessTest.AdminProbeController.class})
class SecurityConfigAccessTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    private AdminAuditLogMapper adminAuditLogMapper;

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    @Test
    @WithMockUser(roles = "USER")
    void regularUserCannotAccessAdminApi() throws Exception {
        mockMvc.perform(get("/api/admin/probe"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanAccessAdminApi() throws Exception {
        mockMvc.perform(get("/api/admin/probe"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void privateUploadsCannotBeServedByDirectStaticUrl() throws Exception {
        mockMvc.perform(get("/uploads/private/probe.xlsx"))
                .andExpect(status().isForbidden());
    }

    @RestController
    public static class AdminProbeController {
        @GetMapping("/api/admin/probe")
        String probe() {
            return "ok";
        }
    }
}
