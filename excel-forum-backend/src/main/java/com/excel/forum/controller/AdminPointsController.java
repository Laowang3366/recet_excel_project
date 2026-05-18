package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.PointsRule;
import com.excel.forum.entity.PointsRuleOption;
import com.excel.forum.entity.User;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.PointsRuleOptionService;
import com.excel.forum.service.PointsRuleService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.excel.forum.controller.AdminControllerSupport.parseInteger;
import static com.excel.forum.controller.AdminControllerSupport.safeInt;

@RestController
@RequestMapping("/api/admin/points")
@RequiredArgsConstructor
public class AdminPointsController {
    private static final String POINTS_OPTION_KIND_TYPE = "type";
    private static final String POINTS_OPTION_KIND_TASK_KEY = "task_key";

    private final UserService userService;
    private final PointsRecordService pointsRecordService;
    private final NotificationService notificationService;
    private final PointsRuleService pointsRuleService;
    private final PointsRuleOptionService pointsRuleOptionService;

    @PostMapping("/grant")
    @Transactional
    public ResponseEntity<?> grantPoints(@RequestBody Map<String, Object> body) {
        String username = body.get("username") == null ? "" : body.get("username").toString().trim();
        Integer points = parseInteger(body.get("points"));
        String reason = body.get("reason") == null ? "" : body.get("reason").toString().trim();

        if (!StringUtils.hasText(username)) {
            return ResponseEntity.badRequest().body(Map.of("message", "用户名不能为空"));
        }
        if (points == null || points <= 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "发放积分必须大于0"));
        }
        if (!StringUtils.hasText(reason)) {
            return ResponseEntity.badRequest().body(Map.of("message", "发放原因不能为空"));
        }

        User user = userService.findByUsername(username);
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "用户不存在"));
        }

        pointsRecordService.addPointsRecord(user.getId(), "管理员发放", points, reason);
        User updatedUser = userService.getById(user.getId());
        notificationService.createNotification(
                user.getId(),
                "system",
                "管理员为你发放了 " + points + " 积分，原因：" + reason,
                null
        );

        return ResponseEntity.ok(Map.of(
                "message", "积分发放成功",
                "userId", user.getId(),
                "username", user.getUsername(),
                "points", points,
                "balance", updatedUser == null ? safeInt(user.getPoints()) : safeInt(updatedUser.getPoints()),
                "reason", reason
        ));
    }

    @GetMapping("/rules")
    public ResponseEntity<?> getPointsRules() {
        QueryWrapper<PointsRule> queryWrapper = new QueryWrapper<>();
        queryWrapper.orderByAsc("sort_order").orderByAsc("id");
        return ResponseEntity.ok(pointsRuleService.list(queryWrapper));
    }

    @GetMapping("/options")
    public ResponseEntity<?> getPointsRuleOptions() {
        Map<String, Object> response = new HashMap<>();
        response.put("types", buildPointsRuleOptionResponses(POINTS_OPTION_KIND_TYPE));
        response.put("taskKeys", buildPointsRuleOptionResponses(POINTS_OPTION_KIND_TASK_KEY));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/options")
    public ResponseEntity<?> createPointsRuleOption(@RequestBody PointsRuleOption option) {
        ResponseEntity<?> validationError = validatePointsRuleOption(option, null);
        if (validationError != null) {
            return validationError;
        }
        normalizePointsRuleOption(option);
        pointsRuleOptionService.save(option);
        return ResponseEntity.ok(buildPointsRuleOptionResponse(option));
    }

    @PutMapping("/options/{id}")
    public ResponseEntity<?> updatePointsRuleOption(@PathVariable Long id, @RequestBody PointsRuleOption option) {
        PointsRuleOption existing = pointsRuleOptionService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        ResponseEntity<?> validationError = validatePointsRuleOption(option, id);
        if (validationError != null) {
            return validationError;
        }
        normalizePointsRuleOption(option);
        long usageCount = countPointsRulesUsingOption(existing.getKind(), existing.getOptionValue());
        boolean isValueChanged = !Objects.equals(existing.getKind(), option.getKind()) || !Objects.equals(existing.getOptionValue(), option.getOptionValue());
        if (isValueChanged && usageCount > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "该选项已被积分规则使用，无法修改标识值"));
        }
        option.setId(id);
        pointsRuleOptionService.updateById(option);
        return ResponseEntity.ok(buildPointsRuleOptionResponse(pointsRuleOptionService.getById(id)));
    }

    @DeleteMapping("/options/{id}")
    public ResponseEntity<?> deletePointsRuleOption(@PathVariable Long id) {
        PointsRuleOption existing = pointsRuleOptionService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        long usageCount = countPointsRulesUsingOption(existing.getKind(), existing.getOptionValue());
        if (usageCount > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "该选项已被积分规则使用，请先修改或删除相关规则"));
        }
        pointsRuleOptionService.removeById(id);
        return ResponseEntity.ok(Map.of("message", "积分规则选项已删除"));
    }

    @PostMapping("/rules")
    public ResponseEntity<?> createPointsRule(@RequestBody PointsRule rule) {
        ResponseEntity<?> validationError = validatePointsRule(rule, null);
        if (validationError != null) {
            return validationError;
        }
        applyPointsRuleDefaults(rule);
        pointsRuleService.save(rule);
        return ResponseEntity.ok(rule);
    }

    @PutMapping("/rules/{id}")
    public ResponseEntity<?> updatePointsRule(@PathVariable Long id, @RequestBody PointsRule rule) {
        PointsRule existing = pointsRuleService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        ResponseEntity<?> validationError = validatePointsRule(rule, id);
        if (validationError != null) {
            return validationError;
        }
        applyPointsRuleDefaults(rule);
        rule.setId(id);
        pointsRuleService.updateById(rule);
        return ResponseEntity.ok(rule);
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<?> deletePointsRule(@PathVariable Long id) {
        pointsRuleService.removeById(id);
        return ResponseEntity.ok(Map.of("message", "积分规则已删除"));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getPointsStats() {
        Map<String, Object> stats = new HashMap<>();

        QueryWrapper<User> activeWrapper = new QueryWrapper<>();
        activeWrapper.gt("points", 0);
        stats.put("activeUsers", userService.count(activeWrapper));

        QueryWrapper<PointsRecord> totalWrapper = new QueryWrapper<>();
        totalWrapper.select("COALESCE(SUM(`change`), 0) AS total_points");
        stats.put("totalPoints", extractStatValue(pointsRecordService.getMap(totalWrapper), "total_points"));

        QueryWrapper<PointsRecord> todayWrapper = new QueryWrapper<>();
        todayWrapper.select("COALESCE(SUM(`change`), 0) AS total_points")
                .ge("create_time", LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0));
        stats.put("todayPoints", extractStatValue(pointsRecordService.getMap(todayWrapper), "total_points"));

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/records")
    public ResponseEntity<?> getPointsRecords(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String username) {
        return ResponseEntity.ok(pointsRecordService.getRecordsPage(page, size, username));
    }

    private ResponseEntity<?> validatePointsRule(PointsRule rule, Long currentId) {
        if (rule == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则参数不能为空"));
        }
        if (rule.getName() == null || rule.getName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则名称不能为空"));
        }
        if (rule.getPoints() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "积分值不能为空"));
        }
        String effectiveType = StringUtils.hasText(rule.getType()) ? rule.getType().trim() : "daily";
        if (pointsRuleOptionService.getByKindAndValue(POINTS_OPTION_KIND_TYPE, effectiveType) == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择有效的规则类型"));
        }
        if (rule.getTaskKey() != null && !rule.getTaskKey().isBlank()) {
            String normalizedTaskKey = rule.getTaskKey().trim();
            if (pointsRuleOptionService.getByKindAndValue(POINTS_OPTION_KIND_TASK_KEY, normalizedTaskKey) == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "请选择有效的任务类型"));
            }
            QueryWrapper<PointsRule> queryWrapper = new QueryWrapper<>();
            queryWrapper.eq("task_key", normalizedTaskKey);
            if (currentId != null) {
                queryWrapper.ne("id", currentId);
            }
            if (pointsRuleService.count(queryWrapper) > 0) {
                return ResponseEntity.badRequest().body(Map.of("message", "任务标识已存在"));
            }
        }
        return null;
    }

    private ResponseEntity<?> validatePointsRuleOption(PointsRuleOption option, Long currentId) {
        if (option == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "选项参数不能为空"));
        }
        String normalizedKind = option.getKind() == null ? "" : option.getKind().trim().toLowerCase();
        if (!POINTS_OPTION_KIND_TYPE.equals(normalizedKind) && !POINTS_OPTION_KIND_TASK_KEY.equals(normalizedKind)) {
            return ResponseEntity.badRequest().body(Map.of("message", "选项分类不合法"));
        }
        String normalizedValue = option.getOptionValue() == null ? "" : option.getOptionValue().trim().toLowerCase();
        if (normalizedValue.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "标识值不能为空"));
        }
        if (!normalizedValue.matches("^[a-z0-9_-]+$")) {
            return ResponseEntity.badRequest().body(Map.of("message", "标识值仅支持小写字母、数字、下划线和短横线"));
        }
        String normalizedLabel = option.getLabel() == null ? "" : option.getLabel().trim();
        if (normalizedLabel.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "显示名称不能为空"));
        }
        QueryWrapper<PointsRuleOption> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("kind", normalizedKind).eq("option_value", normalizedValue);
        if (currentId != null) {
            queryWrapper.ne("id", currentId);
        }
        if (pointsRuleOptionService.count(queryWrapper) > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "同类标识值已存在"));
        }
        return null;
    }

    private void applyPointsRuleDefaults(PointsRule rule) {
        if (rule.getTaskKey() != null) {
            String normalizedTaskKey = rule.getTaskKey().trim();
            rule.setTaskKey(normalizedTaskKey.isEmpty() ? null : normalizedTaskKey);
        }
        if (rule.getType() == null || rule.getType().isBlank()) {
            rule.setType("daily");
        }
        if (rule.getEnabled() == null) {
            rule.setEnabled(true);
        }
        if (rule.getUserVisible() == null) {
            rule.setUserVisible(true);
        }
        if (rule.getSortOrder() == null) {
            rule.setSortOrder(0);
        }
    }

    private void normalizePointsRuleOption(PointsRuleOption option) {
        option.setKind(option.getKind() == null ? null : option.getKind().trim().toLowerCase());
        option.setOptionValue(option.getOptionValue() == null ? null : option.getOptionValue().trim().toLowerCase());
        option.setLabel(option.getLabel() == null ? null : option.getLabel().trim());
        if (option.getSortOrder() == null) {
            option.setSortOrder(0);
        }
    }

    private List<Map<String, Object>> buildPointsRuleOptionResponses(String kind) {
        return pointsRuleOptionService.listByKind(kind).stream()
                .map(this::buildPointsRuleOptionResponse)
                .toList();
    }

    private Map<String, Object> buildPointsRuleOptionResponse(PointsRuleOption option) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", option.getId());
        item.put("kind", option.getKind());
        item.put("value", option.getOptionValue());
        item.put("label", option.getLabel());
        item.put("sortOrder", safeInt(option.getSortOrder()));
        item.put("usageCount", countPointsRulesUsingOption(option.getKind(), option.getOptionValue()));
        item.put("createTime", option.getCreateTime());
        item.put("updateTime", option.getUpdateTime());
        return item;
    }

    private long countPointsRulesUsingOption(String kind, String optionValue) {
        if (!StringUtils.hasText(kind) || !StringUtils.hasText(optionValue)) {
            return 0L;
        }
        QueryWrapper<PointsRule> queryWrapper = new QueryWrapper<>();
        if (POINTS_OPTION_KIND_TYPE.equals(kind)) {
            queryWrapper.eq("type", optionValue);
        } else if (POINTS_OPTION_KIND_TASK_KEY.equals(kind)) {
            queryWrapper.eq("task_key", optionValue);
        } else {
            return 0L;
        }
        return pointsRuleService.count(queryWrapper);
    }

    private int extractStatValue(Map<String, Object> source, String key) {
        if (source == null || !source.containsKey(key)) {
            return 0;
        }
        return safeInt(source.get(key));
    }
}
