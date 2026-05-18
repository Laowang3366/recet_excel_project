package com.excel.forum.controller;

import com.excel.forum.entity.dto.AssistantChatRequest;
import com.excel.forum.service.AssistantService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/assistant")
@RequiredArgsConstructor
@Slf4j
public class AssistantController {
    private static final ConcurrentHashMap<String, LocalRateLimitState> LOCAL_RATE_LIMITS = new ConcurrentHashMap<>();
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.BASIC_ISO_DATE;

    private final AssistantService assistantService;
    private final StringRedisTemplate redisTemplate;

    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody AssistantChatRequest request, HttpServletRequest servletRequest) {
        Long userId = (Long) servletRequest.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "未登录"));
        }
        ResponseEntity<?> minuteLimit = guardRateLimit("assistant:chat:10m:" + userId, 10, 600, "AI 助手调用过于频繁，请 10 分钟后再试");
        if (minuteLimit != null) {
            return minuteLimit;
        }
        ResponseEntity<?> dailyLimit = guardRateLimit("assistant:chat:day:" + userId + ":" + LocalDate.now().format(DAY_FMT), 50, 86400, "今日 AI 助手额度已用完，请明天再来");
        if (dailyLimit != null) {
            return dailyLimit;
        }
        return ResponseEntity.ok(assistantService.chat(userId, request));
    }

    private ResponseEntity<?> guardRateLimit(String key, int maxRequests, int ttlSeconds, String limitedMessage) {
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1) {
                redisTemplate.expire(key, ttlSeconds, TimeUnit.SECONDS);
            }
            if (count != null && count > maxRequests) {
                return ResponseEntity.status(429).body(Map.of("message", limitedMessage));
            }
            return null;
        } catch (RedisConnectionFailureException exception) {
            log.debug("Redis rate limit unavailable, falling back to local limiter for key {}", key, exception);
            long now = System.currentTimeMillis();
            LocalRateLimitState state = LOCAL_RATE_LIMITS.compute(key, (currentKey, currentState) -> {
                if (currentState == null || currentState.expireAtMillis <= now) {
                    return new LocalRateLimitState(1, now + ttlSeconds * 1000L);
                }
                currentState.count += 1;
                return currentState;
            });
            cleanupExpiredLocalRateLimits(now);
            if (state != null && state.count > maxRequests) {
                return ResponseEntity.status(429).body(Map.of("message", limitedMessage));
            }
            return null;
        }
    }

    private void cleanupExpiredLocalRateLimits(long now) {
        LOCAL_RATE_LIMITS.entrySet().removeIf(entry -> entry.getValue().expireAtMillis <= now);
    }

    private static final class LocalRateLimitState {
        private int count;
        private long expireAtMillis;

        private LocalRateLimitState(int count, long expireAtMillis) {
            this.count = count;
            this.expireAtMillis = expireAtMillis;
        }
    }
}
