package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.AiAssistantCallLog;
import com.excel.forum.mapper.AiAssistantCallLogMapper;
import com.excel.forum.service.AiAssistantCallLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiAssistantCallLogServiceImpl extends ServiceImpl<AiAssistantCallLogMapper, AiAssistantCallLog> implements AiAssistantCallLogService {
    private final AiAssistantCallLogMapper callLogMapper;

    @Override
    public void record(Long userId, Long configId, String model, boolean success, boolean fallbackUsed, long latencyMs, String errorMessage) {
        record(userId, configId, model, "assistant_chat", success, fallbackUsed, latencyMs, errorMessage, null, null, null);
    }

    @Override
    public void record(Long userId, Long configId, String model, String toolType, boolean success, boolean fallbackUsed, long latencyMs, String errorMessage) {
        record(userId, configId, model, toolType, success, fallbackUsed, latencyMs, errorMessage, null, null, null);
    }

    @Override
    public void record(Long userId, Long configId, String model, String toolType, boolean success, boolean fallbackUsed, long latencyMs,
                       String errorMessage, String questionSummary, String requestPreview, String responsePreview) {
        if (userId == null) {
            return;
        }
        AiAssistantCallLog log = new AiAssistantCallLog();
        log.setUserId(userId);
        log.setConfigId(configId);
        log.setModel(model);
        log.setToolType(clamp(toolType, 50) == null ? "assistant_chat" : clamp(toolType, 50));
        log.setQuestionSummary(clamp(questionSummary, 255));
        log.setRequestPreview(clamp(requestPreview, 4000));
        log.setResponsePreview(clamp(responsePreview, 4000));
        log.setSuccess(success);
        log.setFallbackUsed(fallbackUsed);
        log.setLatencyMs(Math.max(0L, latencyMs));
        log.setErrorMessage(clamp(errorMessage, 500));
        save(log);
    }

    @Override
    public Map<String, Object> getUserStats(LocalDate startDate, LocalDate endDate, String keyword, long page, long size) {
        LocalDateTime startTime = startDate == null ? null : startDate.atStartOfDay();
        LocalDateTime endTime = endDate == null ? null : endDate.plusDays(1).atStartOfDay();
        long normalizedPage = Math.max(1L, page);
        long normalizedSize = Math.min(100L, Math.max(1L, size));
        long offset = (normalizedPage - 1L) * normalizedSize;
        String normalizedKeyword = keyword == null ? null : keyword.trim();
        if (normalizedKeyword != null && normalizedKeyword.isEmpty()) {
            normalizedKeyword = null;
        }

        Long total = callLogMapper.countUserStats(startTime, endTime, normalizedKeyword);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("overview", callLogMapper.selectOverview(startTime, endTime));
        response.put("records", callLogMapper.selectUserStats(startTime, endTime, normalizedKeyword, offset, normalizedSize));
        response.put("failureReasons", callLogMapper.selectFailureReasons(startTime, endTime, null));
        response.put("total", total == null ? 0L : total);
        response.put("current", normalizedPage);
        response.put("size", normalizedSize);
        return response;
    }

    @Override
    public Map<String, Object> getUserDetail(Long userId, LocalDate startDate, LocalDate endDate, long page, long size) {
        LocalDateTime startTime = startDate == null ? null : startDate.atStartOfDay();
        LocalDateTime endTime = endDate == null ? null : endDate.plusDays(1).atStartOfDay();
        long normalizedPage = Math.max(1L, page);
        long normalizedSize = Math.min(50L, Math.max(1L, size));
        long offset = (normalizedPage - 1L) * normalizedSize;

        Map<String, Object> profile = callLogMapper.selectUserProfile(userId);
        if (profile == null) {
            profile = new LinkedHashMap<>();
            profile.put("userId", userId);
            profile.put("username", "用户#" + userId);
            profile.put("email", "");
            profile.put("level", 1);
            profile.put("points", 0);
        }
        Map<String, Object> summary = callLogMapper.selectUserSummary(startTime, endTime, userId);
        List<Map<String, Object>> records = callLogMapper.selectUserCallRecords(startTime, endTime, userId, offset, normalizedSize);
        Long total = callLogMapper.countUserCallRecords(startTime, endTime, userId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("profile", profile);
        response.put("summary", summary == null ? Map.of() : summary);
        response.put("records", records);
        response.put("failureReasons", callLogMapper.selectFailureReasons(startTime, endTime, userId));
        response.put("total", total == null ? 0L : total);
        response.put("current", normalizedPage);
        response.put("size", normalizedSize);
        return response;
    }

    @Override
    public Map<String, Object> getUserRawLogs(Long userId, LocalDate startDate, LocalDate endDate, long page, long size) {
        LocalDateTime startTime = startDate == null ? null : startDate.atStartOfDay();
        LocalDateTime endTime = endDate == null ? null : endDate.plusDays(1).atStartOfDay();
        long normalizedPage = Math.max(1L, page);
        long normalizedSize = Math.min(50L, Math.max(1L, size));
        long offset = (normalizedPage - 1L) * normalizedSize;
        Long total = callLogMapper.countUserCallRecords(startTime, endTime, userId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("records", callLogMapper.selectUserRawLogs(startTime, endTime, userId, offset, normalizedSize));
        response.put("total", total == null ? 0L : total);
        response.put("current", normalizedPage);
        response.put("size", normalizedSize);
        return response;
    }

    private String clamp(String value, int max) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() <= max ? normalized : normalized.substring(0, max);
    }
}
