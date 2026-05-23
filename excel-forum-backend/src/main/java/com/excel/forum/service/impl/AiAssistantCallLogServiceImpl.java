package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.AiAssistantCallLog;
import com.excel.forum.mapper.AiAssistantCallLogMapper;
import com.excel.forum.service.AiAssistantCallLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiAssistantCallLogServiceImpl extends ServiceImpl<AiAssistantCallLogMapper, AiAssistantCallLog> implements AiAssistantCallLogService {
    private final AiAssistantCallLogMapper callLogMapper;

    @Override
    public void record(Long userId, Long configId, String model, boolean success, boolean fallbackUsed, long latencyMs, String errorMessage) {
        record(userId, configId, model, "assistant_chat", success, fallbackUsed, latencyMs, errorMessage);
    }

    @Override
    public void record(Long userId, Long configId, String model, String toolType, boolean success, boolean fallbackUsed, long latencyMs, String errorMessage) {
        if (userId == null) {
            return;
        }
        AiAssistantCallLog log = new AiAssistantCallLog();
        log.setUserId(userId);
        log.setConfigId(configId);
        log.setModel(model);
        log.setToolType(clamp(toolType, 50) == null ? "assistant_chat" : clamp(toolType, 50));
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
