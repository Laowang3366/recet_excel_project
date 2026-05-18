package com.excel.forum.controller;

import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.entity.User;
import com.excel.forum.service.UserService;
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
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
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
    private StringRedisTemplate redisTemplate;

    @Captor
    private ArgumentCaptor<User> userCaptor;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AuthController controller = new AuthController(userService, passwordEncoder, jwtUtil, redisTemplate);
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
                .andExpect(content().json("\"密码必须至少8位，且只能包含字母和数字\""));

        verify(userService, never()).save(any(User.class));
    }

    @Test
    void registerTrimsUsernameAndEmailBeforeSave() throws Exception {
        when(passwordEncoder.encode("Abc12345")).thenReturn("encoded-password");
        when(userService.findByUsername("tester")).thenReturn(null);
        when(userService.findByEmail("user@example.com")).thenReturn(null);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"  tester  ","email":"  user@example.com  ","password":"Abc12345"}
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
    void currentUserWithoutLoginReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/current"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("未登录"));
    }
}
