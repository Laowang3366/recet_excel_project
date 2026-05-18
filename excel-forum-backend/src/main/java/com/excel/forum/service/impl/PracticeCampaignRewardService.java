package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.DailyChallenge;
import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.PracticeAttempt;
import com.excel.forum.entity.PracticeLevel;
import com.excel.forum.entity.UserLevelProgress;
import com.excel.forum.mapper.DailyChallengeMapper;
import com.excel.forum.mapper.PracticeAttemptMapper;
import com.excel.forum.mapper.PracticeLevelMapper;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.PointsRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import static com.excel.forum.util.QueryPageUtils.first;

@Service
@RequiredArgsConstructor
class PracticeCampaignRewardService {
    private final DailyChallengeMapper dailyChallengeMapper;
    private final PracticeAttemptMapper practiceAttemptMapper;
    private final PracticeLevelMapper practiceLevelMapper;
    private final PointsRecordService pointsRecordService;
    private final ExperienceService experienceService;

    Map<String, Object> buildDailyChallengePayload(Long userId) {
        QueryWrapper<DailyChallenge> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("challenge_date", LocalDate.now()).eq("enabled", true).orderByDesc("id");
        DailyChallenge challenge = first(dailyChallengeMapper, queryWrapper);
        if (challenge == null) {
            return null;
        }
        PracticeLevel level = practiceLevelMapper.selectById(challenge.getLevelId());
        if (level == null) {
            return null;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", challenge.getId());
        payload.put("levelId", level.getId());
        payload.put("title", level.getTitle());
        payload.put("rewardExp", challenge.getRewardExp());
        payload.put("rewardPoints", challenge.getRewardPoints());
        payload.put("configured", true);
        payload.put("challengeDate", challenge.getChallengeDate());
        payload.put("completed", hasCompletedDailyChallenge(userId, level.getId()));
        payload.put("rewardGranted", hasDailyChallengeReward(userId, level.getId()));
        return payload;
    }

    int awardLevelFirstPassBonus(Long userId, PracticeLevel level, boolean passed, UserLevelProgress existingProgress) {
        if (!passed) {
            return 0;
        }
        boolean firstClear = existingProgress == null || existingProgress.getFirstPassTime() == null;
        int bonus = safeInt(level.getFirstPassBonus());
        if (!firstClear || bonus <= 0) {
            return 0;
        }
        pointsRecordService.addTaskPointsRecord(
                userId,
                null,
                "关卡首通奖励",
                "campaign_first_pass",
                level.getId(),
                null,
                bonus,
                "首次通关关卡《" + defaultText(level.getTitle(), "未命名关卡") + "》"
        );
        return bonus;
    }

    Map<String, Object> awardDailyChallengeIfNeeded(Long userId, PracticeLevel level) {
        QueryWrapper<DailyChallenge> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("challenge_date", LocalDate.now())
                .eq("enabled", true)
                .eq("level_id", level.getId())
                .orderByDesc("id");
        DailyChallenge challenge = first(dailyChallengeMapper, queryWrapper);
        if (challenge == null) {
            return Map.of("applied", false);
        }
        if (hasDailyChallengeReward(userId, level.getId())) {
            return Map.of(
                    "applied", false,
                    "completed", true,
                    "rewardGranted", true,
                    "rewardExp", safeInt(challenge.getRewardExp()),
                    "rewardPoints", safeInt(challenge.getRewardPoints())
            );
        }

        pointsRecordService.addTaskPointsRecord(
                userId,
                null,
                "每日挑战奖励",
                "daily_campaign",
                level.getId(),
                LocalDate.now(),
                safeInt(challenge.getRewardPoints()),
                "完成每日挑战《" + defaultText(level.getTitle(), "每日挑战") + "》"
        );
        experienceService.addExp(
                userId,
                "daily_campaign",
                level.getId(),
                safeInt(challenge.getRewardExp()),
                "完成每日挑战《" + defaultText(level.getTitle(), "每日挑战") + "》"
        );
        return Map.of(
                "applied", true,
                "completed", true,
                "rewardGranted", true,
                "rewardExp", safeInt(challenge.getRewardExp()),
                "rewardPoints", safeInt(challenge.getRewardPoints())
        );
    }

    private boolean hasCompletedDailyChallenge(Long userId, Long levelId) {
        if (levelId == null) {
            return false;
        }
        QueryWrapper<PracticeAttempt> queryWrapper = new QueryWrapper<>();
        if (userId != null) {
            queryWrapper.eq("user_id", userId);
        }
        queryWrapper.eq("level_id", levelId)
                .eq("result_status", "passed")
                .ge("submit_time", LocalDate.now().atStartOfDay());
        return practiceAttemptMapper.selectCount(queryWrapper) > 0;
    }

    private boolean hasDailyChallengeReward(Long userId, Long levelId) {
        if (levelId == null) {
            return false;
        }
        QueryWrapper<PointsRecord> queryWrapper = new QueryWrapper<>();
        if (userId != null) {
            queryWrapper.eq("user_id", userId);
        }
        queryWrapper.eq("task_key", "daily_campaign")
                .eq("biz_id", levelId)
                .eq("task_date", LocalDate.now());
        return pointsRecordService.count(queryWrapper) > 0;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
