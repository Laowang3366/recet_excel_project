package com.excel.forum.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.excel.forum.entity.PointsRecord;

import java.time.LocalDate;
import java.util.Map;

public interface PointsRecordService extends IService<PointsRecord> {
    void addPointsRecord(Long userId, String ruleName, Integer change, String description);
    boolean addTaskPointsRecord(Long userId, Long ruleId, String ruleName, String taskKey, Long bizId, LocalDate taskDate, Integer change, String description);
    Map<String, Object> getRecordsPage(int page, int size, String username);
    Map<String, Object> getUserRecordsPage(Long userId, int page, int size);
}
