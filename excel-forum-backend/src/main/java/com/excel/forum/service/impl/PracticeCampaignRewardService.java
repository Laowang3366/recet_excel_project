package com.excel.forum.service.impl;

import com.excel.forum.entity.PracticeLevel;
import com.excel.forum.entity.UserLevelProgress;
import com.excel.forum.service.PointsRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class PracticeCampaignRewardService {
    private final PointsRecordService pointsRecordService;

    int awardLevelFirstPassBonus(Long userId, PracticeLevel level, boolean passed, UserLevelProgress existingProgress) {
        if (!passed) {
            return 0;
        }
        boolean firstClear = existingProgress == null || existingProgress.getFirstPassTime() == null;
        int bonus = safeInt(level.getFirstPassBonus());
        if (!firstClear || bonus <= 0) {
            return 0;
        }
        boolean granted = pointsRecordService.addTaskPointsRecord(
                userId,
                null,
                "关卡首通奖励",
                "campaign_first_pass",
                level.getId(),
                null,
                bonus,
                "首次通关关卡《" + defaultText(level.getTitle(), "未命名关卡") + "》"
        );
        return granted ? bonus : 0;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
