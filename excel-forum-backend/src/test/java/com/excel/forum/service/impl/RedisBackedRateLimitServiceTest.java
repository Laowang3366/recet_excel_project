package com.excel.forum.service.impl;

import com.excel.forum.service.RateLimitResult;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class RedisBackedRateLimitServiceTest {

    @Test
    void localFallbackRejectsRequestsAboveWindowLimit() {
        RedisBackedRateLimitService service = new RedisBackedRateLimitService(null);

        RateLimitResult first = service.check("practice:submit:user:7", 2, Duration.ofMinutes(1), "操作过于频繁");
        RateLimitResult second = service.check("practice:submit:user:7", 2, Duration.ofMinutes(1), "操作过于频繁");
        RateLimitResult third = service.check("practice:submit:user:7", 2, Duration.ofMinutes(1), "操作过于频繁");

        assertThat(first.allowed()).isTrue();
        assertThat(second.allowed()).isTrue();
        assertThat(third.allowed()).isFalse();
        assertThat(third.message()).isEqualTo("操作过于频繁");
        assertThat(third.retryAfterSeconds()).isPositive();
    }
}
