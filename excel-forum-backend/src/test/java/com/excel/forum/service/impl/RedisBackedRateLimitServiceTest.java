package com.excel.forum.service.impl;

import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.SecurityAbuseMonitor;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class RedisBackedRateLimitServiceTest {

    @Test
    void localFallbackRejectsRequestsAboveWindowLimit() {
        SecurityAbuseMonitor monitor = mock(SecurityAbuseMonitor.class);
        RedisBackedRateLimitService service = new RedisBackedRateLimitService(null, monitor);

        RateLimitResult first = service.check("practice:submit:user:7", 2, Duration.ofMinutes(1), "操作过于频繁");
        RateLimitResult second = service.check("practice:submit:user:7", 2, Duration.ofMinutes(1), "操作过于频繁");
        RateLimitResult third = service.check("practice:submit:user:7", 2, Duration.ofMinutes(1), "操作过于频繁");

        assertThat(first.allowed()).isTrue();
        assertThat(second.allowed()).isTrue();
        assertThat(third.allowed()).isFalse();
        assertThat(third.message()).isEqualTo("操作过于频繁");
        assertThat(third.retryAfterSeconds()).isPositive();
        verify(monitor).recordRateLimit(
                eq("practice:submit:user:7"),
                eq(2),
                eq(Duration.ofMinutes(1)),
                eq(third.retryAfterSeconds())
        );
    }
}
