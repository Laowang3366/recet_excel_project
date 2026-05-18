package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.User;
import com.excel.forum.service.CheckinService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.PointsTaskService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/points")
@RequiredArgsConstructor
public class PointsController {
    private final UserService userService;
    private final PointsRecordService pointsRecordService;
    private final ExperienceService experienceService;
    private final CheckinService checkinService;
    private final PointsTaskService pointsTaskService;

    @GetMapping("/overview")
    public ResponseEntity<?> getOverview(@RequestAttribute Long userId) {
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "用户不存在"));
        }

        Map<String, Object> checkinStatus = checkinService.getCheckinStatus(userId, null);
        Map<String, Object> recentRecordsResult = pointsRecordService.getUserRecordsPage(userId, 1, 5);

        Map<String, Object> response = new HashMap<>();
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("id", user.getId());
        userInfo.put("username", user.getUsername());
        userInfo.put("points", safeInt(user.getPoints()));
        userInfo.put("level", safeInt(user.getLevel()));
        userInfo.put("exp", safeInt(user.getExp()));
        response.put("user", userInfo);
        response.put("expProgress", experienceService.getProgress(user.getExp()));

        Map<String, Object> todayCheckin = new HashMap<>();
        todayCheckin.put("checkedIn", Boolean.TRUE.equals(checkinStatus.get("hasCheckedInToday")));
        todayCheckin.put("todayExp", safeInt(checkinStatus.get("todayExp")));
        todayCheckin.put("continuousDays", safeInt(checkinStatus.get("continuousDays")));
        todayCheckin.put("totalDays", safeInt(checkinStatus.get("totalDays")));
        todayCheckin.put("totalExp", safeInt(checkinStatus.get("totalExp")));
        response.put("todayCheckin", todayCheckin);
        response.put("todayPointsGain", calculateTodayPointsGain(userId));
        response.put("recentRecords", recentRecordsResult.getOrDefault("records", List.of()));
        List<Map<String, Object>> tasks = pointsTaskService.getUserTasks(userId);
        response.put("tasks", tasks);
        response.put("taskSummary", Map.of(
                "total", tasks.size(),
                "completed", tasks.stream().filter(task -> Boolean.TRUE.equals(task.get("completed"))).count()
        ));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/records")
    public ResponseEntity<?> getRecords(
            @RequestAttribute Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(pointsRecordService.getUserRecordsPage(userId, page, size));
    }

    @GetMapping("/tasks")
    public ResponseEntity<?> getTasks(@RequestAttribute Long userId) {
        return ResponseEntity.ok(Map.of("tasks", pointsTaskService.getUserTasks(userId)));
    }

    private int calculateTodayPointsGain(Long userId) {
        LocalDateTime startOfDay = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
        QueryWrapper<PointsRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).ge("create_time", startOfDay);
        return pointsRecordService.list(queryWrapper).stream()
                .map(PointsRecord::getChange)
                .filter(change -> change != null && change > 0)
                .mapToInt(Integer::intValue)
                .sum();
    }

    private int safeInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException exception) {
            return 0;
        }
    }
}
