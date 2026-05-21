package com.excel.forum.controller;

import com.excel.forum.entity.dto.AssistantChatRequest;
import com.excel.forum.service.AssistantService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/assistant")
@RequiredArgsConstructor
public class AssistantController {
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.BASIC_ISO_DATE;

    private final AssistantService assistantService;
    private final RateLimitService rateLimitService;

    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody AssistantChatRequest request, HttpServletRequest servletRequest) {
        Long userId = (Long) servletRequest.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "未登录"));
        }
        ResponseEntity<?> minuteLimit = toLimitResponse(rateLimitService.check(
                "assistant:chat:10m:" + userId,
                10,
                Duration.ofMinutes(10),
                "AI 助手调用过于频繁，请 10 分钟后再试"
        ));
        if (minuteLimit != null) {
            return minuteLimit;
        }
        ResponseEntity<?> dailyLimit = toLimitResponse(rateLimitService.check(
                "assistant:chat:day:" + userId + ":" + LocalDate.now().format(DAY_FMT),
                50,
                Duration.ofDays(1),
                "今日 AI 助手额度已用完，请明天再来"
        ));
        if (dailyLimit != null) {
            return dailyLimit;
        }
        return ResponseEntity.ok(assistantService.chat(userId, request));
    }

    private ResponseEntity<?> toLimitResponse(RateLimitResult result) {
        if (result == null || result.allowed()) {
            return null;
        }
        return ResponseEntity.status(429).body(Map.of(
                "message", result.message(),
                "retryAfterSeconds", result.retryAfterSeconds()
        ));
    }
}
