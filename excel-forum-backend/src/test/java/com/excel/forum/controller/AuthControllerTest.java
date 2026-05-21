package com.excel.forum.controller;

import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.entity.User;
import com.excel.forum.service.UserService;
import com.excel.forum.service.PasswordResetTokenService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import com.excel.forum.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserService userService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private RateLimitService rateLimitService;

    @Mock
    private PasswordResetTokenService passwordResetTokenService;

    @Captor
    private ArgumentCaptor<User> userCaptor;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AuthController controller = new AuthController(userService, passwordEncoder, jwtUtil, rateLimitService, passwordResetTokenService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setMessageConverters(
                        new MappingJackson2HttpMessageConverter(),
                        new StringHttpMessageConverter(StandardCharsets.UTF_8)
                )
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void registerRejectsEmptyUsername() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"","email":"user@example.com","password":"123456"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().json("\"用户名不能为空\""));

        verify(userService, never()).save(any(User.class));
    }

    @Test
    void loginReturnsTooManyRequestsWhenRateLimited() throws Exception {
        when(rateLimitService.check(argThat(key -> key != null
                        && key.startsWith("auth:login:id-ip:tester:")
                        && key.contains("203.0.113.7")), any(Integer.class), any(), any()))
                .thenReturn(RateLimitResult.limited("登录过于频繁，请稍后再试", 45));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", "203.0.113.7")
                        .content("""
                                {"username":"tester","password":"Abc12345"}
                                """))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("登录过于频繁，请稍后再试"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(45));

        verify(userService, never()).findByUsername(any());
    }

    @Test
    void registerReturnsTooManyRequestsWhenIpIsLimited() throws Exception {
        when(rateLimitService.check(eq("auth:register:ip:198.51.100.9"), any(Integer.class), any(), any()))
                .thenReturn(RateLimitResult.limited("注册过于频繁，请稍后再试", 120));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Real-IP", "198.51.100.9")
                        .content("""
                                {"username":"tester","email":"user@example.com","password":"Abc12345!"}
                                """))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("注册过于频繁，请稍后再试"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(120));

        verify(userService, never()).save(any(User.class));
    }

    @Test
    void registerRejectsInvalidEmail() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"tester","email":"bad-mail","password":"123456"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().json("\"邮箱格式不正确\""));

        verify(userService, never()).save(any(User.class));
    }

    @Test
    void registerRejectsShortPassword() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"tester","email":"user@example.com","password":"123"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().json("\"密码需为 8-64 位，包含大小写字母、数字和特殊字符\""));

        verify(userService, never()).save(any(User.class));
    }

    @Test
    void registerRejectsPasswordWithoutSymbol() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"tester","email":"user@example.com","password":"Abc12345"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().json("\"密码需为 8-64 位，包含大小写字母、数字和特殊字符\""));

        verify(userService, never()).save(any(User.class));
    }

    @Test
    void registerTrimsUsernameAndEmailBeforeSave() throws Exception {
        when(passwordEncoder.encode("Abc12345!")).thenReturn("encoded-password");
        when(userService.findByUsername("tester")).thenReturn(null);
        when(userService.findByEmail("user@example.com")).thenReturn(null);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"  tester  ","email":"  user@example.com  ","password":"Abc12345!"}
                                """))
                .andExpect(status().isOk())
                .andExpect(content().json("\"注册成功\""));

        verify(userService).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertThat(savedUser.getUsername()).isEqualTo("tester");
        assertThat(savedUser.getEmail()).isEqualTo("user@example.com");
        assertThat(savedUser.getPassword()).isEqualTo("encoded-password");
    }

    @Test
    void forgotPasswordDoesNotResetPasswordDirectly() throws Exception {
        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", "203.0.113.5")
                        .content("""
                                {"username":"tester","email":"user@example.com","newPassword":"NewPass123!"}
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value("如果账号信息匹配，系统会发送密码重置指引"))
                .andExpect(content().string(not(containsString("token"))));

        verify(passwordEncoder, never()).encode(any());
        verify(userService, never()).updateById(any(User.class));
        verify(passwordResetTokenService).issueResetToken("tester", "user@example.com", "203.0.113.5");
    }

    @Test
    void resetPasswordConsumesSingleUseTokenAndInvalidatesExistingSessions() throws Exception {
        User user = new User();
        user.setId(11L);
        user.setTokenVersion(3);
        when(passwordResetTokenService.consumeToken("valid-token")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPass123!")).thenReturn("encoded-new-password");

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"valid-token","newPassword":"NewPass123!"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("密码已重置，请重新登录"));

        verify(passwordResetTokenService).consumeToken("valid-token");
        verify(userService).updateById(userCaptor.capture());
        User updated = userCaptor.getValue();
        assertThat(updated.getPassword()).isEqualTo("encoded-new-password");
        assertThat(updated.getTokenVersion()).isEqualTo(4);
    }

    @Test
    void resetPasswordRejectsInvalidOrExpiredToken() throws Exception {
        when(passwordResetTokenService.consumeToken("expired-token")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"expired-token","newPassword":"NewPass123!"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("重置链接无效或已过期"));

        verify(userService, never()).updateById(any(User.class));
    }

    @Test
    void currentUserWithoutLoginReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/current"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("未登录"));
    }
}
