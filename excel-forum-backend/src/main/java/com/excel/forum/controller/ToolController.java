package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.DocumentConversionRecord;
import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.DocumentConversionService;
import com.excel.forum.service.DocumentConversionRecordService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.HashMap;
import java.util.Map;

import static com.excel.forum.util.QueryPageUtils.limit;

@RestController
@RequestMapping("/api/tools")
@RequiredArgsConstructor
public class ToolController {
    private static final int CONVERSION_COST_POINTS = 5;

    private final DocumentConversionService documentConversionService;
    private final DocumentConversionRecordService documentConversionRecordService;
    private final UserService userService;
    private final UserMapper userMapper;
    private final PointsRecordService pointsRecordService;

    @GetMapping("/overview")
    public ResponseEntity<?> getToolOverview(@RequestAttribute(value = "userId", required = false) Long userId) {
        User user = userId == null ? null : userService.getById(userId);
        Map<String, Object> response = new HashMap<>();
        response.put("conversionCostPoints", CONVERSION_COST_POINTS);
        if (user == null) {
            response.put("user", null);
        } else {
            response.put("user", Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "points", safeInt(user.getPoints())
            ));
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/convert")
    @Transactional
    public ResponseEntity<?> convertDocument(
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("targetType") String targetType) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "请先登录"));
        }
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "用户不存在"));
        }
        if (safeInt(user.getPoints()) < CONVERSION_COST_POINTS) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "积分不足，实用功能每次转换需要 " + CONVERSION_COST_POINTS + " 积分",
                    "requiredPoints", CONVERSION_COST_POINTS,
                    "currentPoints", safeInt(user.getPoints())
            ));
        }
        int deducted = userMapper.deductPoints(userId, CONVERSION_COST_POINTS);
        if (deducted == 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "积分不足，实用功能每次转换需要 " + CONVERSION_COST_POINTS + " 积分",
                    "requiredPoints", CONVERSION_COST_POINTS,
                    "currentPoints", safeInt(user.getPoints())
            ));
        }
        try {
            Map<String, Object> result = new HashMap<>(documentConversionService.convert(file, targetType));
            User updatedUser = userService.getById(userId);

            DocumentConversionRecord record = new DocumentConversionRecord();
            record.setUserId(userId);
            record.setSourceFileName(file.getOriginalFilename());
            record.setSourceType(String.valueOf(result.get("sourceType")));
            record.setTargetType(String.valueOf(result.get("targetType")));
            record.setResultFileName(String.valueOf(result.get("fileName")));
            record.setResultUrl(String.valueOf(result.get("url")));
            record.setStatus("success");
            documentConversionRecordService.save(record);

            PointsRecord costRecord = new PointsRecord();
            costRecord.setUserId(userId);
            costRecord.setRuleName("实用功能转换");
            costRecord.setTaskKey("tool_conversion");
            costRecord.setBizId(record.getId());
            costRecord.setChange(-CONVERSION_COST_POINTS);
            costRecord.setBalance(updatedUser == null ? Math.max(0, safeInt(user.getPoints()) - CONVERSION_COST_POINTS) : safeInt(updatedUser.getPoints()));
            costRecord.setDescription("文件转换扣除 " + CONVERSION_COST_POINTS + " 积分");
            pointsRecordService.save(costRecord);

            result.put("recordId", record.getId());
            result.put("costPoints", CONVERSION_COST_POINTS);
            result.put("currentPoints", updatedUser == null ? 0 : safeInt(updatedUser.getPoints()));
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException | IllegalStateException e) {
            userMapper.addPoints(userId, CONVERSION_COST_POINTS);
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            userMapper.addPoints(userId, CONVERSION_COST_POINTS);
            throw e;
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getConversionHistory(@RequestAttribute Long userId) {
        List<Map<String, Object>> records = limit(documentConversionRecordService, new QueryWrapper<DocumentConversionRecord>()
                        .eq("user_id", userId)
                        .orderByDesc("create_time"), 12)
                .stream()
                .map(item -> {
                    Map<String, Object> record = new HashMap<>();
                    record.put("id", item.getId());
                    record.put("sourceFileName", item.getSourceFileName());
                    record.put("sourceType", item.getSourceType());
                    record.put("targetType", item.getTargetType());
                    record.put("resultFileName", item.getResultFileName());
                    record.put("resultUrl", item.getResultUrl());
                    record.put("status", item.getStatus());
                    record.put("createTime", item.getCreateTime());
                    return record;
                })
                .toList();
        return ResponseEntity.ok(Map.of("records", records));
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }
}
