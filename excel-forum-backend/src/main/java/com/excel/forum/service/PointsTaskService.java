package com.excel.forum.service;

import java.util.List;
import java.util.Map;
import java.time.LocalDate;

public interface PointsTaskService {
    String TASK_DAILY_CHECKIN = "daily_checkin";
    String TASK_DAILY_PRACTICE = "daily_practice";
    String TASK_FIRST_PRACTICE = "first_practice";

    Map<String, Object> awardTask(Long userId, String taskKey, Long bizId, String description);

    Map<String, Object> awardTaskForDate(Long userId, String taskKey, Long bizId, String description, LocalDate taskDate);

    Map<String, Object> awardTaskWithPoints(Long userId, String taskKey, Long bizId, String description, Integer pointsOverride);

    Map<String, Object> awardTaskForDateWithPoints(Long userId, String taskKey, Long bizId, String description, LocalDate taskDate, Integer pointsOverride);

    List<Map<String, Object>> getUserTasks(Long userId);
}
