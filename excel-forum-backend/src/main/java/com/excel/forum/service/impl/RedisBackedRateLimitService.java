package com.excel.forum.service.impl;

import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import com.excel.forum.service.SecurityAbuseMonitor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisBackedRateLimitService implements RateLimitService {
    private static final int MAX_LOCAL_KEYS = 10_000;

    private final StringRedisTemplate redisTemplate;
    private final SecurityAbuseMonitor securityAbuseMonitor;
    private final Map<String, LocalWindow> localWindows = new ConcurrentHashMap<>();

    @Override
    public RateLimitResult check(String key, int maxRequests, Duration window, String limitedMessage) {
        if (key == null || key.isBlank() || maxRequests <= 0 || window == null || window.isZero() || window.isNegative()) {
            return RateLimitResult.allow();
        }
        String normalizedKey = key.trim();
        long ttlSeconds = Math.max(1, window.toSeconds());
        if (redisTemplate != null) {
            try {
                Long count = redisTemplate.opsForValue().increment(normalizedKey);
                if (count != null && count == 1L) {
                    redisTemplate.expire(normalizedKey, ttlSeconds, TimeUnit.SECONDS);
                }
                if (count != null && count > maxRequests) {
                    Long ttl = redisTemplate.getExpire(normalizedKey, TimeUnit.SECONDS);
                    long retryAfter = ttl == null || ttl <= 0 ? ttlSeconds : ttl;
                    securityAbuseMonitor.recordRateLimit(normalizedKey, maxRequests, window, retryAfter);
                    return RateLimitResult.limited(limitedMessage, retryAfter);
                }
                return RateLimitResult.allow();
            } catch (RuntimeException exception) {
                log.warn("Redis rate limit unavailable, falling back to local window: key={}", normalizedKey, exception);
            }
        }
        return checkLocal(normalizedKey, maxRequests, window, limitedMessage);
    }

    private RateLimitResult checkLocal(String key, int maxRequests, Duration window, String limitedMessage) {
        long now = System.currentTimeMillis();
        long windowMillis = Math.max(1_000L, window.toMillis());
        if (localWindows.size() > MAX_LOCAL_KEYS) {
            cleanupExpired(now);
        }
        LocalWindow state = localWindows.compute(key, (ignored, current) -> {
            if (current == null || current.expiresAtMillis <= now) {
                return new LocalWindow(1, now + windowMillis);
            }
            current.count += 1;
            return current;
        });
        if (state.count > maxRequests) {
            long retryAfter = Math.max(1, (state.expiresAtMillis - now + 999) / 1000);
            securityAbuseMonitor.recordRateLimit(key, maxRequests, window, retryAfter);
            return RateLimitResult.limited(limitedMessage, retryAfter);
        }
        return RateLimitResult.allow();
    }

    private void cleanupExpired(long now) {
        localWindows.entrySet().removeIf(entry -> entry.getValue().expiresAtMillis <= now);
    }

    private static final class LocalWindow {
        private int count;
        private final long expiresAtMillis;

        private LocalWindow(int count, long expiresAtMillis) {
            this.count = count;
            this.expiresAtMillis = expiresAtMillis;
        }
    }
}
