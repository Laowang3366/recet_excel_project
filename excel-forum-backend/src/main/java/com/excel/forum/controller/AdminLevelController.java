package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.excel.forum.config.ExperienceProperties;
import com.excel.forum.entity.ExperienceLevelRule;
import com.excel.forum.entity.ExperienceRule;
import com.excel.forum.entity.User;
import com.excel.forum.entity.UserExpLog;
import com.excel.forum.entity.dto.AdminLevelRuleRequest;
import com.excel.forum.entity.dto.AdminLevelUserUpdateRequest;
import com.excel.forum.service.ExperienceLevelRuleService;
import com.excel.forum.service.ExperienceRuleService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static com.excel.forum.controller.AdminControllerSupport.defaultText;
import static com.excel.forum.controller.AdminControllerSupport.parseInteger;
import static com.excel.forum.controller.AdminControllerSupport.safeInt;

@RestController
@RequestMapping("/api/admin/levels")
@RequiredArgsConstructor
public class AdminLevelController {
    private final UserService userService;
    private final ExperienceService experienceService;
    private final ExperienceProperties experienceProperties;
    private final ExperienceRuleService experienceRuleService;
    private final ExperienceLevelRuleService experienceLevelRuleService;

    @GetMapping("/overview")
    public ResponseEntity<?> getLevelOverview() {
        List<ExperienceProperties.LevelRule> sortedLevels = getSortedLevelRules();
        List<User> users = userService.list(new QueryWrapper<User>()
                .select("id", "username", "avatar", "level", "exp", "points", "role", "status", "create_time"));
        List<UserExpLog> todayLogs = experienceService.list(new QueryWrapper<UserExpLog>()
                .ge("create_time", LocalDateTime.now().toLocalDate().atStartOfDay()));

        int totalExp = users.stream().mapToInt(user -> safeInt(user.getExp())).sum();
        int highestLevel = users.stream().map(User::getLevel).filter(Objects::nonNull).max(Integer::compareTo).orElse(1);
        long highestLevelUsers = users.stream().filter(user -> safeInt(user.getLevel()) == highestLevel).count();
        int todayExp = todayLogs.stream().mapToInt(log -> safeInt(log.getExpChange())).sum();

        List<Map<String, Object>> levelDistribution = new ArrayList<>();
        for (ExperienceProperties.LevelRule rule : sortedLevels) {
            int level = safeInt(rule.getLevel());
            long userCount = users.stream().filter(user -> safeInt(user.getLevel()) == level).count();
            Map<String, Object> item = new HashMap<>();
            item.put("level", level);
            item.put("name", defaultText(rule.getName(), "未命名等级"));
            item.put("threshold", safeInt(rule.getThreshold()));
            item.put("userCount", userCount);
            levelDistribution.add(item);
        }

        List<Map<String, Object>> levelRules;
        List<ExperienceLevelRule> configuredLevelRules = experienceLevelRuleService.listOrderedRules();
        if (!configuredLevelRules.isEmpty()) {
            levelRules = configuredLevelRules.stream()
                    .map(this::buildLevelRuleResponse)
                    .collect(Collectors.toList());
        } else {
            levelRules = sortedLevels.stream().map(rule -> {
                Map<String, Object> item = new HashMap<>();
                item.put("level", safeInt(rule.getLevel()));
                item.put("name", defaultText(rule.getName(), "未命名等级"));
                item.put("threshold", safeInt(rule.getThreshold()));
                item.put("enabled", true);
                item.put("sortOrder", safeInt(rule.getLevel()));
                item.put("rangeText", "达到 " + safeInt(rule.getThreshold()) + " 经验");
                return item;
            }).collect(Collectors.toList());
        }

        List<Map<String, Object>> expRules = experienceRuleService.listOrderedRules().stream()
                .map(this::buildExpRuleResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "stats", Map.of(
                        "userCount", users.size(),
                        "totalExp", totalExp,
                        "todayExp", todayExp,
                        "highestLevel", highestLevel,
                        "highestLevelName", resolveLevelName(highestLevel),
                        "highestLevelUsers", highestLevelUsers
                ),
                "levelRules", levelRules,
                "expRules", expRules,
                "distribution", levelDistribution
        ));
    }

    @PostMapping("/rules")
    public ResponseEntity<?> createLevelRule(@RequestBody AdminLevelRuleRequest body) {
        Integer level = parseInteger(body == null ? null : body.getLevel());
        String name = body == null || body.getName() == null ? null : body.getName().trim();
        Integer threshold = parseInteger(body == null ? null : body.getThreshold());
        Boolean enabled = body == null || body.getEnabled() == null ? Boolean.TRUE : body.getEnabled();
        Integer sortOrder = body == null || body.getSortOrder() == null ? null : parseInteger(body.getSortOrder());

        if (level == null || level < 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级值必须大于 0"));
        }
        if (experienceLevelRuleService.getByLevel(level) != null) {
            return ResponseEntity.badRequest().body(Map.of("message", "该等级定义已存在"));
        }
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级名称不能为空"));
        }
        if (threshold == null || threshold < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级阈值不能小于 0"));
        }

        ResponseEntity<?> invalidThreshold = validateLevelThreshold(level, threshold, null);
        if (invalidThreshold != null) {
            return invalidThreshold;
        }

        ExperienceLevelRule created = new ExperienceLevelRule();
        created.setLevel(level);
        created.setName(name);
        created.setThreshold(threshold);
        created.setEnabled(enabled == null || enabled);
        created.setSortOrder(sortOrder == null ? level * 10 : Math.max(sortOrder, 0));
        experienceLevelRuleService.save(created);

        int recalculated = recalculateAllLevels();
        Map<String, Object> response = buildLevelRuleResponse(created);
        response.put("recalculatedUsers", recalculated);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/rules/{level}")
    public ResponseEntity<?> updateLevelRule(@PathVariable Integer level, @RequestBody AdminLevelRuleRequest body) {
        ExperienceLevelRule existing = experienceLevelRuleService.getByLevel(level);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "等级规则不存在"));
        }

        String nextName = body == null || body.getName() == null ? existing.getName() : body.getName().trim();
        Integer nextThreshold = body == null || body.getThreshold() == null ? existing.getThreshold() : parseInteger(body.getThreshold());
        Boolean nextEnabled = body == null || body.getEnabled() == null ? existing.getEnabled() : body.getEnabled();

        if (nextName == null || nextName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级名称不能为空"));
        }
        if (nextThreshold == null || nextThreshold < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级阈值不能小于 0"));
        }
        if (Boolean.FALSE.equals(nextEnabled) && (existing.getEnabled() == null || existing.getEnabled())
                && experienceLevelRuleService.listEnabledRules().size() <= 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "至少保留一个启用等级"));
        }

        ResponseEntity<?> invalidThreshold = validateLevelThreshold(level, nextThreshold, existing.getId());
        if (invalidThreshold != null) {
            return invalidThreshold;
        }

        existing.setName(nextName);
        existing.setThreshold(nextThreshold);
        existing.setEnabled(nextEnabled == null || nextEnabled);
        if (existing.getSortOrder() == null) {
            existing.setSortOrder(safeInt(existing.getLevel()));
        }
        experienceLevelRuleService.updateById(existing);
        int recalculated = recalculateAllLevels();
        Map<String, Object> response = buildLevelRuleResponse(existing);
        response.put("recalculatedUsers", recalculated);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/rules/{level}")
    public ResponseEntity<?> deleteLevelRule(@PathVariable Integer level) {
        ExperienceLevelRule existing = experienceLevelRuleService.getByLevel(level);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "等级规则不存在"));
        }
        if (experienceLevelRuleService.count() <= 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "至少保留一条等级定义"));
        }
        if ((existing.getEnabled() == null || existing.getEnabled()) && experienceLevelRuleService.listEnabledRules().size() <= 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "至少保留一个启用等级"));
        }

        experienceLevelRuleService.removeById(existing.getId());
        int recalculated = recalculateAllLevels();
        return ResponseEntity.ok(Map.of(
                "message", "等级定义已删除",
                "level", safeInt(existing.getLevel()),
                "recalculatedUsers", recalculated
        ));
    }

    @PostMapping("/exp-rules")
    public ResponseEntity<?> createExpRule(@RequestBody ExperienceRule body) {
        String ruleKey = body.getRuleKey() == null ? null : body.getRuleKey().trim();
        String name = body.getName() == null ? null : body.getName().trim();
        int minExp = body.getMinExp() == null ? 0 : Math.max(body.getMinExp(), 0);
        int maxExp = body.getMaxExp() == null ? minExp : Math.max(body.getMaxExp(), 0);
        Integer maxObtainCount = body.getMaxObtainCount() == null ? null : Math.max(body.getMaxObtainCount(), 0);
        if (ruleKey == null || ruleKey.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则标识不能为空"));
        }
        if (!ruleKey.matches("^[a-z0-9_]+$")) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则标识仅支持小写字母、数字和下划线"));
        }
        if (experienceRuleService.getByRuleKey(ruleKey) != null) {
            return ResponseEntity.badRequest().body(Map.of("message", "该规则标识已存在"));
        }
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则名称不能为空"));
        }
        if (maxExp < minExp) {
            return ResponseEntity.badRequest().body(Map.of("message", "最大经验不能小于最小经验"));
        }

        ExperienceRule created = new ExperienceRule();
        created.setRuleKey(ruleKey);
        created.setName(name);
        created.setDescription(body.getDescription() == null ? null : body.getDescription().trim());
        created.setMinExp(minExp);
        created.setMaxExp(maxExp);
        created.setEnabled(body.getEnabled() == null || body.getEnabled());
        created.setMaxObtainCount(maxObtainCount);
        experienceRuleService.save(created);
        return ResponseEntity.ok(buildExpRuleResponse(created));
    }

    @PutMapping("/exp-rules/{ruleKey}")
    public ResponseEntity<?> updateExpRule(@PathVariable String ruleKey, @RequestBody ExperienceRule body) {
        ExperienceRule existing = experienceRuleService.getByRuleKey(ruleKey);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "经验规则不存在"));
        }

        int minExp = body.getMinExp() == null ? safeInt(existing.getMinExp()) : Math.max(body.getMinExp(), 0);
        int maxExp = body.getMaxExp() == null ? safeInt(existing.getMaxExp()) : Math.max(body.getMaxExp(), 0);
        Integer maxObtainCount = body.getMaxObtainCount() == null ? existing.getMaxObtainCount() : Math.max(body.getMaxObtainCount(), 0);
        if (maxExp < minExp) {
            return ResponseEntity.badRequest().body(Map.of("message", "最大经验不能小于最小经验"));
        }

        existing.setMinExp(minExp);
        existing.setMaxExp(maxExp);
        if (body.getName() != null && !body.getName().isBlank()) {
            existing.setName(body.getName().trim());
        }
        if (body.getDescription() != null) {
            existing.setDescription(body.getDescription().trim());
        }
        if (body.getEnabled() != null) {
            existing.setEnabled(body.getEnabled());
        }
        existing.setMaxObtainCount(maxObtainCount);

        experienceRuleService.updateById(existing);
        return ResponseEntity.ok(buildExpRuleResponse(existing));
    }

    @DeleteMapping("/exp-rules/{ruleKey}")
    public ResponseEntity<?> deleteExpRule(@PathVariable String ruleKey) {
        ExperienceRule existing = experienceRuleService.getByRuleKey(ruleKey);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "经验规则不存在"));
        }
        experienceRuleService.removeById(existing.getId());
        return ResponseEntity.ok(Map.of(
                "message", "经验规则已删除",
                "key", defaultText(existing.getRuleKey(), ruleKey)
        ));
    }

    @GetMapping("/users")
    public ResponseEntity<?> getLevelUsers(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer level) {
        Page<User> pageRequest = new Page<>(page, size);
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();

        if (keyword != null && !keyword.isBlank()) {
            queryWrapper.and(wrapper -> wrapper
                    .like("username", keyword.trim())
                    .or()
                    .like("email", keyword.trim()));
        }
        if (level != null) {
            queryWrapper.eq("level", level);
        }

        queryWrapper.orderByDesc("exp").orderByDesc("level").orderByDesc("create_time");

        Page<User> result = userService.page(pageRequest, queryWrapper);
        List<Map<String, Object>> records = result.getRecords().stream()
                .map(this::buildLevelUserResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "records", records,
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize(),
                "pages", result.getPages()
        ));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateLevelUser(@PathVariable Long id, @RequestBody AdminLevelUserUpdateRequest body) {
        User existing = userService.getById(id);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "用户不存在"));
        }

        Integer targetLevel = parseInteger(body == null ? null : body.getLevel());
        Integer targetExp = parseInteger(body == null ? null : body.getExp());
        if (targetLevel == null || targetLevel < 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级不能为空"));
        }
        if (targetExp == null || targetExp < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "经验值不能小于 0"));
        }

        List<ExperienceProperties.LevelRule> sortedLevels = getSortedLevelRules();
        ExperienceProperties.LevelRule currentRule = sortedLevels.stream()
                .filter(rule -> safeInt(rule.getLevel()) == targetLevel)
                .findFirst()
                .orElse(null);
        if (currentRule == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "目标等级不存在"));
        }

        int minExp = safeInt(currentRule.getThreshold());
        int maxExp = Integer.MAX_VALUE;
        for (ExperienceProperties.LevelRule rule : sortedLevels) {
            if (safeInt(rule.getLevel()) == targetLevel + 1) {
                maxExp = Math.max(safeInt(rule.getThreshold()) - 1, minExp);
                break;
            }
        }

        int normalizedExp = Math.max(targetExp, minExp);
        if (maxExp != Integer.MAX_VALUE) {
            normalizedExp = Math.min(normalizedExp, maxExp);
        }

        User updated = new User();
        updated.setId(id);
        updated.setLevel(targetLevel);
        updated.setExp(normalizedExp);
        userService.updateById(updated);

        User refreshed = userService.getById(id);
        return ResponseEntity.ok(buildLevelUserResponse(refreshed));
    }

    @GetMapping("/logs")
    public ResponseEntity<?> getLevelLogs(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String bizType) {
        Page<UserExpLog> pageRequest = new Page<>(page, size);
        QueryWrapper<UserExpLog> queryWrapper = new QueryWrapper<>();

        if (bizType != null && !bizType.isBlank()) {
            queryWrapper.eq("biz_type", bizType.trim());
        }

        List<User> matchedUsers = null;
        if (username != null && !username.isBlank()) {
            matchedUsers = userService.list(new QueryWrapper<User>()
                    .select("id", "username", "avatar", "level", "exp")
                    .like("username", username.trim()));
            if (matchedUsers.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "records", List.of(),
                        "total", 0,
                        "current", pageRequest.getCurrent(),
                        "size", pageRequest.getSize(),
                        "pages", 0
                ));
            }
            queryWrapper.in("user_id", matchedUsers.stream().map(User::getId).toList());
        }

        queryWrapper.orderByDesc("create_time");
        Page<UserExpLog> result = experienceService.page(pageRequest, queryWrapper);

        List<Long> userIds = result.getRecords().stream().map(UserExpLog::getUserId).distinct().toList();
        Map<Long, User> userMap = (matchedUsers != null ? matchedUsers : userService.list(new QueryWrapper<User>()
                .select("id", "username", "avatar", "level", "exp")
                .in(!userIds.isEmpty(), "id", userIds)))
                .stream()
                .collect(Collectors.toMap(User::getId, user -> user, (left, right) -> left));

        List<Map<String, Object>> records = result.getRecords().stream()
                .map(log -> buildLevelLogResponse(log, userMap.get(log.getUserId())))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "records", records,
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize(),
                "pages", result.getPages()
        ));
    }

    @PostMapping("/recalculate")
    public ResponseEntity<?> recalculateLevels() {
        int updated = recalculateAllLevels();
        return ResponseEntity.ok(Map.of(
                "message", updated > 0 ? "已重新校准 " + updated + " 个用户等级" : "所有用户等级已是最新状态",
                "updated", updated
        ));
    }

    private List<ExperienceProperties.LevelRule> getSortedLevelRules() {
        List<ExperienceLevelRule> configuredRules = experienceLevelRuleService.listEnabledRules();
        if (!configuredRules.isEmpty()) {
            return configuredRules.stream()
                    .map(this::toLevelRule)
                    .sorted(Comparator.comparingInt(rule -> safeInt(rule.getThreshold())))
                    .collect(Collectors.toList());
        }
        return experienceProperties.getLevels().stream()
                .sorted(Comparator.comparingInt(rule -> safeInt(rule.getThreshold())))
                .collect(Collectors.toList());
    }

    private ExperienceProperties.LevelRule toLevelRule(ExperienceLevelRule source) {
        ExperienceProperties.LevelRule item = new ExperienceProperties.LevelRule();
        item.setLevel(source.getLevel());
        item.setName(source.getName());
        item.setThreshold(source.getThreshold());
        return item;
    }

    private Map<String, Object> buildLevelUserResponse(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("username", user.getUsername());
        response.put("avatar", user.getAvatar());
        response.put("role", user.getRole());
        response.put("status", user.getStatus());
        response.put("level", safeInt(user.getLevel()));
        response.put("levelName", resolveLevelName(safeInt(user.getLevel())));
        response.put("exp", safeInt(user.getExp()));
        response.put("points", safeInt(user.getPoints()));
        response.put("createTime", user.getCreateTime());
        response.put("progress", experienceService.getProgress(user.getExp()));
        return response;
    }

    private Map<String, Object> buildLevelLogResponse(UserExpLog log, User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", log.getId());
        response.put("bizType", log.getBizType());
        response.put("bizLabel", mapExpRuleLabel(log.getBizType()));
        response.put("bizId", log.getBizId());
        response.put("expChange", safeInt(log.getExpChange()));
        response.put("reason", log.getReason());
        response.put("createTime", log.getCreateTime());

        if (user != null) {
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", user.getId());
            userMap.put("username", user.getUsername());
            userMap.put("avatar", user.getAvatar());
            userMap.put("level", safeInt(user.getLevel()));
            userMap.put("exp", safeInt(user.getExp()));
            response.put("user", userMap);
        }

        return response;
    }

    private Map<String, Object> buildExpRuleResponse(ExperienceRule rule) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", rule.getId());
        item.put("key", rule.getRuleKey());
        item.put("label", defaultText(rule.getName(), mapExpRuleLabel(rule.getRuleKey())));
        item.put("description", rule.getDescription());
        item.put("minExp", safeInt(rule.getMinExp()));
        item.put("maxExp", safeInt(rule.getMaxExp()));
        item.put("enabled", rule.getEnabled() == null || rule.getEnabled());
        item.put("maxObtainCount", rule.getMaxObtainCount());
        item.put("rangeText", safeInt(rule.getMinExp()) == safeInt(rule.getMaxExp())
                ? "+" + safeInt(rule.getMinExp()) + " 经验"
                : safeInt(rule.getMinExp()) + "-" + safeInt(rule.getMaxExp()) + " 经验");
        return item;
    }

    private Map<String, Object> buildLevelRuleResponse(ExperienceLevelRule rule) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", rule.getId());
        item.put("level", safeInt(rule.getLevel()));
        item.put("name", defaultText(rule.getName(), "未命名等级"));
        item.put("threshold", safeInt(rule.getThreshold()));
        item.put("enabled", rule.getEnabled() == null || rule.getEnabled());
        item.put("sortOrder", safeInt(rule.getSortOrder()));
        item.put("rangeText", "达到 " + safeInt(rule.getThreshold()) + " 经验");
        return item;
    }

    private String resolveLevelName(int level) {
        return getSortedLevelRules().stream()
                .filter(rule -> safeInt(rule.getLevel()) == level)
                .map(ExperienceProperties.LevelRule::getName)
                .findFirst()
                .orElse("未命名等级");
    }

    private ResponseEntity<?> validateLevelThreshold(Integer level, Integer threshold, Long excludedId) {
        ExperienceLevelRule previousRule = experienceLevelRuleService.listOrderedRules().stream()
                .filter(rule -> !Objects.equals(rule.getId(), excludedId))
                .filter(rule -> safeInt(rule.getLevel()) < safeInt(level))
                .max(Comparator.comparingInt(rule -> safeInt(rule.getLevel())))
                .orElse(null);
        if (previousRule != null && threshold < safeInt(previousRule.getThreshold())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "等级阈值不能小于上一等级的经验阈值",
                    "previousLevel", safeInt(previousRule.getLevel()),
                    "previousThreshold", safeInt(previousRule.getThreshold())
            ));
        }

        ExperienceLevelRule nextRule = experienceLevelRuleService.listOrderedRules().stream()
                .filter(rule -> !Objects.equals(rule.getId(), excludedId))
                .filter(rule -> safeInt(rule.getLevel()) > safeInt(level))
                .min(Comparator.comparingInt(rule -> safeInt(rule.getLevel())))
                .orElse(null);
        if (nextRule != null && threshold > safeInt(nextRule.getThreshold())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "等级阈值不能大于下一等级的经验阈值",
                    "nextLevel", safeInt(nextRule.getLevel()),
                    "nextThreshold", safeInt(nextRule.getThreshold())
            ));
        }
        return null;
    }

    private int recalculateAllLevels() {
        List<User> users = userService.list(new QueryWrapper<User>().select("id", "level", "exp"));
        int updated = 0;

        for (User user : users) {
            Map<String, Object> progress = experienceService.getProgress(user.getExp());
            int expectedLevel = safeInt(progress.get("level"));
            if (!Objects.equals(user.getLevel(), expectedLevel)) {
                User updatedUser = new User();
                updatedUser.setId(user.getId());
                updatedUser.setLevel(expectedLevel);
                userService.updateById(updatedUser);
                updated += 1;
            }
        }
        return updated;
    }

    private String mapExpRuleLabel(String ruleKey) {
        if (ruleKey == null || ruleKey.isBlank()) {
            return "未知来源";
        }
        return switch (ruleKey) {
            case ExperienceService.BIZ_DAILY_CHECKIN -> "每日签到";
            case ExperienceService.BIZ_PRACTICE_COMPLETE -> "完成练习";
            default -> ruleKey;
        };
    }
}
