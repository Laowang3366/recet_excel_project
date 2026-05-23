package com.excel.forum.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.excel.forum.entity.AiAssistantCallLog;

import java.time.LocalDate;
import java.util.Map;

public interface AiAssistantCallLogService extends IService<AiAssistantCallLog> {
    void record(Long userId, Long configId, String model, boolean success, boolean fallbackUsed, long latencyMs, String errorMessage);

    void record(Long userId, Long configId, String model, String toolType, boolean success, boolean fallbackUsed, long latencyMs, String errorMessage);

    Map<String, Object> getUserStats(LocalDate startDate, LocalDate endDate, String keyword, long page, long size);
}
