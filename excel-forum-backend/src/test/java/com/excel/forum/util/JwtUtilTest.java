package com.excel.forum.util;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtUtilTest {
    private StringRedisTemplate redisTemplate;
    private ValueOperations<String, String> valueOperations;
    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
        valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        jwtUtil = new JwtUtil(redisTemplate);
        ReflectionTestUtils.setField(jwtUtil, "secret", "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789--jwt-secret");
        ReflectionTestUtils.setField(jwtUtil, "expiration", 86_400_000L);
        jwtUtil.validateSecret();
    }

    @Test
    void blacklistKeyDoesNotStoreRawJwt() {
        String token = jwtUtil.generateToken(7L, "tester", "user", 0);

        jwtUtil.invalidateToken(token);

        org.mockito.ArgumentCaptor<String> keyCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(valueOperations).set(keyCaptor.capture(), eq("1"), anyLong(), eq(TimeUnit.MILLISECONDS));
        assertThat(keyCaptor.getValue()).startsWith("jwt:blacklist:sha256:");
        assertThat(keyCaptor.getValue()).doesNotContain(token);
    }

    @Test
    void redisFailureWhileCheckingBlacklistInvalidatesToken() {
        String token = jwtUtil.generateToken(7L, "tester", "user", 0);
        when(redisTemplate.hasKey(anyString())).thenThrow(new RedisConnectionFailureException("redis down"));

        assertThat(jwtUtil.validateToken(token)).isFalse();
        Claims claims = jwtUtil.parseToken(token);
        assertThat(claims.getSubject()).isEqualTo("7");
    }
}
