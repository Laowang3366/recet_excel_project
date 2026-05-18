package com.excel.forum.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.excel.forum.entity.UserExpLog;

import java.time.LocalDate;
import java.util.Map;

public interface ExperienceService extends IService<UserExpLog> {
    String BIZ_DAILY_CHECKIN = "daily_checkin";
    String BIZ_PRACTICE_COMPLETE = "practice_complete";

    boolean addExp(Long userId, String bizType, Long bizId, Integer amount, String reason);

    void awardDailyCheckin(Long userId, LocalDate checkinDate, Integer gainedExp);

    void awardPracticeComplete(Long userId, Long recordId);

    Map<String, Object> getProgress(Integer expValue);

    Map<String, Object> getUserExpLogs(Long userId, Integer page, Integer size);
}
