package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.CheckinRecord;
import com.excel.forum.mapper.CheckinRecordMapper;
import com.excel.forum.service.CheckinService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.ExperienceRuleService;
import com.excel.forum.service.PointsRuleService;
import com.excel.forum.service.PointsTaskService;
import com.excel.forum.service.UserEntitlementService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class CheckinServiceImpl implements CheckinService {
    public static final int MIN_EXP = 1;
    public static final int MAX_EXP = 20;
    private static final int MAX_STREAK_POINTS_BONUS = 6;
    private static final int MAX_STREAK_EXP_BONUS = 12;

    private final CheckinRecordMapper checkinRecordMapper;
    private final ExperienceService experienceService;
    private final ExperienceRuleService experienceRuleService;
    private final UserService userService;
    private final PointsRuleService pointsRuleService;
    private final PointsTaskService pointsTaskService;
    private final UserEntitlementService userEntitlementService;

    @Override
    public Map<String, Object> getCheckinStatus(Long userId, String month) {
        LocalDate today = LocalDate.now();
        YearMonth targetMonth = parseMonth(month);
        int[] expRange = resolveCheckinExpRange();

        CheckinRecord todayRecord = getTodayRecord(userId, today);
        List<CheckinRecord> monthRecords = listMonthRecords(userId, targetMonth);
        int currentContinuousDays = calculateContinuousDays(userId, today);
        int previewContinuousDays = todayRecord != null ? currentContinuousDays : currentContinuousDays + 1;
        int previewPoints = resolveCheckinPointsReward(previewContinuousDays);
        int previewExpBonus = resolveCheckinExpBonus(previewContinuousDays);
        int basePoints = resolveBaseCheckinPoints();

        Map<String, Object> response = new HashMap<>();
        response.put("hasCheckedInToday", todayRecord != null);
        response.put("todayExp", todayRecord != null ? todayRecord.getGainedExp() : 0);
        response.put("continuousDays", currentContinuousDays);
        response.put("currentContinuousDays", currentContinuousDays);
        response.put("previewContinuousDays", previewContinuousDays);
        response.put("totalDays", countTotalDays(userId));
        response.put("totalExp", sumTotalExp(userId));
        response.put("checkinDates", monthRecords.stream().map(record -> record.getCheckinDate().toString()).toList());
        response.put("month", targetMonth.toString());
        response.put("expMin", expRange[0]);
        response.put("expMax", expRange[1]);
        response.put("previewExpMin", expRange[0] + previewExpBonus);
        response.put("previewExpMax", expRange[1] + previewExpBonus);
        response.put("previewExpBonus", previewExpBonus);
        response.put("previewPoints", previewPoints);
        response.put("basePoints", basePoints);
        response.put("previewPointsBonus", Math.max(previewPoints - basePoints, 0));
        response.put("makeupCardCount", userEntitlementService.countAvailableByKey(userId, UserEntitlementService.KEY_CHECKIN_MAKEUP_CARD));
        LocalDate latestMissedDate = findLatestMissedCheckinDate(userId, today);
        response.put("latestMissedDate", latestMissedDate == null ? null : latestMissedDate.toString());
        response.put("canMakeupCheckin", latestMissedDate != null);
        response.put("expProgress", experienceService.getProgress(userService.getById(userId).getExp()));
        return response;
    }

    @Override
    @Transactional
    public Map<String, Object> performCheckin(Long userId) {
        LocalDate today = LocalDate.now();
        if (getTodayRecord(userId, today) != null) {
            throw new IllegalStateException("今天已经签到过了");
        }

        int streakDays = calculateContinuousDays(userId, today) + 1;
        int expBonus = resolveCheckinExpBonus(streakDays);
        int pointsRewardValue = resolveCheckinPointsReward(streakDays);
        int gainedExp = experienceRuleService.resolveRandomExp(ExperienceService.BIZ_DAILY_CHECKIN, MIN_EXP, MAX_EXP) + expBonus;

        CheckinRecord record = new CheckinRecord();
        record.setUserId(userId);
        record.setCheckinDate(today);
        record.setGainedExp(gainedExp);
        try {
            checkinRecordMapper.insert(record);
        } catch (DuplicateKeyException exception) {
            throw new IllegalStateException("今天已经签到过了");
        }

        experienceService.awardDailyCheckin(userId, today, gainedExp);
        Map<String, Object> taskReward = pointsTaskService.awardTaskWithPoints(
                userId,
                PointsTaskService.TASK_DAILY_CHECKIN,
                null,
                "完成每日签到",
                pointsRewardValue
        );

        Map<String, Object> response = new HashMap<>();
        response.put("message", "签到成功");
        response.put("gainedExp", gainedExp);
        response.put("gainedPoints", pointsRewardValue);
        response.put("continuousDays", streakDays);
        response.put("streakExpBonus", expBonus);
        response.put("streakPointsBonus", Math.max(pointsRewardValue - resolveBaseCheckinPoints(), 0));
        if (taskReward != null) {
            response.put("pointsRewards", java.util.List.of(taskReward));
        }
        response.put("totalDays", countTotalDays(userId));
        response.put("totalExp", sumTotalExp(userId));
        response.put("checkinDate", today.toString());
        response.put("expProgress", experienceService.getProgress(userService.getById(userId).getExp()));
        return response;
    }

    @Override
    @Transactional
    public Map<String, Object> performMakeupCheckin(Long userId) {
        LocalDate today = LocalDate.now();
        LocalDate missedDate = findLatestMissedCheckinDate(userId, today);
        if (missedDate == null) {
            throw new IllegalStateException("当前没有可补签的漏签日期");
        }
        if (getTodayRecord(userId, missedDate) != null) {
            throw new IllegalStateException("目标日期已签到");
        }
        if (userEntitlementService.consumeAvailableByKey(userId, UserEntitlementService.KEY_CHECKIN_MAKEUP_CARD) == null) {
            throw new IllegalStateException("暂无可用补签卡");
        }

        int streakDays = calculateContinuousDays(userId, missedDate) + 1;
        int expBonus = resolveCheckinExpBonus(streakDays);
        int pointsRewardValue = resolveCheckinPointsReward(streakDays);
        int gainedExp = experienceRuleService.resolveRandomExp(ExperienceService.BIZ_DAILY_CHECKIN, MIN_EXP, MAX_EXP) + expBonus;

        CheckinRecord record = new CheckinRecord();
        record.setUserId(userId);
        record.setCheckinDate(missedDate);
        record.setGainedExp(gainedExp);
        try {
            checkinRecordMapper.insert(record);
        } catch (DuplicateKeyException exception) {
            throw new IllegalStateException("目标日期已签到");
        }

        experienceService.awardDailyCheckin(userId, missedDate, gainedExp);
        Map<String, Object> taskReward = pointsTaskService.awardTaskForDateWithPoints(
                userId,
                PointsTaskService.TASK_DAILY_CHECKIN,
                Long.parseLong(missedDate.format(DateTimeFormatter.BASIC_ISO_DATE)),
                "使用补签卡补签",
                missedDate,
                pointsRewardValue
        );

        Map<String, Object> response = new HashMap<>();
        response.put("message", "补签成功");
        response.put("madeUpDate", missedDate.toString());
        response.put("gainedExp", gainedExp);
        response.put("gainedPoints", pointsRewardValue);
        response.put("streakExpBonus", expBonus);
        response.put("streakPointsBonus", Math.max(pointsRewardValue - resolveBaseCheckinPoints(), 0));
        if (taskReward != null) {
            response.put("pointsRewards", java.util.List.of(taskReward));
        }
        response.put("continuousDays", calculateContinuousDays(userId, today));
        response.put("totalDays", countTotalDays(userId));
        response.put("totalExp", sumTotalExp(userId));
        response.put("makeupCardCount", userEntitlementService.countAvailableByKey(userId, UserEntitlementService.KEY_CHECKIN_MAKEUP_CARD));
        response.put("expProgress", experienceService.getProgress(userService.getById(userId).getExp()));
        return response;
    }

    private CheckinRecord getTodayRecord(Long userId, LocalDate today) {
        QueryWrapper<CheckinRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).eq("checkin_date", today);
        return checkinRecordMapper.selectOne(queryWrapper);
    }

    private List<CheckinRecord> listMonthRecords(Long userId, YearMonth month) {
        QueryWrapper<CheckinRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId)
                .between("checkin_date", month.atDay(1), month.atEndOfMonth())
                .orderByAsc("checkin_date");
        return checkinRecordMapper.selectList(queryWrapper);
    }

    private int calculateContinuousDays(Long userId, LocalDate today) {
        CheckinRecord todayRecord = getTodayRecord(userId, today);
        LocalDate cursor = todayRecord != null ? today : today.minusDays(1);
        QueryWrapper<CheckinRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).le("checkin_date", cursor).orderByDesc("checkin_date");
        List<CheckinRecord> records = checkinRecordMapper.selectList(queryWrapper);
        int streak = 0;
        for (CheckinRecord record : records) {
            if (record.getCheckinDate() == null) {
                continue;
            }
            if (record.getCheckinDate().isEqual(cursor)) {
                streak += 1;
                cursor = cursor.minusDays(1);
                continue;
            }
            if (record.getCheckinDate().isBefore(cursor)) {
                break;
            }
        }
        return streak;
    }

    private long countTotalDays(Long userId) {
        QueryWrapper<CheckinRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId);
        return checkinRecordMapper.selectCount(queryWrapper);
    }

    private int sumTotalExp(Long userId) {
        QueryWrapper<CheckinRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).select("COALESCE(SUM(gained_exp), 0) AS total_exp");
        Map<String, Object> result = checkinRecordMapper.selectMaps(queryWrapper).stream().findFirst().orElse(Map.of());
        Object value = result.get("total_exp");
        if (value instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    private int[] resolveCheckinExpRange() {
        var rule = experienceRuleService.getByRuleKey(ExperienceService.BIZ_DAILY_CHECKIN);
        if (rule == null) {
            return experienceRuleService.count() > 0 ? new int[] { 0, 0 } : new int[] { MIN_EXP, MAX_EXP };
        }
        if (Boolean.FALSE.equals(rule.getEnabled())) {
            return new int[] { 0, 0 };
        }
        int min = MIN_EXP;
        int max = MAX_EXP;
        if (rule.getMinExp() != null) {
            min = Math.max(rule.getMinExp(), 0);
        }
        if (rule.getMaxExp() != null) {
            max = Math.max(rule.getMaxExp(), min);
        }
        if (max < min) {
            max = min;
        }
        return new int[] { min, max };
    }

    private int resolveBaseCheckinPoints() {
        var rule = pointsRuleService.getRuleByTaskKey(PointsTaskService.TASK_DAILY_CHECKIN);
        if (rule == null || rule.getPoints() == null || rule.getPoints() <= 0) {
            return 0;
        }
        return rule.getPoints();
    }

    private int resolveCheckinPointsReward(int streakDays) {
        int basePoints = resolveBaseCheckinPoints();
        if (basePoints <= 0) {
            return 0;
        }
        return basePoints + Math.min(Math.max(streakDays - 1, 0), MAX_STREAK_POINTS_BONUS);
    }

    private int resolveCheckinExpBonus(int streakDays) {
        return Math.min(Math.max(streakDays - 1, 0) * 2, MAX_STREAK_EXP_BONUS);
    }

    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(month, DateTimeFormatter.ofPattern("yyyy-MM"));
        } catch (DateTimeParseException exception) {
            log.debug("Invalid checkin month parameter, using current month: {}", month, exception);
            return YearMonth.now();
        }
    }

    private LocalDate findLatestMissedCheckinDate(Long userId, LocalDate today) {
        LocalDate cursor = today.minusDays(1);
        if (cursor.isBefore(LocalDate.of(2020, 1, 1))) {
            return null;
        }
        QueryWrapper<CheckinRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId)
                .le("checkin_date", cursor)
                .ge("checkin_date", cursor.minusDays(365))
                .orderByDesc("checkin_date");
        Set<LocalDate> signedDates = new HashSet<>(checkinRecordMapper.selectList(queryWrapper).stream()
                .map(CheckinRecord::getCheckinDate)
                .filter(item -> item != null)
                .toList());
        for (int i = 0; i < 366; i += 1) {
            if (!signedDates.contains(cursor)) {
                return cursor;
            }
            cursor = cursor.minusDays(1);
        }
        return null;
    }
}
