package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.config.ExperienceProperties;
import com.excel.forum.entity.ExperienceRule;
import com.excel.forum.entity.ExperienceLevelRule;
import com.excel.forum.entity.User;
import com.excel.forum.entity.UserExpLog;
import com.excel.forum.mapper.UserExpLogMapper;
import com.excel.forum.service.ExperienceLevelRuleService;
import com.excel.forum.service.ExperienceRuleService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.SecurityAbuseMonitor;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExperienceServiceImpl extends ServiceImpl<UserExpLogMapper, UserExpLog> implements ExperienceService {
    private final ExperienceProperties experienceProperties;
    private final UserService userService;
    private final ExperienceRuleService experienceRuleService;
    private final ExperienceLevelRuleService experienceLevelRuleService;
    private final SecurityAbuseMonitor securityAbuseMonitor;

    @Override
    @Transactional
    public boolean addExp(Long userId, String bizType, Long bizId, Integer amount, String reason) {
        if (userId == null || amount == null || amount <= 0 || bizType == null || bizType.isBlank()) {
            return false;
        }

        User user = userService.getById(userId);
        if (user == null) {
            return false;
        }

        QueryWrapper<UserExpLog> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).eq("biz_type", bizType);
        ExperienceRule configuredRule = experienceRuleService.getByRuleKey(bizType);
        Integer maxObtainCount = configuredRule == null ? null : configuredRule.getMaxObtainCount();
        if (maxObtainCount != null && maxObtainCount > 0) {
            QueryWrapper<UserExpLog> totalCountWrapper = new QueryWrapper<>();
            totalCountWrapper.eq("user_id", userId).eq("biz_type", bizType);
            if (count(totalCountWrapper) >= maxObtainCount) {
                return false;
            }
        }
        if (bizId == null) {
            queryWrapper.isNull("biz_id");
        } else {
            queryWrapper.eq("biz_id", bizId);
        }
        if (count(queryWrapper) > 0) {
            return false;
        }

        int beforeExp = user.getExp() == null ? 0 : user.getExp();
        int beforeLevel = resolveLevel(beforeExp);
        int afterExp = beforeExp + amount;
        int afterLevel = resolveLevel(afterExp);

        UserExpLog expLog = new UserExpLog();
        expLog.setUserId(userId);
        expLog.setBizType(bizType);
        expLog.setBizId(bizId);
        expLog.setExpChange(amount);
        expLog.setReason(reason);
        try {
            save(expLog);
        } catch (DuplicateKeyException exception) {
            securityAbuseMonitor.recordRewardIdempotencyCollision(buildExpCollisionKey(userId, bizType, bizId));
            log.debug("Duplicate experience award skipped: userId={}, bizType={}, bizId={}", userId, bizType, bizId, exception);
            return false;
        }

        User updatedUser = new User();
        updatedUser.setId(userId);
        updatedUser.setExp(afterExp);
        updatedUser.setLevel(afterLevel);
        userService.updateById(updatedUser);

        return true;
    }

    @Override
    public void awardDailyCheckin(Long userId, LocalDate checkinDate, Integer gainedExp) {
        int amount = gainedExp == null || gainedExp <= 0
                ? experienceRuleService.resolveRandomExp(BIZ_DAILY_CHECKIN, 1, 20)
                : gainedExp;
        long bizId = Long.parseLong(checkinDate.format(DateTimeFormatter.BASIC_ISO_DATE));
        addExp(userId, BIZ_DAILY_CHECKIN, bizId, amount, "每日签到");
    }

    @Override
    public void awardPracticeComplete(Long userId, Long recordId) {
        int amount = resolveRuleAmount(BIZ_PRACTICE_COMPLETE, 2);
        addExp(userId, BIZ_PRACTICE_COMPLETE, recordId, amount, "完成练习");
    }

    @Override
    public Map<String, Object> getProgress(Integer expValue) {
        int exp = Math.max(expValue == null ? 0 : expValue, 0);
        List<ExperienceProperties.LevelRule> levels = getSortedLevels();
        if (levels.isEmpty()) {
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("exp", exp);
            fallback.put("level", 1);
            fallback.put("levelName", "新手");
            fallback.put("currentThreshold", 0);
            fallback.put("nextThreshold", 0);
            fallback.put("currentInLevel", exp);
            fallback.put("totalInLevel", 0);
            fallback.put("remainingExp", 0);
            fallback.put("maxLevel", true);
            return fallback;
        }

        ExperienceProperties.LevelRule current = levels.get(0);
        ExperienceProperties.LevelRule next = null;
        for (int index = 0; index < levels.size(); index += 1) {
            ExperienceProperties.LevelRule candidate = levels.get(index);
            if (exp >= safeThreshold(candidate)) {
                current = candidate;
                next = index + 1 < levels.size() ? levels.get(index + 1) : null;
            } else {
                break;
            }
        }

        int currentThreshold = safeThreshold(current);
        int nextThreshold = next == null ? currentThreshold : safeThreshold(next);
        int totalInLevel = next == null ? 0 : Math.max(nextThreshold - currentThreshold, 0);
        int currentInLevel = next == null ? exp - currentThreshold : Math.max(exp - currentThreshold, 0);
        int remainingExp = next == null ? 0 : Math.max(nextThreshold - exp, 0);

        Map<String, Object> result = new HashMap<>();
        result.put("exp", exp);
        result.put("level", current.getLevel());
        result.put("levelName", current.getName());
        result.put("currentThreshold", currentThreshold);
        result.put("nextThreshold", nextThreshold);
        result.put("currentInLevel", currentInLevel);
        result.put("totalInLevel", totalInLevel);
        result.put("remainingExp", remainingExp);
        result.put("maxLevel", next == null);
        return result;
    }

    @Override
    public Map<String, Object> getUserExpLogs(Long userId, Integer page, Integer size) {
        Page<UserExpLog> pageRequest = new Page<>(page == null || page < 1 ? 1 : page, size == null || size < 1 ? 10 : size);
        QueryWrapper<UserExpLog> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).orderByDesc("create_time");
        Page<UserExpLog> result = page(pageRequest, queryWrapper);

        List<Map<String, Object>> records = result.getRecords().stream().map(log -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", log.getId());
            item.put("bizType", log.getBizType());
            item.put("bizLabel", mapExpRuleLabel(log.getBizType()));
            item.put("bizId", log.getBizId());
            item.put("expChange", log.getExpChange());
            item.put("reason", log.getReason());
            item.put("createTime", log.getCreateTime());
            return item;
        }).toList();

        Map<String, Object> response = new HashMap<>();
        response.put("records", records);
        response.put("total", result.getTotal());
        response.put("current", result.getCurrent());
        response.put("size", result.getSize());
        response.put("pages", result.getPages());
        return response;
    }

    private int resolveRuleAmount(String ruleKey, int defaultValue) {
        ExperienceRule rule = experienceRuleService.getByRuleKey(ruleKey);
        if (rule != null) {
            return experienceRuleService.resolveFixedExp(ruleKey, defaultValue);
        }
        Integer configuredValue = experienceProperties.getRules().get(ruleKey);
        return configuredValue != null && configuredValue > 0 ? configuredValue : defaultValue;
    }

    private String buildExpCollisionKey(Long userId, String bizType, Long bizId) {
        String safeBizType = bizType == null || bizType.isBlank() ? "unknown" : bizType.trim();
        String safeBizId = bizId == null ? "none" : String.valueOf(bizId);
        return "experience:" + userId + ":" + safeBizType + ":" + safeBizId;
    }

    private int resolveLevel(int exp) {
        return getSortedLevels().stream()
                .filter(level -> exp >= safeThreshold(level))
                .map(ExperienceProperties.LevelRule::getLevel)
                .max(Integer::compareTo)
                .orElse(1);
    }

    private String resolveLevelName(int level) {
        return getSortedLevels().stream()
                .filter(item -> item.getLevel() != null && item.getLevel() == level)
                .map(ExperienceProperties.LevelRule::getName)
                .findFirst()
                .orElse("新手");
    }

    private List<ExperienceProperties.LevelRule> getSortedLevels() {
        List<ExperienceLevelRule> configuredRules = experienceLevelRuleService.listEnabledRules();
        if (!configuredRules.isEmpty()) {
            return configuredRules.stream()
                    .map(this::toLevelRule)
                    .sorted(Comparator.comparingInt(this::safeThreshold))
                    .toList();
        }
        return experienceProperties.getLevels().stream()
                .sorted(Comparator.comparingInt(this::safeThreshold))
                .toList();
    }

    private ExperienceProperties.LevelRule toLevelRule(ExperienceLevelRule source) {
        ExperienceProperties.LevelRule item = new ExperienceProperties.LevelRule();
        item.setLevel(source.getLevel());
        item.setName(source.getName());
        item.setThreshold(source.getThreshold());
        return item;
    }

    private int safeThreshold(ExperienceProperties.LevelRule rule) {
        return rule == null || rule.getThreshold() == null ? 0 : rule.getThreshold();
    }

    private String mapExpRuleLabel(String ruleKey) {
        if (ruleKey == null || ruleKey.isBlank()) {
            return "未知来源";
        }
        return switch (ruleKey) {
            case BIZ_DAILY_CHECKIN -> "每日签到";
            case BIZ_PRACTICE_COMPLETE -> "完成练习";
            default -> ruleKey;
        };
    }
}
